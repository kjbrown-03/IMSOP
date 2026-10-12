const crypto = require('crypto')
const env = require('../config/env')

/**
 * Serveurs ICE pour les appels audio/vidéo.
 *
 * POURQUOI CE POINT D'ENTRÉE EXISTE
 *
 * La liste pourrait être écrite en dur dans le frontend — elle l'était. Ça ne
 * tient plus dès qu'on ajoute TURN : un serveur de relais demande des
 * identifiants, et tout ce qui est dans le bundle est public. Des identifiants
 * permanents y seraient lus en quelques secondes, et n'importe qui ferait
 * transiter son trafic par le serveur, à notre charge.
 *
 * coturn répond à ça avec des identifiants à durée de vie limitée (la « REST
 * API » de la RFC 7635) : le nom d'utilisateur est une date d'expiration, le mot
 * de passe en est le HMAC avec un secret que seuls coturn et ce backend
 * connaissent. coturn n'a aucune base d'utilisateurs à tenir, il recalcule le
 * HMAC et compare. Un identifiant intercepté expire tout seul.
 *
 * La route est authentifiée : seul un compte connecté obtient de quoi relayer.
 */
function identifiantsTurn(userId) {
  const expiration = Math.floor(Date.now() / 1000) + env.webrtc.turnTtlSeconds

  // Le nom d'utilisateur DOIT commencer par l'horodatage d'expiration : c'est
  // lui que coturn relit pour savoir si l'identifiant est encore valable. Ce qui
  // suit est libre, et sert ici à retrouver l'appelant dans les journaux.
  const username = `${expiration}:${userId}`
  const credential = crypto
    .createHmac('sha1', env.webrtc.turnSecret)
    .update(username)
    .digest('base64')

  return { username, credential }
}

function listerServeursIce(req, res) {
  const serveurs = env.webrtc.stunUrls.map((urls) => ({ urls }))

  // Sans TURN configuré on renvoie STUN seul plutôt qu'une erreur : l'appel
  // reste possible entre deux réseaux accommodants, et le développement n'a pas
  // besoin d'un relais. C'est exactement le comportement d'avant.
  if (env.webrtc.turnUrls.length > 0 && env.webrtc.turnSecret) {
    const { username, credential } = identifiantsTurn(req.user.id)
    serveurs.push({ urls: env.webrtc.turnUrls, username, credential })
  }

  res.json({
    iceServers: serveurs,
    // Le frontend s'en sert pour redemander la liste avant expiration plutôt
    // qu'au milieu d'un appel.
    expiresIn: env.webrtc.turnTtlSeconds,
    relaisDisponible: env.webrtc.turnUrls.length > 0 && Boolean(env.webrtc.turnSecret),
  })
}

module.exports = { listerServeursIce }
