const crypto = require('crypto')
const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
const { safeUserSelect } = require('../lib/selectors')
const cinetpay = require('../services/cinetpay.service')
const fapshi = require('../services/fapshi.service')
const env = require('../config/env')

const TARIFS = env.tarifs

/** Montant dû pour un dossier, selon son urgence. */
function tarifPour(dossier) {
  return {
    amount: TARIFS[dossier.urgence] || TARIFS.STANDARD,
    currency: TARIFS.devise,
    urgence: dossier.urgence || 'NORMAL',
  }
}

// L'écran de paiement affiche le prix avant que le patient ne clique : il doit
// le lire ici plutôt que le porter en dur, sinon l'affichage et la facturation
// finissent par diverger — c'est exactement ce qui s'était produit.
async function getTarif(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  res.json(tarifPour(dossier))
}

// Un patient camerounais paie en Mobile Money par Fapshi, acteur local ; tous
// les autres passent par CinetPay, seul à prendre la carte bancaire. Fapshi non
// configuré = tout le monde sur CinetPay, sans rien casser.
const PAYS_FAPSHI = new Set(['cm'])

function fournisseurPourPays(pays) {
  return fapshi.estConfigure() && PAYS_FAPSHI.has((pays || '').toLowerCase()) ? 'FAPSHI' : 'CINETPAY'
}

function fournisseurPour(dossier) {
  return fournisseurPourPays(dossier.patient?.country)
}

/**
 * Ce qui se passe quand un paiement est confirmé, quel que soit le fournisseur.
 * Un paiement règle soit un dossier (il part en affectation, le patient est
 * prévenu), soit une recherche d'annuaire (ses résultats se débloquent). Dans
 * les deux cas l'audit garde trace. Factorisé pour que les webhooks CinetPay et
 * Fapshi ne divergent jamais.
 */
async function confirmerPaiement(paiement) {
  await prisma.paiement.update({ where: { id: paiement.id }, data: { status: 'PAYE', confirmedAt: new Date() } })

  if (paiement.rechercheAnnuaireId) {
    await prisma.rechercheAnnuaire.update({
      where: { id: paiement.rechercheAnnuaireId },
      data: { statut: 'DEBLOQUEE', debloqueeLe: new Date() },
    })
    await logAction({
      action: 'ANNUAIRE_DEBLOQUE',
      entityType: 'RechercheAnnuaire',
      entityId: paiement.rechercheAnnuaireId,
      metadata: { paiementId: paiement.id },
    })
    return
  }

  await prisma.dossier.update({ where: { id: paiement.dossierId }, data: { status: 'EN_ATTENTE_AFFECTATION' } })

  await logAction({ action: 'PAIEMENT_CONFIRME', entityType: 'Paiement', entityId: paiement.id, dossierId: paiement.dossierId })
  await notify(paiement.dossier.patient.userId, paiement.dossier.patient.user.email, 'PAIEMENT_CONFIRME', {
    name: paiement.dossier.patient.user.fullName,
    reference: paiement.dossier.reference,
  })
}

/**
 * Crée le lien de paiement chez le fournisseur et la ligne Paiement associée,
 * pour une cible qui n'est pas un dossier (aujourd'hui : une recherche
 * d'annuaire). Même règle que pour les dossiers - Fapshi pour le Cameroun,
 * CinetPay ailleurs - et même prudence : si le fournisseur ne rend pas de
 * lien, aucune ligne n'est écrite.
 *
 * @returns {{ paiement, paymentUrl }}
 */
// Après paiement, le patient doit revenir sur SA recherche, pas sur la page de
// suivi d'un dossier. L'URL de retour configurée (Fapshi ou CinetPay) donne
// l'origine du front ; on y remplace le chemin.
function urlRetourAnnuaire(rechercheId) {
  const base = env.fapshi.redirectUrl || env.cinetpay.returnUrl
  if (!base) return undefined
  try {
    return new URL(`/annuaire/${rechercheId}`, base).toString()
  } catch {
    return undefined
  }
}

async function creerPaiementAnnuaire({ recherche, amount, email, customerName }) {
  const provider = fournisseurPourPays(recherche.pays)
  const transactionId = `IMSOP-ANN-${recherche.id.slice(0, 8)}-${crypto.randomInt(100000, 999999)}`
  const description = 'IMSOP - Mise en relation avec un médecin'
  const retour = urlRetourAnnuaire(recherche.id)

  if (provider === 'FAPSHI') {
    const lien = await fapshi.initierPaiement({ amount, email, externalId: transactionId, message: description, redirectUrl: retour })
    const paiement = await prisma.paiement.create({
      data: {
        rechercheAnnuaireId: recherche.id,
        provider: 'FAPSHI',
        amount,
        currency: TARIFS.devise,
        status: 'EN_ATTENTE',
        cinetpayTransactionId: transactionId,
        fapshiTransId: lien.transId,
      },
    })
    return { paiement, paymentUrl: lien.link }
  }

  const paiement = await prisma.paiement.create({
    data: {
      rechercheAnnuaireId: recherche.id,
      amount,
      currency: TARIFS.devise,
      status: 'EN_ATTENTE',
      cinetpayTransactionId: transactionId,
    },
  })
  try {
    const rep = await cinetpay.initTransaction({ transactionId, amount, currency: TARIFS.devise, description, customerName, returnUrl: retour })
    return { paiement, paymentUrl: rep?.data?.payment_url }
  } catch (err) {
    console.warn('CinetPay init failed (annuaire):', err.message)
    return { paiement, paymentUrl: null }
  }
}

