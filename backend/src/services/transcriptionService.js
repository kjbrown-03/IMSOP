const env = require('../config/env')

/**
 * Transcription des messages vocaux décrivant des symptômes.
 *
 * POURQUOI LA TRANSCRIPTION EST LOCALE
 *
 * Un enregistrement où quelqu'un décrit sa maladie est une donnée de santé. Le
 * confier à un service tiers aurait voulu dire faire sortir cette donnée du
 * serveur, l'annoncer dans la politique de confidentialité, et la faire accepter
 * au patient. Le moteur tourne donc dans la même pile Docker, sans port publié :
 * l'audio ne quitte jamais la machine.
 *
 * L'audio n'est d'ailleurs jamais écrit : multer le garde en mémoire, il part
 * vers le moteur, et seul le texte subsiste.
 *
 * POURQUOI UN VERROU DE CONCURRENCE
 *
 * Le VPS a deux cœurs, et l'application tourne dessus. La transcription est la
 * seule opération de la plateforme qui consomme un cœur entier pendant plusieurs
 * secondes. Sans limite, une poignée d'enregistrements simultanés — ou un seul
 * visiteur malveillant qui boucle — rendrait le site inutilisable pour tout le
 * monde, alors que la recherche vocale n'est qu'un confort.
 *
 * On refuse donc poliment au-delà d'une transcription à la fois, plutôt que
 * d'accepter tout le monde et de servir tout le monde mal.
 */

// Le point d'entrée public est limité par IP (voir rateLimit.js). Ce verrou-ci
// est global : il protège le processeur, pas l'équité entre visiteurs.
let enCours = 0

function occupe() {
  return enCours >= env.transcription.simultaneesMax
}

async function transcrire(mémoire, nomFichier, typeMime, langue) {
  if (occupe()) {
    const err = new Error('Service de transcription occupé')
    err.status = 503
    throw err
  }

  enCours += 1
  try {
    const formulaire = new FormData()
    formulaire.append('audio_file', new Blob([mémoire], { type: typeMime }), nomFichier)

    const parametres = new URLSearchParams({
      task: 'transcribe',
      output: 'json',
      // Le moteur sait réencoder les formats que les navigateurs produisent
      // (WebM, MP4, Ogg) : sans ça il n'accepterait que du WAV brut.
      encode: 'true',
    })
    // Sans langue imposée, le moteur la détecte. On ne l'impose que si l'appelant
    // l'a choisie : une détection automatique vaut mieux qu'un mauvais choix,
    // puisque les patients décrivent leur mal en français comme en anglais.
    if (langue) parametres.set('language', langue)

    const minuteur = AbortSignal.timeout(env.transcription.delaiMaxMs)
    const reponse = await fetch(`${env.transcription.url}/asr?${parametres}`, {
      method: 'POST',
      body: formulaire,
      signal: minuteur,
    })

    if (!reponse.ok) {
      const err = new Error(`Le moteur de transcription a répondu ${reponse.status}`)
      err.status = 502
      throw err
    }

    const donnees = await reponse.json()
    return {
      texte: (donnees.text || '').trim(),
      langue: donnees.language || null,
    }
  } catch (err) {
    // Un dépassement de délai se présente comme une erreur d'abandon : on la
    // traduit, sinon l'appelant reçoit « TimeoutError » sans savoir quoi en dire.
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      const delai = new Error('La transcription a pris trop de temps')
      delai.status = 504
      throw delai
    }
    throw err
  } finally {
    enCours -= 1
  }
}

module.exports = { transcrire, occupe }
