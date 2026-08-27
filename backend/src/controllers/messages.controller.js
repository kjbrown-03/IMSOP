const { prisma } = require('../lib/prisma')
const { putObject } = require('../lib/s3')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
const { v4: uuidv4 } = require('uuid')

const senderSelect = { select: { id: true, fullName: true, role: true, avatarUrl: true } }

// The secure messaging thread is a coordination ↔ specialist channel only.
// The patient and the médecin local never see it: the médecin local hands
// off his one question through poserQuestionMedecinLocal instead (see
// dossiers.controller.js), and the patient has no direct line to the
// specialist at all - everything runs through the coordination team.
const ROLES_MESSAGERIE = new Set(['COORDINATEUR', 'ADMIN', 'SPECIALISTE'])

function conversationInterdite(req, res) {
  if (ROLES_MESSAGERIE.has(req.userRole)) return false
  res.status(403).json({ message: 'La messagerie sécurisée est réservée à la coordination médicale et au spécialiste assigné' })
  return true
}

// The specialist has no single named counterpart on a dossier - any
// coordinateur/admin can be handling it - so a specialist's message notifies
// the whole coordination team. A coordinateur's message, on the other hand,
// has exactly one addressee: the specialist assigned to that dossier.
async function otherParticipants(dossier, senderId, senderRole) {
  if (senderRole === 'SPECIALISTE') {
    const coordination = await prisma.user.findMany({
      where: { role: { in: ['COORDINATEUR', 'ADMIN'] }, active: true },
      select: { id: true, fullName: true, email: true },
    })
    return coordination.filter((u) => u.id !== senderId)
  }
  return [dossier.specialiste?.user].filter((u) => u && u.id !== senderId)
}

function conversationClosed(dossier) {
  return dossier.messagingClosesAt && dossier.messagingClosesAt < new Date()
}

async function listMessages(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })
  if (conversationInterdite(req, res)) return

  const messages = await prisma.message.findMany({
    where: {
      dossierId: dossier.id,
      // Le fil est un canal coordination <-> specialiste, et rien d'autre.
      // Des messages de patients et de medecins locaux subsistent des versions
      // ou la messagerie leur etait ouverte : les rendre ici melangerait deux
      // conversations qui n'ont jamais eu vocation a se croiser, et donnerait
      // au coordinateur des echanges qu'il n'a ni ecrits ni recus.
      sender: { role: { in: [...ROLES_MESSAGERIE] } },
    },
    orderBy: { createdAt: 'asc' },
    include: {
      sender: senderSelect,
      // The storage key stays server-side: the client downloads through
      // /api/documents/:id/download, which re-checks access and signs a short URL.
      document: { select: { id: true, filename: true, mimeType: true, sizeBytes: true, category: true } },
    },
  })

  res.json({ messages, messagingClosesAt: dossier.messagingClosesAt })
}

async function sendMessage(req, res) {
  const { dossier, error, message: err } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message: err })
  if (conversationInterdite(req, res)) return

  if (conversationClosed(dossier)) {
    return res.status(400).json({ message: 'Cette conversation est fermée (14 jours après affectation du dossier).' })
  }

  const { body } = req.body

  const created = await prisma.message.create({
    data: { dossierId: dossier.id, senderId: req.userId, body },
    include: { sender: senderSelect, document: true },
  })

  await logAction({ userId: req.userId, action: 'MESSAGE_ENVOYE', entityType: 'Message', entityId: created.id, dossierId: dossier.id })

  for (const recipient of await otherParticipants(dossier, req.userId, req.userRole)) {
    await notify(recipient.id, recipient.email, 'MESSAGE_RECU', {
      name: recipient.fullName,
      reference: dossier.reference,
      senderName: created.sender.fullName,
      excerpt: body.slice(0, 140),
    }, { dossierId: dossier.id })
  }

  res.status(201).json(created)
}

// An attachment is stored as a full-blown dossier Document, not as a loose blob:
// same bucket, same audit trail, same signed-URL download route. A file dropped
// in the conversation therefore also appears in the dossier the specialist reads.
async function sendAttachment(req, res) {
  const { dossier, error, message: err } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message: err })
  if (conversationInterdite(req, res)) return

  if (conversationClosed(dossier)) {
    return res.status(400).json({ message: 'Cette conversation est fermée (14 jours après affectation du dossier).' })
  }
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' })

  const key = `dossiers/${dossier.id}/${uuidv4()}-${req.file.originalname}`
  await putObject(key, req.file.buffer, req.file.mimetype)

  // Document and Message are written together: a stored blob with no message
  // pointing at it would be invisible in the conversation and orphaned in S3.
  const [document, created] = await prisma.$transaction(async (tx) => {
    const doc = await tx.document.create({
      data: {
        dossierId: dossier.id,
        uploadedById: req.userId,
        category: req.body.category || 'MESSAGERIE',
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        storageKey: key,
      },
    })
    const msg = await tx.message.create({
      data: {
        dossierId: dossier.id,
        senderId: req.userId,
        body: req.body.body || '',
        documentId: doc.id,
      },
      include: {
        sender: senderSelect,
        document: { select: { id: true, filename: true, mimeType: true, sizeBytes: true, category: true } },
      },
    })
    return [doc, msg]
  })

  await logAction({
    userId: req.userId,
    action: 'DOCUMENT_UPLOAD',
    entityType: 'Document',
    entityId: document.id,
    dossierId: dossier.id,
    metadata: { filename: document.filename, via: 'MESSAGERIE', messageId: created.id },
  })

  for (const recipient of await otherParticipants(dossier, req.userId, req.userRole)) {
    await notify(recipient.id, recipient.email, 'PIECE_JOINTE_RECUE', {
      name: recipient.fullName,
      reference: dossier.reference,
      senderName: created.sender.fullName,
      filename: document.filename,
    }, { dossierId: dossier.id })
  }

  res.status(201).json(created)
}

module.exports = { listMessages, sendMessage, sendAttachment }
