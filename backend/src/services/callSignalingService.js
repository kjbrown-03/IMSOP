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

// Duree de vie d'une invitation restee sans reponse. Le client abandonne au
// bout de 30 s ; on garde de la marge pour qu'un « accepter » un peu tardif ne
// soit pas refuse a tort.
const TTL_INVITATION_MS = 60_000

/**
 * Registre des appels autorises.
 *
 * `appelAutorise` ne protegeait que l'invitation. Tous les autres evenements
 * - acceptation, refus, SDP/ICE, raccrochage - relayaient vers n'importe quel
 * `toUserId` fourni par le client : n'importe quel compte connecte pouvait
 * donc pousser une offre WebRTC a n'importe quel utilisateur de la plateforme,
 * sans dossier commun et sans que personne ait appele.
 *
 * Une invitation autorisee ouvre desormais une session entre les deux comptes,
 * et c'est l'existence de cette session que verifient les evenements suivants.
 * La cle est la paire triee : les deux sens designent la meme entree.
 */
function creerRegistreAppels() {
  const sessions = new Map()
  const cle = (a, b) => [a, b].sort().join('|')

  function trouver(a, b) {
    const k = cle(a, b)
    const session = sessions.get(k)
    if (!session) return null
    // Une invitation jamais acceptee finit par etre oubliee, sinon le registre
    // grossirait a chaque appel sans reponse.
    if (!session.acceptee && Date.now() - session.ouverteA > TTL_INVITATION_MS) {
      sessions.delete(k)
      return null
    }
    return session
  }

  return {
    trouver,

    ouvrir(initiateur, invite, dossierId) {
      sessions.set(cle(initiateur, invite), {
        dossierId,
        initiateur,
        invite,
        acceptee: false,
        ouverteA: Date.now(),
      })
    },

    // Seul le destinataire de l'invitation peut l'accepter ou la refuser :
    // sans cette verification, l'appelant pourrait « accepter » son propre
    // appel et declencher la negociation sans que l'autre ait rien fait.
    marquerAcceptee(session) {
      session.acceptee = true
    },

    fermer(a, b) {
      sessions.delete(cle(a, b))
    },

    // Deconnexion : on rend la liste des correspondants pour pouvoir les
    // prevenir, sinon leur ecran reste bloque sur « appel en cours ».
    fermerTout(userId) {
      const correspondants = []
      for (const [k, session] of sessions) {
        if (session.initiateur !== userId && session.invite !== userId) continue
        correspondants.push({
          userId: session.initiateur === userId ? session.invite : session.initiateur,
          dossierId: session.dossierId,
        })
        sessions.delete(k)
      }
      return correspondants
    },
  }
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
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, fullName: true, active: true } })
      // Même règle que le middleware HTTP : un compte désactivé ne doit pas
      // garder un canal d'appel ouvert.
      if (!user || !user.active) throw new Error('unknown or inactive user')
      socket.userId = user.id
      socket.userName = user.fullName
      next()
    } catch {
      next(new Error('Authentification requise'))
    }
  })

  const registre = creerRegistreAppels()

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
      if (!delivered) return socket.emit('call:unavailable', { dossierId, toUserId })

      // C'est cette session qui autorisera les evenements suivants : sans
      // invitation acceptee par le controle d'acces, rien ne passe.
      registre.ouvrir(socket.userId, toUserId, dossierId)
    })

    socket.on('call:accept', ({ dossierId, toUserId }) => {
      if (!dossierId || !toUserId) return
      const session = registre.trouver(socket.userId, toUserId)
      // Seul le destinataire de l'invitation accepte.
      if (!session || session.invite !== socket.userId) return
      registre.marquerAcceptee(session)
      emitToUser(toUserId, 'call:accept', { dossierId, fromUserId: socket.userId })
    })

    socket.on('call:decline', ({ dossierId, toUserId }) => {
      if (!dossierId || !toUserId) return
      const session = registre.trouver(socket.userId, toUserId)
      if (!session || session.invite !== socket.userId) return
      registre.fermer(socket.userId, toUserId)
      emitToUser(toUserId, 'call:decline', { dossierId, fromUserId: socket.userId })
    })

    // SDP offers/answers and ICE candidates all flow through this one relay —
    // `data` is opaque to the server, it only routes it to the right peer.
    // Le relais n'est ouvert qu'entre deux comptes ayant un appel en cours :
    // c'est ce qui empeche d'en faire un « pousser du WebRTC a n'importe qui ».
    socket.on('call:signal', ({ toUserId, data }) => {
      if (!toUserId) return
      if (!registre.trouver(socket.userId, toUserId)) return
      emitToUser(toUserId, 'call:signal', { fromUserId: socket.userId, data })
    })

    socket.on('call:end', ({ dossierId, toUserId }) => {
      if (!toUserId) return
      if (!registre.trouver(socket.userId, toUserId)) return
      registre.fermer(socket.userId, toUserId)
      emitToUser(toUserId, 'call:end', { dossierId, fromUserId: socket.userId })
    })

    socket.on('disconnect', () => {
      removeSocket(socket.userId, socket.id)

      // Un onglet ferme en pleine conversation laissait l'autre bloque sur
      // « appel en cours » jusqu'a ce qu'il raccroche lui-meme.
      if (userSockets.has(socket.userId)) return
      for (const { userId, dossierId } of registre.fermerTout(socket.userId)) {
        emitToUser(userId, 'call:end', { dossierId, fromUserId: socket.userId })
      }
    })
  })

  return io
}

// appelAutorise est exporte pour etre verifiable seul : c'est la regle
// d'autorisation des appels, elle merite un test sans ouvrir de socket.
module.exports = { initCallSignaling, appelAutorise, creerRegistreAppels }
