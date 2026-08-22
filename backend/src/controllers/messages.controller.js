const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')

async function listMessages(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const messages = await prisma.message.findMany({
    where: { dossierId: dossier.id },
    orderBy: { createdAt: 'asc' },
    include: { sender: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
  })

  res.json({ messages, messagingClosesAt: dossier.messagingClosesAt })
}

async function sendMessage(req, res) {
  const { dossier, error, message: err } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message: err })

  if (dossier.messagingClosesAt && dossier.messagingClosesAt < new Date()) {
    return res.status(400).json({ message: 'Cette conversation est fermée (14 jours après affectation du dossier).' })
  }

  const { body } = req.body

  const created = await prisma.message.create({
    data: { dossierId: dossier.id, senderId: req.userId, body },
    include: { sender: { select: { id: true, fullName: true, role: true, avatarUrl: true } } },
  })

  await logAction({ userId: req.userId, action: 'MESSAGE_ENVOYE', entityType: 'Message', entityId: created.id, dossierId: dossier.id })

  const recipient = req.userRole === 'PATIENT' ? dossier.specialiste?.user : dossier.patient.user
  if (recipient) {
    await notify(
      recipient.id,
      recipient.email,
      'MESSAGE_RECU',
      {
        name: recipient.fullName,
        reference: dossier.reference,
        // Read by the in-app bell to show who wrote and a preview of the message.
        senderName: created.sender.fullName,
        senderRole: created.sender.role,
        excerpt: body.length > 140 ? `${body.slice(0, 140)}…` : body,
      },
      { dossierId: dossier.id },
    )
  }

  res.status(201).json(created)
}

module.exports = { listMessages, sendMessage }
