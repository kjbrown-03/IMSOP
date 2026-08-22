const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')

async function createConsentement(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'PATIENT') return res.status(403).json({ message: 'Seul le patient peut donner son consentement' })

  const { type, accepted } = req.body

  const consentement = await prisma.consentement.create({
    data: {
      dossierId: dossier.id,
      patientId: dossier.patientId,
      type,
      accepted,
      ipAddress: req.ip,
    },
  })

  await logAction({
    userId: req.userId,
    action: 'CONSENTEMENT_ENREGISTRE',
    entityType: 'Consentement',
    entityId: consentement.id,
    dossierId: dossier.id,
    metadata: { type, accepted },
    ipAddress: req.ip,
  })

  res.status(201).json(consentement)
}

async function listConsentements(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const consentements = await prisma.consentement.findMany({ where: { dossierId: dossier.id }, orderBy: { acceptedAt: 'desc' } })
  res.json(consentements)
}

module.exports = { createConsentement, listConsentements }
