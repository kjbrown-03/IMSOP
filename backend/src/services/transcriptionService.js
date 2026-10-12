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

// Phrases que le modele produit quand il n'entend pas de parole claire. Elles
// viennent de ses donnees d'entrainement — des sous-titres de videos — et non de
// l'enregistrement. Le filtre VAD en supprime la plupart, mais un murmure ou un
// bruit de fond rythme passe parfois au travers, et le patient voit alors
// s'inscrire une phrase qu'il n'a jamais dite. Mieux vaut lui dire qu'on n'a
// rien compris.
//
// La comparaison se fait sur un texte sans accent ni ponctuation : le modele
// ponctue de facon variable.
// Phrases exactes : des mots isoles que le modele lache quand il n'entend rien.
// Compares a l'identique, car « merci » seul est du bruit alors que « merci,
// j'ai mal au ventre » est une vraie description.
const HALLUCINATIONS_EXACTES = new Set([
  '', 'you', 'merci', 'merci beaucoup', 'thank you', 'thanks', 'bye', 'ok', 'oui', 'non',
])

// Fragments distinctifs : ils viennent des sous-titres de videos vus a
// l'entrainement, jamais d'un patient qui decrit sa douleur. Compares par
// inclusion, car le modele ajoute parfois un bout de phrase autour.
const HALLUCINATIONS_FRAGMENTS = [
  'amara org',
  'sous titrage societe radio canada',
  'sous titres realises par',
  'merci d avoir regarde cette video',
  'abonnez vous a la chaine',
  'thanks for watching',
  'thank you for watching',
  'subtitles by',
]

function normaliserPourComparaison(texte) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // L'apostrophe et la ponctuation deviennent des espaces : « d'Amara » et
    // « d Amara » doivent se comparer de la meme facon.
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function estHallucination(texte) {
  const nu = normaliserPourComparaison(texte)
  if (HALLUCINATIONS_EXACTES.has(nu)) return true
  return HALLUCINATIONS_FRAGMENTS.some((f) => nu.includes(f))
}

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
      // Détection de parole : les passages sans voix sont retirés avant la
      // transcription.
      //
      // Sans ce filtre, le modèle INVENTE du texte quand il n'entend rien. Un
      // enregistrement de trois secondes de silence ressortait « You », et un
      // patient a vu s'inscrire « Sous-titres réalisés par la communauté
      // d'Amara.org » — une phrase vue à l'entraînement sur des sous-titres.
      // Vérifié : avec le filtre, le même silence ressort vide, ce que la
      // couche au-dessus traduit par « aucune parole reconnue ».
      vad_filter: 'true',
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
    const texte = (donnees.text || '').trim()

    // Une phrase inventee vaut moins que rien : elle a l'air d'une vraie
    // reponse. On renvoie du vide, que l'appelant traduit en « aucune parole
    // reconnue », ce qui invite a reessayer au lieu d'induire en erreur.
    return {
      texte: estHallucination(texte) ? '' : texte,
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

module.exports = { transcrire, occupe, estHallucination }
