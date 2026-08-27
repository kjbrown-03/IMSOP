const { prisma } = require('../lib/prisma')
const { putObject, getSignedDownloadUrl } = require('../lib/s3')
const { logAction } = require('../services/auditService')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
const { v4: uuidv4 } = require('uuid')

async function uploadDocument(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' })

  // CONSENTEMENT n'est jamais un choix de téléversement manuel : ce n'est
  // généré et attaché que par consentements.controller.js quand un
  // consentement électronique valide est effectivement enregistré. Sans
  // cette garde, n'importe qui pourrait déposer un fichier quelconque sous
  // cette étiquette pour contourner la vérification avant transmission.
  if (req.body.category === 'CONSENTEMENT') {
    return res.status(400).json({ message: 'Cette catégorie est réservée au consentement signé électroniquement' })
  }

  const key = `dossiers/${dossier.id}/${uuidv4()}-${req.file.originalname}`
  await putObject(key, req.file.buffer, req.file.mimetype)

  const document = await prisma.document.create({
    data: {
      dossierId: dossier.id,
      uploadedById: req.userId,
      category: req.body.category || 'AUTRE',
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storageKey: key,
    },
  })

  await logAction({
    userId: req.userId,
    action: 'DOCUMENT_UPLOAD',
    entityType: 'Document',
    entityId: document.id,
    dossierId: dossier.id,
    metadata: { filename: document.filename },
  })

  res.status(201).json(document)
}

async function listDocuments(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const documents = await prisma.document.findMany({ where: { dossierId: dossier.id }, orderBy: { createdAt: 'desc' } })
  res.json(documents)
}

async function downloadDocument(req, res) {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } })
  if (!document) return res.status(404).json({ message: 'Document introuvable' })

  const { error, message } = await loadDossierWithAccessCheck(req, document.dossierId)
  if (error) return res.status(error).json({ message })

  const url = await getSignedDownloadUrl(document.storageKey)

  await logAction({
    userId: req.userId,
    action: 'DOCUMENT_DOWNLOAD',
    entityType: 'Document',
    entityId: document.id,
    dossierId: document.dossierId,
  })

  res.json({ url })
}

module.exports = { uploadDocument, listDocuments, downloadDocument }
