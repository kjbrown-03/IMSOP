const { prisma } = require('../lib/prisma')

// The stored payload doubles as the e-mail template context, so it can hold
// secrets (verification codes, reset links). Only the keys the bell actually
// renders are echoed back over HTTP.
const PUBLIC_PAYLOAD_KEYS = ['name', 'reference', 'senderName', 'senderRole', 'excerpt', 'reason']

function publicPayload(payload) {
  if (!payload || typeof payload !== 'object') return {}
  return Object.fromEntries(
    PUBLIC_PAYLOAD_KEYS.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]),
  )
}

function serialize(notification) {
  return {
    id: notification.id,
    type: notification.type,
    dossierId: notification.dossierId,
    dossierReference: notification.dossier?.reference ?? null,
    payload: publicPayload(notification.payload),
    readAt: notification.readAt,
    sentAt: notification.sentAt,
  }
}

async function unreadCountFor(userId) {
  return prisma.notification.count({ where: { userId, readAt: null } })
}

async function listNotifications(req, res) {
  const { page, pageSize } = req.query

  const [items, unreadCount] = await prisma.$transaction([
    prisma.notification.findMany({
      where: { userId: req.userId },
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { dossier: { select: { reference: true } } },
    }),
    prisma.notification.count({ where: { userId: req.userId, readAt: null } }),
  ])

  res.json({ items: items.map(serialize), unreadCount, page, pageSize })
}

async function markRead(req, res) {
  // Scoping the write by userId as well as id means one account can never flip
  // another account's notifications, even with a guessed identifier.
  const { count } = await prisma.notification.updateMany({
    where: { id: req.params.id, userId: req.userId, readAt: null },
    data: { readAt: new Date() },
  })

  if (count === 0) {
    const owned = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    })
    // Nothing updated and nothing owned: the id belongs to someone else or
    // does not exist. Already-read rows fall through as a no-op success.
    if (!owned) return res.status(404).json({ message: 'Notification introuvable' })
  }

  res.json({ unreadCount: await unreadCountFor(req.userId) })
}

async function markAllRead(req, res) {
  await prisma.notification.updateMany({
    where: { userId: req.userId, readAt: null },
    data: { readAt: new Date() },
  })

  res.json({ unreadCount: 0 })
}

module.exports = { listNotifications, markRead, markAllRead }
