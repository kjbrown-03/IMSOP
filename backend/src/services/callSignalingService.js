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
// "call any user id" primitive, so every invite is checked first.
//
// La regle est celle de la messagerie, et pas une autre : coordination <->
// specialiste assigne (voir ROLES_MESSAGERIE dans messages.controller.js).
// L'ancienne version verifiait l'appartenance a la liste patient / specialiste
// / medecin local — liste dont les coordinateurs sont absents, alors qu'ils
// sont le seul role dont l'interface propose d'appeler. Toute invitation
// partait donc en NON_AUTORISE et n'atteignait jamais le destinataire.
const ROLES_COORDINATION = ['COORDINATEUR', 'ADMIN']

// Journalise la raison exacte d'un refus : sans ça, un appel bloque a tort
// n'affichait cote serveur qu'un evenement 'call:rejected' muet, impossible a
// diagnostiquer sans acces direct a la base.
function refuser(motif, contexte) {
  console.warn(`[call] invitation refusee (${motif})`, contexte)
  return false
}

async function appelAutorise(dossierId, userIdA, userIdB) {
  const contexte = { dossierId, userIdA, userIdB }
  if (!userIdA || !userIdB || userIdA === userIdB) {
    return refuser('identifiants invalides', contexte)
  }

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    select: { specialiste: { select: { userId: true } } },
  })
  // Sans specialiste assigne, il n'y a pas encore de canal a ouvrir.
  if (!dossier?.specialiste?.userId) {
    return refuser('dossier introuvable ou sans specialiste assigne', contexte)
  }

  const specialisteUserId = dossier.specialiste.userId

  // Un des deux doit etre le specialiste du dossier ; l'autre, un membre actif
  // de la coordination. C'est ce qui empeche d'appeler un identifiant au hasard.
  let autre = null
  if (userIdA === specialisteUserId) autre = userIdB
  else if (userIdB === specialisteUserId) autre = userIdA
  else return refuser('aucun des deux comptes ne correspond au specialiste du dossier', { ...contexte, specialisteUserId })

  const compte = await prisma.user.findUnique({
    where: { id: autre },
    select: { role: true, active: true },
  })
  if (!compte) return refuser("le compte de l'autre partie est introuvable", { ...contexte, autre })
  if (!compte.active) return refuser("le compte de l'autre partie est desactive", { ...contexte, autre })
  if (!ROLES_COORDINATION.includes(compte.role)) {
    return refuser("l'autre partie n'est ni coordinateur ni admin", { ...contexte, autre, role: compte.role })
  }
  return true
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
      if (!dossierId || !toUserId) {
        return socket.emit('call:rejected', { motif: 'REQUETE_INVALIDE' })
      }
      if (!(await appelAutorise(dossierId, socket.userId, toUserId))) {
        // Refuser sans rien dire laissait l'interface sonner dans le vide.
        return socket.emit('call:rejected', { dossierId, toUserId, motif: 'NON_AUTORISE' })
      }
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

// appelAutorise est exporte pour etre verifiable seul : c'est la regle
// d'autorisation des appels, elle merite un test sans ouvrir de socket.
module.exports = { initCallSignaling, appelAutorise }
