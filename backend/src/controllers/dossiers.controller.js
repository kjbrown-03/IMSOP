const crypto = require('crypto')
const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { safeUserSelect } = require('../lib/selectors')
const env = require('../config/env')

async function loadDossierWithAccessCheck(req, dossierId) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      patient: { include: { user: { select: safeUserSelect } } },
      specialiste: { include: { user: { select: safeUserSelect } } },
    },
  })
  if (!dossier) return { error: 404, message: 'Dossier introuvable' }

  if (req.userRole === 'PATIENT' && dossier.patient.userId !== req.userId) {
    return { error: 403, message: 'Ce dossier ne vous appartient pas' }
  }
  if (req.userRole === 'SPECIALISTE') {
    const specialiste = await prisma.specialiste.findUnique({ where: { userId: req.userId } })
    if (!specialiste || dossier.specialisteId !== specialiste.id) {
      return { error: 403, message: "Ce dossier ne vous est pas assigné" }
    }
  }
  // COORDINATEUR and ADMIN can access any dossier

  return { dossier }
}

async function createDossier(req, res) {
  const patient = await prisma.patient.findUnique({ where: { userId: req.userId } })
  if (!patient) return res.status(403).json({ message: 'Seuls les patients peuvent créer un dossier' })

  const { specialiteRequise, motif, questionMedicale, symptomes, antecedents, traitementEnCours, urgence } = req.body

  const year = new Date().getFullYear()
  const reference = `MLA-${year}-${crypto.randomInt(1000, 9999)}`

  const dossier = await prisma.dossier.create({
    data: {
      reference,
      patientId: patient.id,
      specialiteRequise,
      motif,
      questionMedicale,
      symptomes,
      antecedents,
      traitementEnCours,
      urgence: urgence || 'NORMAL',
      status: 'BROUILLON',
    },
  })

  await logAction({ userId: req.userId, action: 'DOSSIER_CREATE', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })
  res.status(201).json(dossier)
}

async function listDossiers(req, res) {
  let where = {}

  if (req.userRole === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { userId: req.userId } })
    where = { patientId: patient.id }
  } else if (req.userRole === 'SPECIALISTE') {
    const specialiste = await prisma.specialiste.findUnique({ where: { userId: req.userId } })
    where = { specialisteId: specialiste?.id }
  } else if (req.query.status) {
    where = { status: req.query.status }
  }

  const { page, pageSize } = req.query

  const [dossiers, total] = await Promise.all([
    prisma.dossier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        patient: { include: { user: { select: safeUserSelect } } },
        specialiste: { include: { user: { select: safeUserSelect } } },
      },
    }),
    prisma.dossier.count({ where }),
  ])

  res.json({ items: dossiers, total, page, pageSize })
}

async function getDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })

  await logAction({
    userId: req.userId,
    action: 'DOSSIER_VIEW',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    ipAddress: req.ip,
  })

  res.json(dossier)
}

async function updateDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })

  if (req.userRole === 'PATIENT' && !['BROUILLON', 'SOUMIS'].includes(dossier.status)) {
    return res.status(400).json({ message: 'Ce dossier ne peut plus être modifié par le patient' })
  }

  // req.body is already restricted to the known dossier fields by the route's
  // Zod schema (.strict()), so it's safe to pass straight through to Prisma.
  const updated = await prisma.dossier.update({ where: { id: dossier.id }, data: req.body })
  await logAction({ userId: req.userId, action: 'DOSSIER_UPDATE', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id, metadata: req.body })
  res.json(updated)
}

async function soumettreDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (dossier.status !== 'BROUILLON') return res.status(400).json({ message: 'Ce dossier a déjà été soumis' })

  const updated = await prisma.dossier.update({
    where: { id: dossier.id },
    data: { status: 'EN_ATTENTE_PAIEMENT' },
  })

  await logAction({ userId: req.userId, action: 'DOSSIER_SOUMIS', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })
  await notify(dossier.patient.userId, dossier.patient.user.email, 'DOSSIER_SOUMIS', {
    name: dossier.patient.user.fullName,
    reference: dossier.reference,
  })

  res.json(updated)
}

async function assignerSpecialiste(req, res) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: req.params.id },
    include: { patient: { include: { user: { select: safeUserSelect } } } },
  })
  if (!dossier) return res.status(404).json({ message: 'Dossier introuvable' })

  const { specialisteId } = req.body
  const specialiste = await prisma.specialiste.findUnique({
    where: { id: specialisteId },
    include: { user: { select: safeUserSelect } },
  })
  if (!specialiste) return res.status(404).json({ message: 'Spécialiste introuvable' })

  const messagingClosesAt = new Date(Date.now() + env.messaging.autoCloseDays * 24 * 60 * 60 * 1000)

  const updated = await prisma.dossier.update({
    where: { id: dossier.id },
    data: { specialisteId, status: 'AFFECTE', assignedAt: new Date(), messagingClosesAt },
  })

  await logAction({
    userId: req.userId,
    action: 'DOSSIER_ASSIGNE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { specialisteId },
  })

  await notify(specialiste.userId, specialiste.user.email, 'NOUVEAU_DOSSIER_SPECIALISTE', {
    name: specialiste.user.fullName,
    reference: dossier.reference,
  })
  await notify(dossier.patient.userId, dossier.patient.user.email, 'DOSSIER_AFFECTE', {
    name: dossier.patient.user.fullName,
    reference: dossier.reference,
  })

  res.json(updated)
}

async function accepterDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })
  if (dossier.status !== 'AFFECTE') return res.status(400).json({ message: 'Ce dossier ne peut pas être accepté dans son état actuel' })

  const updated = await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'EN_ANALYSE' } })
  await logAction({ userId: req.userId, action: 'DOSSIER_ACCEPTE', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })
  res.json(updated)
}

async function refuserDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })

  const { motif } = req.body
  const updated = await prisma.dossier.update({
    where: { id: dossier.id },
    data: { status: 'EN_ATTENTE_AFFECTATION', specialisteId: null },
  })

  await logAction({
    userId: req.userId,
    action: 'DOSSIER_REFUSE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { motif },
  })

  res.json(updated)
}

module.exports = {
  createDossier,
  listDossiers,
  getDossier,
  updateDossier,
  soumettreDossier,
  assignerSpecialiste,
  accepterDossier,
  refuserDossier,
  loadDossierWithAccessCheck,
}
