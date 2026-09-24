const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')

/**
 * Discussions directes, hors dossier.
 *
 * La messagerie était entièrement accrochée à un dossier : la liste des
 * contacts se déduisait de `GET /dossiers`. Un praticien tout juste recruté, à
 * qui rien n'est encore affecté, n'apparaissait donc nulle part — et personne
 * ne pouvait lui écrire pour l'accueillir, lui demander ses disponibilités ou
 * préparer une affectation.
 *
 * La coordination est le pivot : elle ouvre une discussion avec un spécialiste
 * ou un médecin traitant, qui peut répondre. Deux praticiens ne s'écrivent
 * jamais entre eux — c'est la même règle que sur les fils de dossiers, et elle
 * est ce qui garde la coordination au courant de tout.
 */

const senderSelect = { select: { id: true, fullName: true, role: true, avatarUrl: true } }
const participantSelect = { id: true, fullName: true, role: true, avatarUrl: true, email: true }

const ROLES_COORDINATION = new Set(['COORDINATEUR', 'ADMIN'])
const ROLES_PRATICIEN = new Set(['SPECIALISTE', 'MEDECIN_LOCAL'])

// La paire est rangée par identifiant croissant : (A,B) et (B,A) désignent la
// même discussion, et c'est l'index unique qui l'impose en base.
const paireOrdonnee = (x, y) => (x < y ? [x, y] : [y, x])

function autreParticipant(conversation, userId) {
  return conversation.participantAId === userId ? conversation.participantB : conversation.participantA
}

/**
 * Qui a le droit d'ouvrir une discussion avec qui.
 *
 * Seule la coordination initie. Un praticien qui pourrait ouvrir un fil avec
 * n'importe qui contournerait la règle du pivot sans qu'on s'en aperçoive.
 */
function ouvertureInterdite(role, roleCible) {
  if (!ROLES_COORDINATION.has(role)) {
    return 'Seule la coordination médicale peut ouvrir une discussion'
  }
  if (!ROLES_PRATICIEN.has(roleCible)) {
    return 'Une discussion ne peut être ouverte qu\'avec un spécialiste ou un médecin traitant'
  }
  return null
}

/** Liste des discussions du compte connecté, la plus récente en tête. */
async function lister(req, res) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ participantAId: req.userId }, { participantBId: req.userId }] },
    include: {
      participantA: { select: participantSelect },
      participantB: { select: participantSelect },
      // Le dernier message sert de résumé dans la liste : le charger ici évite
      // une requête par discussion depuis l'écran.
      messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: senderSelect } },
    },
    orderBy: { updatedAt: 'desc' },
  })

  res.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      correspondant: autreParticipant(c, req.userId),
      dernierMessage: c.messages[0] || null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  })
}

/**
 * Ouvre une discussion, ou rend celle qui existe déjà.
 *
 * Idempotent volontairement : le coordinateur qui cherche un nom deux fois ne
 * doit pas se retrouver avec deux fils, et l'écran n'a pas à savoir lequel des
 * deux cas il déclenche.
 */
async function ouvrir(req, res) {
  const { destinataireId } = req.body

  if (destinataireId === req.userId) {
    return res.status(400).json({ message: 'On ne peut pas ouvrir une discussion avec soi-même' })
  }

  const destinataire = await prisma.user.findUnique({
    where: { id: destinataireId },
    select: { ...participantSelect, active: true },
  })
  if (!destinataire) return res.status(404).json({ message: 'Compte introuvable' })
  if (!destinataire.active) {
    return res.status(409).json({ message: 'Ce compte est suspendu' })
  }

  const refus = ouvertureInterdite(req.userRole, destinataire.role)
  if (refus) return res.status(403).json({ message: refus })

  const [participantAId, participantBId] = paireOrdonnee(req.userId, destinataireId)

  const existante = await prisma.conversation.findUnique({
    where: { participantAId_participantBId: { participantAId, participantBId } },
  })
  if (existante) return res.json({ id: existante.id, correspondant: destinataire, deja: true })

  const conversation = await prisma.conversation.create({
    data: { participantAId, participantBId, creeParId: req.userId },
  })

  await logAction({
    userId: req.userId,
    action: 'DISCUSSION_OUVERTE',
    entityType: 'Conversation',
    entityId: conversation.id,
    metadata: { destinataireId },
    ipAddress: req.ip,
  })

  res.status(201).json({ id: conversation.id, correspondant: destinataire, deja: false })
}

