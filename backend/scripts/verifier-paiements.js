#!/usr/bin/env node
/**
 * Vérifie la configuration de paiement sans encaisser un centime.
 *
 * Mettre des clés dans un fichier ne dit pas qu'elles fonctionnent. Ce script
 * interroge réellement Fapshi : il crée un lien de paiement de 100 XAF (le
 * minimum accepté), relit son statut, et s'arrête là. Aucun téléphone n'est
 * sollicité, aucun montant n'est prélevé — un lien non ouvert expire seul au
 * bout de 24 h.
 *
 * Usage :  node scripts/verifier-paiements.js
 */
const env = require('../src/config/env')
const fapshi = require('../src/services/fapshi.service')

const ok = (m) => console.log(`  OK    ${m}`)
const ko = (m) => console.log(`  ÉCHEC ${m}`)
const info = (m) => console.log(`        ${m}`)

async function main() {
  console.log('')
  console.log('--- Configuration déclarée ---')
  info(`Environnement Fapshi : ${env.fapshi.environnement}`)
  info(`API user renseigné   : ${env.fapshi.apiUser ? 'oui' : 'NON'}`)
  info(`API key renseignée   : ${env.fapshi.apiKey ? 'oui' : 'NON'}`)
  info(`Secret de webhook    : ${env.fapshi.webhookSecret ? 'oui' : 'non'}`)
  info(`URL de retour        : ${env.fapshi.redirectUrl || '(vide)'}`)
  info(`Tarif mise en relation : ${env.tarifs.ANNUAIRE} ${env.tarifs.devise}`)
  console.log('')

  if (!fapshi.estConfigure()) {
    ko('Fapshi n\'est pas configuré : FAPSHI_API_USER et FAPSHI_API_KEY sont requis.')
    info('Sans eux, la plateforme bascule sur CinetPay — dont les clés sont vides aussi,')
    info('et tout paiement échouera avec « service de paiement indisponible ».')
    process.exitCode = 1
    return
  }

  // Le secret de webhook n'existe pas en sandbox : ce n'est un manque qu'en live.
  if (env.fapshi.environnement === 'live' && !env.fapshi.webhookSecret) {
    ko('FAPSHI_WEBHOOK_SECRET est vide alors que FAPSHI_ENV vaut « live ».')
    info('Un webhook non authentifié serait refusé : aucun paiement ne se confirmerait.')
    process.exitCode = 1
    return
  }

  console.log('--- Appel réel à Fapshi ---')
  let lien
  try {
    lien = await fapshi.initierPaiement({
      amount: 100,
      email: 'verification@imsop.org',
      externalId: `IMSOP-VERIF-${Date.now()}`,
      message: 'Vérification technique IMSOP — ne pas payer',
    })
    ok(`Lien de paiement créé (transId ${lien.transId})`)
    info(lien.link)
  } catch (err) {
    ko(`Création du lien refusée : ${err.message}`)
    info('Cause la plus fréquente : des clés de bac à sable avec FAPSHI_ENV=live,')
    info('ou l\'inverse. Les deux environnements ont des clés distinctes.')
    process.exitCode = 1
    return
  }

  try {
    const statut = await fapshi.statutPaiement(lien.transId)
    ok(`Relecture du statut : ${statut.status}`)
    info('« CREATED » est le résultat attendu : le lien existe et personne ne l\'a payé.')
  } catch (err) {
    ko(`Relecture impossible : ${err.message}`)
    info('C\'est cet appel qui fait foi pour débloquer un dossier. S\'il échoue,')
    info('aucun paiement ne sera jamais confirmé, même réglé par le patient.')
    process.exitCode = 1
    return
  }

  console.log('')
  console.log('--- Il reste à faire chez Fapshi ---')
  const base = (env.publicUrl || '').replace(/\/+$/, '')
  info(`Déclarer l'URL de webhook : ${base}/api/paiements/webhook/fapshi`)
  if (env.fapshi.environnement === 'live') {
    info('Et y saisir le même secret que FAPSHI_WEBHOOK_SECRET.')
  }
  console.log('')
}

main().catch((err) => {
  console.error('Échec inattendu :', err)
  process.exitCode = 1
})
