const fs = require('fs')
const path = require('path')
const env = require('../config/env')

// Même fichier que le mailer : en développement, tout ce que la plateforme
// « envoie » se relit au même endroit, quel que soit le canal.
const DEV_OUTBOX_PATH = path.join(__dirname, '..', '..', '.dev-mailbox.log')

/**
 * Numéro au format E.164, seul format accepté par les passerelles SMS.
 *
 * Les numéros sont saisis à la main dans les profils : « 6 99 00 00 00 »,
 * « 00237699000000 », « +237 699 00 00 00 » désignent le même abonné. Sans
 * normalisation, la passerelle rejette la plupart d'entre eux.
 *
 * Un numéro déjà international est respecté tel quel ; un numéro local est
 * préfixé par l'indicatif par défaut, celui du pays d'exploitation.
 */
function normaliserNumero(numero, indicatifParDefaut = env.sms.indicatifParDefaut) {
  if (!numero) return null

  const nettoye = String(numero).replace(/[\s.\-()]/g, '')
  if (!nettoye) return null

  // « 00 » est le préfixe international dans la plupart des pays d'exploitation,
  // « + » sa forme canonique.
  const international = nettoye.startsWith('+')
    ? nettoye.slice(1)
    : nettoye.startsWith('00')
      ? nettoye.slice(2)
      : null

  const chiffres = (international ?? nettoye).replace(/\D/g, '')
  if (!chiffres) return null

  if (international) return `+${chiffres}`
  // Un numéro local commence souvent par un 0 de service, qui saute une fois
  // l'indicatif pays posé.
  return `+${indicatifParDefaut}${chiffres.replace(/^0+/, '')}`
}

/**
 * Envoi d'un SMS.
 *
 * Aucune passerelle n'est câblée en dur : `SMS_API_URL` reçoit un POST JSON, ce
 * qui couvre la plupart des agrégateurs de la zone. Twilio est mal placé sur
 * l'Afrique centrale, en couverture comme en tarif — le choix reste donc une
 * décision d'exploitation, pas une dépendance du code.
 *
 * Sans URL configurée hors production, on se contente de journaliser, comme le
 * mailer : la fonctionnalité reste testable sans contrat opérateur. En
 * production, l'absence de configuration doit au contraire se voir.
 */
async function sendSms({ to, body }) {
  const numero = normaliserNumero(to)
  if (!numero) return { skipped: true, raison: 'numero-absent' }

  if (!env.sms.apiUrl) {
    if (env.nodeEnv === 'production') {
      throw new Error("SMS_API_URL n'est pas configuré : aucun SMS ne peut partir")
    }
    // La suite de tests déclenche des notifications à presque chaque requête :
    // tout écrire noierait le rapport et ferait grossir le fichier à chaque run.
    if (env.nodeEnv === 'test') return { skipped: true }

    const entree = `[${new Date().toISOString()}] SMS to: ${numero}\n${body}\n---\n`
    console.log(`[sms:dev] To: ${numero}\n${body}`)
    try {
      fs.appendFileSync(DEV_OUTBOX_PATH, entree)
    } catch {
      // Journalisation de confort : son échec ne doit rien interrompre.
    }
    return { skipped: true }
  }

  const reponse = await fetch(env.sms.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(env.sms.apiToken ? { Authorization: `Bearer ${env.sms.apiToken}` } : {}),
    },
    body: JSON.stringify({ to: numero, from: env.sms.expediteur, message: body }),
  })

  if (!reponse.ok) {
    const detail = await reponse.text().catch(() => '')
    throw new Error(`Envoi SMS refusé (${reponse.status}) ${detail.slice(0, 200)}`)
  }

  return { sent: true }
}

module.exports = { sendSms, normaliserNumero }
