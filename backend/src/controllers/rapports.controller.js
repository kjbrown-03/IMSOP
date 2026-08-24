const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { putObject, getSignedDownloadUrl } = require('../lib/s3')
const { buildRapportPdf } = require('../lib/pdf')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
const { safeUserSelect } = require('../lib/selectors')

const DESTINATAIRES_RAPPORT_FINAL = new Set(['PATIENT', 'MEDECIN_LOCAL'])

async function upsertBrouillon(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })

  const { synthese, diagnostic, optionsTherapeutiques } = req.body

  const rapport = await prisma.rapport.upsert({
    where: { dossierId: dossier.id },
    update: { synthese, diagnostic, optionsTherapeutiques },
    create: {
      dossierId: dossier.id,
      specialisteId: dossier.specialisteId,
      synthese,
      diagnostic,
      optionsTherapeutiques,
    },
  })

  if (dossier.status === 'EN_ANALYSE') {
    await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'RAPPORT_EN_PREPARATION' } })
  }

  await logAction({ userId: req.userId, action: 'RAPPORT_BROUILLON_ENREGISTRE', entityType: 'Rapport', entityId: rapport.id, dossierId: dossier.id })
  res.json(rapport)
}

async function soumettreRapport(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })

  const rapport = await prisma.rapport.findUnique({ where: { dossierId: dossier.id } })
  if (!rapport) return res.status(400).json({ message: 'Aucun brouillon à soumettre' })
  if (!rapport.synthese || !rapport.diagnostic) {
    return res.status(400).json({ message: 'La synthèse et le diagnostic sont requis avant soumission' })
  }

  const updated = await prisma.rapport.update({
    where: { id: rapport.id },
    data: { status: 'SOUMIS', submittedAt: new Date() },
  })
  await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'RAPPORT_SOUMIS' } })

  await logAction({ userId: req.userId, action: 'RAPPORT_SOUMIS', entityType: 'Rapport', entityId: rapport.id, dossierId: dossier.id })
  res.json(updated)
}

// The coordinator/admin validates administrative conformity only - never the medical content.
async function validerRapport(req, res) {
  const rapport = await prisma.rapport.findUnique({
    where: { id: req.params.id },
    include: {
      dossier: { include: { patient: { include: { user: { select: safeUserSelect } } } } },
      specialiste: { include: { user: { select: safeUserSelect } } },
    },
  })
  if (!rapport) return res.status(404).json({ message: 'Rapport introuvable' })
  if (rapport.status !== 'SOUMIS') return res.status(400).json({ message: 'Ce rapport doit être soumis avant validation' })

  const pdfBuffer = await buildRapportPdf({
    dossier: rapport.dossier,
    rapport,
    patientName: rapport.dossier.patient.user.fullName,
    specialisteName: rapport.specialiste.user.fullName,
  })
  const key = `rapports/${rapport.dossierId}/rapport-${rapport.id}.pdf`
  await putObject(key, pdfBuffer, 'application/pdf')

  const updated = await prisma.rapport.update({
    where: { id: rapport.id },
    data: { status: 'VALIDE', validatedAt: new Date(), pdfStorageKey: key },
  })
  await prisma.dossier.update({ where: { id: rapport.dossierId }, data: { status: 'RAPPORT_TRANSMIS' } })

  await logAction({ userId: req.userId, action: 'RAPPORT_VALIDE', entityType: 'Rapport', entityId: rapport.id, dossierId: rapport.dossierId })
  await notify(rapport.dossier.patient.userId, rapport.dossier.patient.user.email, 'RAPPORT_DISPONIBLE', {
    name: rapport.dossier.patient.user.fullName,
    reference: rapport.dossier.reference,
  })

  res.json(updated)
}

async function getRapport(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const rapport = await prisma.rapport.findUnique({ where: { dossierId: dossier.id } })
  if (!rapport) return res.status(404).json({ message: 'Aucun rapport pour ce dossier' })

  if (DESTINATAIRES_RAPPORT_FINAL.has(req.userRole) && rapport.status !== 'VALIDE') {
    return res.status(403).json({ message: "Le rapport n'est pas encore disponible" })
  }

  res.json(rapport)
}

async function downloadRapportPdf(req, res) {
  const rapport = await prisma.rapport.findUnique({ where: { id: req.params.id } })
  if (!rapport || !rapport.pdfStorageKey) return res.status(404).json({ message: 'PDF non disponible' })

  const { error, message } = await loadDossierWithAccessCheck(req, rapport.dossierId)
  if (error) return res.status(error).json({ message })
  if (DESTINATAIRES_RAPPORT_FINAL.has(req.userRole) && rapport.status !== 'VALIDE') {
    return res.status(403).json({ message: "Le rapport n'est pas encore disponible" })
  }

  const url = await getSignedDownloadUrl(rapport.pdfStorageKey)
  await logAction({ userId: req.userId, action: 'RAPPORT_PDF_TELECHARGE', entityType: 'Rapport', entityId: rapport.id, dossierId: rapport.dossierId })
  res.json({ url })
}

module.exports = { upsertBrouillon, soumettreRapport, validerRapport, getRapport, downloadRapportPdf }