/** Charge la discussion en vérifiant que l'appelant en fait partie. */
async function chargerAvecAcces(id, userId) {
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: {
      participantA: { select: participantSelect },
      participantB: { select: participantSelect },
    },
  })
  if (!conversation) return { erreur: 404, message: 'Discussion introuvable' }
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) {
    // 404 et non 403 : confirmer l'existence d'une discussion entre deux tiers
    // est déjà une fuite.
    return { erreur: 404, message: 'Discussion introuvable' }
  }
  return { conversation }
}

async function listerMessages(req, res) {
  const { conversation, erreur, message } = await chargerAvecAcces(req.params.id, req.userId)
  if (erreur) return res.status(erreur).json({ message })

  const messages = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'asc' },
    include: { sender: senderSelect },
  })

  // Ce que l'autre a écrit est lu par le fait même de l'ouvrir.
  await prisma.message.updateMany({
    where: { conversationId: conversation.id, senderId: { not: req.userId }, readAt: null },
    data: { readAt: new Date() },
  })

  res.json({ messages, correspondant: autreParticipant(conversation, req.userId) })
}

async function envoyerMessage(req, res) {
  const { conversation, erreur, message } = await chargerAvecAcces(req.params.id, req.userId)
  if (erreur) return res.status(erreur).json({ message })

  const { body } = req.body
  const destinataire = autreParticipant(conversation, req.userId)

  const cree = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: req.userId, body },
    include: { sender: senderSelect },
  })

  // `updatedAt` porte le tri de la liste : sans cette écriture, une discussion
  // active resterait au fond.
  await prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } })

  await logAction({
    userId: req.userId,
    action: 'MESSAGE_DIRECT_ENVOYE',
    entityType: 'Message',
    entityId: cree.id,
    metadata: { conversationId: conversation.id },
  })

  await notify(destinataire.id, destinataire.email, 'MESSAGE_RECU', {
    name: destinataire.fullName,
    reference: 'discussion directe',
    senderName: cree.sender.fullName,
    excerpt: body.slice(0, 140),
  })

  res.status(201).json(cree)
}

/**
 * Recherche des praticiens à qui la coordination peut écrire.
 *
 * C'est ce que remplit la barre de recherche de la messagerie : on y saisit un
 * nom, on obtient les comptes correspondants, on ouvre la discussion. Sans
 * cette recherche, seuls les praticiens déjà rattachés à un dossier étaient
 * atteignables.
 */
async function rechercherDestinataires(req, res) {
  if (!ROLES_COORDINATION.has(req.userRole)) {
    return res.status(403).json({ message: 'Réservé à la coordination médicale' })
  }

  const q = (req.query.q || '').trim()
  const utilisateurs = await prisma.user.findMany({
    where: {
      role: { in: [...ROLES_PRATICIEN] },
      active: true,
      ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    select: { ...participantSelect, specialiste: { select: { specialite: true } }, medecinLocal: { select: { specialite: true, ville: true } } },
    orderBy: { fullName: 'asc' },
    take: 20,
  })

  res.json({
    utilisateurs: utilisateurs.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      role: u.role,
      avatarUrl: u.avatarUrl,
      specialite: u.specialiste?.specialite || u.medecinLocal?.specialite || null,
      ville: u.medecinLocal?.ville || null,
    })),
  })
}

module.exports = { lister, ouvrir, listerMessages, envoyerMessage, rechercherDestinataires }
