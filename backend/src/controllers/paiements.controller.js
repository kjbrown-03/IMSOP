const crypto = require('crypto')
const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
const { safeUserSelect } = require('../lib/selectors')
const cinetpay = require('../services/cinetpay.service')
const env = require('../config/env')

const TARIFS = {
  STANDARD: 175,
  PRIORITAIRE: 250,
  URGENT: 350,
}

async function initPaiement(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'PATIENT') return res.status(403).json({ message: 'Seul le patient peut initier le paiement' })

  const amount = TARIFS[dossier.urgence] || TARIFS.STANDARD
  const transactionId = `IMSOP-${dossier.reference}-${crypto.randomInt(100000, 999999)}`

  const paiement = await prisma.paiement.create({
    data: {
      dossierId: dossier.id,
      amount,
      currency: 'XAF',
      status: 'EN_ATTENTE',
      cinetpayTransactionId: transactionId,
    },
  })

  try {
    const cinetpayResponse = await cinetpay.initTransaction({
      transactionId,
      amount,
      currency: 'XAF',
      description: `IMSOP - Deuxième avis médical - ${dossier.reference}`,
      customerName: dossier.patient.user.fullName,
    })

    await logAction({ userId: req.userId, action: 'PAIEMENT_INITIE', entityType: 'Paiement', entityId: paiement.id, dossierId: dossier.id })

    return res.status(201).json({ paiement, paymentUrl: cinetpayResponse?.data?.payment_url })
  } catch (err) {
    // Dev/sandbox fallback so the flow remains testable without live CinetPay credentials.
    console.warn('CinetPay init failed, returning paiement without payment_url:', err.message)
    return res.status(201).json({ paiement, paymentUrl: null, warning: 'CinetPay indisponible (mode développement)' })
  }
}

// Called directly by CinetPay's servers - never trust the request body alone.
// The dossier is only unlocked after we independently re-verify the transaction
// status via CinetPay's own /check API.
async function webhook(req, res) {
  const transactionId = req.body.cpm_trans_id || req.body.transaction_id
  if (!transactionId) return res.status(400).json({ message: 'transaction_id manquant' })

  const paiement = await prisma.paiement.findUnique({
    where: { cinetpayTransactionId: transactionId },
    include: { dossier: { include: { patient: { include: { user: { select: safeUserSelect } } } } } },
  })
  if (!paiement) return res.status(404).json({ message: 'Transaction inconnue' })

  await prisma.paiement.update({ where: { id: paiement.id }, data: { rawWebhookPayload: req.body } })

  let verification
  try {
    verification = await cinetpay.verifyTransaction(transactionId)
  } catch (err) {
    console.error('CinetPay verify failed', err)
    return res.status(502).json({ message: 'Vérification CinetPay impossible' })
  }

  const isConfirmed = verification?.data?.status === 'ACCEPTED'
  if (!isConfirmed) {
    await prisma.paiement.update({ where: { id: paiement.id }, data: { status: 'ECHOUE' } })
    await logAction({ action: 'PAIEMENT_ECHEC', entityType: 'Paiement', entityId: paiement.id, dossierId: paiement.dossierId })
    return res.status(200).json({ received: true, status: 'ECHOUE' })
  }

  await prisma.paiement.update({ where: { id: paiement.id }, data: { status: 'PAYE', confirmedAt: new Date() } })
  await prisma.dossier.update({ where: { id: paiement.dossierId }, data: { status: 'EN_ATTENTE_AFFECTATION' } })

  await logAction({ action: 'PAIEMENT_CONFIRME', entityType: 'Paiement', entityId: paiement.id, dossierId: paiement.dossierId })
  await notify(paiement.dossier.patient.userId, paiement.dossier.patient.user.email, 'PAIEMENT_CONFIRME', {
    name: paiement.dossier.patient.user.fullName,
    reference: paiement.dossier.reference,
  })

  res.status(200).json({ received: true, status: 'PAYE' })
}

async function getPaiementStatus(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const paiement = await prisma.paiement.findFirst({ where: { dossierId: dossier.id }, orderBy: { createdAt: 'desc' } })
  res.json(paiement || { status: 'AUCUN' })
}

// Dev-only stand-in for CinetPay's webhook, so the flow is testable without
// live credentials. Never available outside development - production always
// requires the real, independently-verified webhook call.
async function simulatePaiement(req, res) {
  if (env.nodeEnv !== 'development') return res.status(404).json({ message: 'Introuvable' })

  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const paiement = await prisma.paiement.findFirst({ where: { dossierId: dossier.id }, orderBy: { createdAt: 'desc' } })
  if (!paiement) return res.status(404).json({ message: 'Aucun paiement initié pour ce dossier' })

  await prisma.paiement.update({ where: { id: paiement.id }, data: { status: 'PAYE', confirmedAt: new Date() } })
  const updatedDossier = await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'EN_ATTENTE_AFFECTATION' } })

  await logAction({ userId: req.userId, action: 'PAIEMENT_SIMULE_DEV', entityType: 'Paiement', entityId: paiement.id, dossierId: dossier.id })

  res.json({ paiement: { ...paiement, status: 'PAYE' }, dossier: updatedDossier })
}

module.exports = { initPaiement, webhook, getPaiementStatus, simulatePaiement }