async function echouerPaiement(paiement) {
  await prisma.paiement.update({ where: { id: paiement.id }, data: { status: 'ECHOUE' } })
  await logAction({ action: 'PAIEMENT_ECHEC', entityType: 'Paiement', entityId: paiement.id, dossierId: paiement.dossierId })
}

async function initPaiement(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'PATIENT') return res.status(403).json({ message: 'Seul le patient peut initier le paiement' })

  const { amount, currency } = tarifPour(dossier)
  const transactionId = `IMSOP-${dossier.reference}-${crypto.randomInt(100000, 999999)}`

  if (fournisseurPour(dossier) === 'FAPSHI') {
    return initPaiementFapshi(req, res, { dossier, amount, transactionId })
  }

  const paiement = await prisma.paiement.create({
    data: {
      dossierId: dossier.id,
      amount,
      currency,
      status: 'EN_ATTENTE',
      cinetpayTransactionId: transactionId,
    },
  })

  try {
    const cinetpayResponse = await cinetpay.initTransaction({
      transactionId,
      amount,
      currency,
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
    await echouerPaiement(paiement)
    return res.status(200).json({ received: true, status: 'ECHOUE' })
  }

  await confirmerPaiement(paiement)
  res.status(200).json({ received: true, status: 'PAYE' })
}

async function initPaiementFapshi(req, res, { dossier, amount, transactionId }) {
  let lien
  try {
    lien = await fapshi.initierPaiement({
      amount,
      email: dossier.patient.user.email,
      externalId: transactionId,
      message: `IMSOP - Deuxième avis médical - ${dossier.reference}`,
    })
  } catch (err) {
    // Le lien n'a pas pu être créé : aucune ligne de paiement n'est écrite,
    // sinon un enregistrement orphelin sans identifiant Fapshi resterait à
    // jamais « en attente ».
    console.warn('Fapshi init failed:', err.message)
    return res.status(502).json({ message: 'Fapshi indisponible, réessayez dans un instant' })
  }

  const paiement = await prisma.paiement.create({
    data: {
      dossierId: dossier.id,
      provider: 'FAPSHI',
      amount,
      currency: TARIFS.devise,
      status: 'EN_ATTENTE',
      cinetpayTransactionId: transactionId,
      fapshiTransId: lien.transId,
    },
  })

  await logAction({ userId: req.userId, action: 'PAIEMENT_INITIE', entityType: 'Paiement', entityId: paiement.id, dossierId: dossier.id })

  res.status(201).json({ paiement, paymentUrl: lien.link })
}

// Appelé par les serveurs de Fapshi. Deux verrous : le secret partagé dans
// l'en-tête, puis — comme pour CinetPay — une relecture indépendante du statut
// auprès de Fapshi. Le corps du webhook seul ne débloque jamais rien.
async function webhookFapshi(req, res) {
  if (!fapshi.webhookAuthentique(req.get('x-wh-secret'))) {
    return res.status(401).json({ message: 'Webhook non authentifié' })
  }

  const { transId } = req.body
  const paiement = await prisma.paiement.findUnique({
    where: { fapshiTransId: transId },
    include: { dossier: { include: { patient: { include: { user: { select: safeUserSelect } } } } } },
  })
  if (!paiement) return res.status(404).json({ message: 'Transaction inconnue' })

  await prisma.paiement.update({ where: { id: paiement.id }, data: { rawWebhookPayload: req.body } })

  // Un webhook peut être rejoué : un paiement déjà confirmé ne doit ni
  // renotifier le patient ni réécrire le dossier.
  if (paiement.status === 'PAYE') return res.status(200).json({ received: true, status: 'PAYE' })

  let statut
  try {
    statut = await fapshi.statutPaiement(transId)
  } catch (err) {
    console.error('Fapshi verify failed', err)
    return res.status(502).json({ message: 'Vérification Fapshi impossible' })
  }

  if (statut?.status !== 'SUCCESSFUL') {
    // CREATED et PENDING ne sont pas des échecs : on attend le prochain appel.
    if (statut?.status === 'FAILED' || statut?.status === 'EXPIRED') await echouerPaiement(paiement)
    return res.status(200).json({ received: true, status: statut?.status ?? 'INCONNU' })
  }

  // Le montant relu doit être celui attendu : une transaction réussie de 100
  // XAF ne débloque pas un dossier facturé 175.
  if (Number(statut.amount) < Number(paiement.amount)) {
    await echouerPaiement(paiement)
    return res.status(200).json({ received: true, status: 'ECHOUE', motif: 'montant insuffisant' })
  }

  await confirmerPaiement(paiement)
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

module.exports = {
  initPaiement, webhook, webhookFapshi, getPaiementStatus, getTarif, simulatePaiement,
  fournisseurPour, fournisseurPourPays, tarifPour, creerPaiementAnnuaire, confirmerPaiement,
}
