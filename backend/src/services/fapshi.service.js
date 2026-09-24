const env = require('../config/env')

/**
 * Fapshi — encaissement par Mobile Money (MTN MoMo, Orange Money) au Cameroun.
 *
 * Deuxième fournisseur à côté de CinetPay, pas un remplaçant : Fapshi ne
 * couvre ni les cartes bancaires ni les autres pays. Il est retenu pour les
 * patients camerounais (acteur local, 3 % par encaissement) et, plus tard,
 * pour reverser les honoraires des spécialistes camerounais (0 % sur les
 * décaissements). Le choix du fournisseur se fait dans le contrôleur, selon le
 * pays du compte patient.
 *
 * Seul le parcours par lien (`/initiate-pay`) est utilisé. L'appel direct
 * (`/direct-pay`, qui pousse la demande sur le téléphone) est désactivé par
 * défaut en production et sa documentation prévient qu'un usage maladroit fait
 * suspendre le compte — rien qui justifie de le prendre pour un MVP.
 *
 * Documentation : https://docs.fapshi.com
 */

const BASES = {
  sandbox: 'https://sandbox.fapshi.com',
  live: 'https://live.fapshi.com',
}

/** Fapshi n'est utilisable que si ses accès sont renseignés. */
function estConfigure() {
  return Boolean(env.fapshi.apiUser && env.fapshi.apiKey)
}

function base() {
  return BASES[env.fapshi.environnement] || BASES.sandbox
}

function entetes() {
  return {
    'Content-Type': 'application/json',
    apiuser: env.fapshi.apiUser,
    apikey: env.fapshi.apiKey,
  }
}

/**
 * Crée un lien de paiement. Fapshi rend son propre `transId` — c'est lui qu'il
 * faut conserver, le webhook et le suivi ne connaissent que celui-là. Notre
 * référence part dans `externalId` pour se retrouver dans leur tableau de bord.
 *
 * Le montant est entier et en XAF : Fapshi n'accepte rien d'autre, et refuse
 * en dessous de 100 XAF. Le lien expire au bout de 24 h.
 */
async function initierPaiement({ amount, email, externalId, message, redirectUrl }) {
  const response = await fetch(`${base()}/initiate-pay`, {
    method: 'POST',
    headers: entetes(),
    body: JSON.stringify({
      amount: Math.round(amount),
      email,
      externalId,
      message,
      redirectUrl: redirectUrl || env.fapshi.redirectUrl,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Fapshi initiate-pay a répondu ${response.status} ${detail.slice(0, 200)}`)
  }

  return response.json()
}

/**
 * Relecture d'une transaction auprès de Fapshi. C'est cet appel qui fait foi
 * pour débloquer un dossier — jamais le corps du webhook seul, qu'un tiers peut
 * forger même en connaissant le secret si celui-ci fuit.
 */
async function statutPaiement(transId) {
  const response = await fetch(`${base()}/payment-status/${encodeURIComponent(transId)}`, {
    method: 'GET',
    headers: entetes(),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Fapshi payment-status a répondu ${response.status} ${detail.slice(0, 200)}`)
  }

  return response.json()
}

/**
 * Le webhook porte un en-tête `x-wh-secret` égal au secret saisi dans le
 * tableau de bord Fapshi. Sans lui, n'importe qui connaissant l'URL pourrait
 * annoncer un paiement. Comparaison à temps constant : une comparaison
 * ordinaire laisse deviner le secret caractère par caractère au chronomètre.
 */
function webhookAuthentique(enteteRecu) {
  const attendu = env.fapshi.webhookSecret
  // Le sandbox Fapshi ne propose pas de secret de webhook : seul l'URL se
  // configure, aucun en-tête x-wh-secret n'est envoyé. Exiger le secret y
  // rejetterait toute notification de test en 401. On l'accepte donc SANS
  // secret en sandbox uniquement - jamais en live, où le champ existe et où
  // ce verrou est obligatoire. Le risque en sandbox est nul : le contrôleur
  // relit toujours le statut auprès de Fapshi avant de confirmer, un webhook
  // forgé ne débloque rien (voir webhookFapshi dans paiements.controller.js).
  if (env.fapshi.environnement === 'sandbox' && !enteteRecu) return true
  if (!attendu || !enteteRecu) return false
  const a = Buffer.from(String(enteteRecu))
  const b = Buffer.from(String(attendu))
  if (a.length !== b.length) return false
  return require('crypto').timingSafeEqual(a, b)
}

/** Le décaissement a ses propres accès (voir env.js). */
function payoutConfigure() {
  return Boolean(env.fapshi.payoutApiUser && env.fapshi.payoutApiKey)
}

/**
 * Envoi d'argent vers un numéro Mobile Money. Désactivé par défaut côté Fapshi
 * en production : il faut le faire activer par leur support après des essais en
 * sandbox. Montant entier en XAF, minimum 100.
 */
async function decaisser({ amount, phone, name, email, externalId, message }) {
  const response = await fetch(`${base()}/payout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apiuser: env.fapshi.payoutApiUser,
      apikey: env.fapshi.payoutApiKey,
    },
    body: JSON.stringify({ amount: Math.round(amount), phone, name, email, externalId, message }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Fapshi payout a répondu ${response.status} ${detail.slice(0, 200)}`)
  }

  return response.json()
}

module.exports = { estConfigure, payoutConfigure, initierPaiement, statutPaiement, decaisser, webhookAuthentique }
