const { prisma } = require('../lib/prisma')
const { putObject, getSignedDownloadUrl } = require('../lib/s3')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')

const ALLOWED_IDENTITY_MIME = new Set(['image/jpeg', 'image/png', 'application/pdf'])

async function uploadIdentityDocument(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' })
  if (!ALLOWED_IDENTITY_MIME.has(req.file.mimetype)) {
    return res.status(400).json({ message: 'Format non autorisé (JPEG, PNG ou PDF uniquement)' })
  }

  const patient = await prisma.patient.findUnique({ where: { userId: req.userId } })
  if (!patient) return res.status(404).json({ message: 'Profil patient introuvable' })

  const key = `identite/${patient.id}/${Date.now()}-${req.file.originalname}`
  await putObject(key, req.file.buffer, req.file.mimetype)

  const updated = await prisma.patient.update({
    where: { id: patient.id },
    data: {
      identityDocumentKey: key,
      identityVerified: false,
      identityVerifiedAt: null,
      identityRejectedReason: null,
      identityReviewedById: null,
    },
  })

  await logAction({ userId: req.userId, action: 'IDENTITE_DOCUMENT_UPLOAD', entityType: 'Patient', entityId: patient.id })

  res.status(201).json({
    identityDocumentSubmitted: true,
    identityVerified: updated.identityVerified,
    identityRejectedReason: updated.identityRejectedReason,
  })
}

async function listIdentityReviews(req, res) {
  const { page, pageSize } = req.query
  const where = { identityDocumentKey: { not: null }, identityVerified: false, identityRejectedReason: null }

  const [items, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patient.count({ where }),
  ])

  res.json({ items, total, page, pageSize })
}

async function getIdentityDocumentUrl(req, res) {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.patientId } })
  if (!patient || !patient.identityDocumentKey) {
    return res.status(404).json({ message: 'Document introuvable' })
  }

  const url = await getSignedDownloadUrl(patient.identityDocumentKey)
  await logAction({ userId: req.userId, action: 'IDENTITE_DOCUMENT_CONSULTE', entityType: 'Patient', entityId: patient.id })

  res.json({ url })
}

async function reviewIdentityDocument(req, res) {
  const { approved, rejectedReason } = req.body

  const patient = await prisma.patient.update({
    where: { id: req.params.patientId },
    data: approved
      ? { identityVerified: true, identityVerifiedAt: new Date(), identityRejectedReason: null, identityReviewedById: req.userId }
      : { identityVerified: false, identityVerifiedAt: null, identityRejectedReason: rejectedReason, identityReviewedById: req.userId },
    include: { user: true },
  })

  await logAction({
    userId: req.userId,
    action: approved ? 'IDENTITE_VALIDEE' : 'IDENTITE_REFUSEE',
    entityType: 'Patient',
    entityId: patient.id,
    metadata: approved ? undefined : { rejectedReason },
  })

  await notify(patient.userId, patient.user.email, approved ? 'IDENTITE_VALIDEE' : 'IDENTITE_REFUSEE', {
    name: patient.user.fullName,
    reason: rejectedReason,
  })

  res.json({ identityVerified: patient.identityVerified, identityRejectedReason: patient.identityRejectedReason })
}

module.exports = { uploadIdentityDocument, listIdentityReviews, getIdentityDocumentUrl, reviewIdentityDocument }
