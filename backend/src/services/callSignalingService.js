const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const env = require('../config/env')
const { prisma } = require('../lib/prisma')

// In-memory only: one process, no cross-instance fanout needed for the MVP's
// 1-to-1 calling. A multi-instance deployment would need this in Redis.
const userSockets = new Map() // userId -> Set<socketId>

function addSocket(userId, socketId) {
  const set = userSockets.get(userId) || new Set()
  set.add(socketId)
  userSockets.set(userId, set)
}

function removeSocket(userId, socketId) {
  const set = userSockets.get(userId)
  if (!set) return
  set.delete(socketId)
  if (set.size === 0) userSockets.delete(userId)
}

// Signaling only relays SDP/ICE data between two browsers — it never sees or
// stores the call's audio/video. But the relay itself must not become an
// "call any user id" primitive, so every invite is checked against a real
// shared dossier first, the same access rule messages already enforce.
async function sharesDossier(dossierId, userIdA, userIdB) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: { patient: true, specialiste: true },
  })
  if (!dossier) return false
  const participants = [dossier.patient?.userId, dossier.specialiste?.userId].filter(Boolean)
  return participants.includes(userIdA) && participants.includes(userIdB)
}

function initCallSignaling(server) {
  const io = new Server(server, {
    path: '/socket.io',
    cors: { origin: env.corsOrigin, credentials: true },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (!token) throw new Error('no token')
      const payload = jwt.verify(token, env.jwt.accessSecret)
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, fullName: true } })
      if (!user) throw new Error('unknown user')
      socket.userId = user.id
      socket.userName = user.fullName
      next()
    } catch {
      next(new Error('Authentification requise'))
    }
  })

  function emitToUser(userId, event, payload) {
    const set = userSockets.get(userId)
    if (!set) return false
    for (const socketId of set) io.to(socketId).emit(event, payload)
    return true
  }

  io.on('connection', (socket) => {
    addSocket(socket.userId, socket.id)

    socket.on('call:invite', async ({ dossierId, toUserId }) => {
      if (!dossierId || !toUserId) return
      if (!(await sharesDossier(dossierId, socket.userId, toUserId))) return
      const delivered = emitToUser(toUserId, 'call:invite', {
        dossierId,
        fromUserId: socket.userId,
        fromName: socket.userName,
      })
      if (!delivered) socket.emit('call:unavailable', { dossierId, toUserId })
    })

    socket.on('call:accept', ({ dossierId, toUserId }) => {
      if (!dossierId || !toUserId) return
      emitToUser(toUserId, 'call:accept', { dossierId, fromUserId: socket.userId })
    })

    socket.on('call:decline', ({ dossierId, toUserId }) => {
      if (!dossierId || !toUserId) return
      emitToUser(toUserId, 'call:decline', { dossierId, fromUserId: socket.userId })
    })

    // SDP offers/answers and ICE candidates all flow through this one relay —
    // `data` is opaque to the server, it only routes it to the right peer.
    socket.on('call:signal', ({ toUserId, data }) => {
      if (!toUserId) return
      emitToUser(toUserId, 'call:signal', { fromUserId: socket.userId, data })
    })

    socket.on('call:end', ({ dossierId, toUserId }) => {
      if (!toUserId) return
      emitToUser(toUserId, 'call:end', { dossierId, fromUserId: socket.userId })
    })

    socket.on('disconnect', () => {
      removeSocket(socket.userId, socket.id)
    })
  })

  return io
}

module.exports = { initCallSignaling }
