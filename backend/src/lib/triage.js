const { SPECIALITES_LOCALES } = require('./specialitesLocales')

/**
 * Triage des symptômes pour l'annuaire « Trouver un médecin ».
 *
 * Deux sorties, dans cet ordre de priorité :
 *
 *   1. `urgence` — un drapeau rouge (douleur thoracique, signes d'AVC, perte de
 *      connaissance, hémorragie, idées suicidaires…) ferme la vente : on ne
 *      propose pas d'acheter un annuaire à quelqu'un qui doit appeler les
 *      secours. C'est le §29 du cahier des charges, et ici il n'est pas
 *      optionnel - un annuaire payant qui laisse passer un infarctus serait
 *      indéfendable.
 *
 *   2. `specialites` — les spécialités probables, par pertinence décroissante,
 *      trois au plus. Sans correspondance, médecine générale : c'est la bonne
 *      porte d'entrée quand on ne sait pas, et c'est ce qu'un patient attend.
 *
 * Volontairement simple : un dictionnaire de mots-clés, pas un modèle. Il se
 * lit, se corrige, se teste, et ne dépend d'aucun service externe. Le texte est
 * normalisé (minuscules, sans accents) pour que « fièvre », « Fievre » et
 * « FIÈVRE » se valent.
 */

function normaliser(texte) {
  return String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Une expression par entrée, déjà normalisée (donc sans accent). `\b` ne
// connaît que l'ASCII en JavaScript : c'est précisément pourquoi on retire les
// accents avant de comparer.
//
// Frontière au début seulement : « bouton » doit reconnaître « boutons »,
// « gratte » reconnaître « grattent », « saigne » reconnaître « saignement ».
// Les racines très courtes (≤ 3 lettres) gardent une frontière de fin, sinon
// « dos » attraperait « dossier » et « os » n'importe quoi.
function motif(expression) {
  const fin = expression.replace(/[()|?.{}\d,\\]/g, '').length <= 3 ? '\\b' : ''
  return new RegExp(`\\b${expression}${fin}`)
}

// Drapeaux rouges. Chaque entrée est un motif ; un seul suffit.
const DRAPEAUX_ROUGES = [
  // Cardio-respiratoire
  'douleur (a la |dans la |de la )?poitrine', 'douleur thoracique', 'oppression thoracique',
  'serrement (de|dans) la poitrine', 'mal (a la|dans la) poitrine',
  'difficulte(s)? (a|pour) respirer', 'n arrive (plus |pas )?a respirer', 'ne peux (plus |pas )?respirer',
  'etouffe', 'suffoque', 'essouffle(e)? au repos', 'levres bleues',
  // Neurologique (AVC, convulsions, conscience). Les signes d'AVC sont écrits
  // avec de la tolérance (« bouche est deviee », « ne peut plus bouger ») :
  // c'est le cas où rater coûte le plus cher.
  'paralys', 'bouche .{0,12}devi', 'visage .{0,12}(tombe|devi|deforme)', 'moitie du (corps|visage)',
  'ne (peut|peux|peuvent) (plus|pas) bouger', 'n arrive (plus |pas )?a bouger', 'perte de force',
  '(bras|jambe|main) (mort|paralyse|inerte|qui ne bouge plus)',
  'n arrive (plus |pas )?a parler', 'trouble(s)? de la parole', 'parle mal (soudain|brusque)',
  'perte de connaissance', 'perdu connaissance', 'evanoui', 'inconscient', 'ne repond (plus|pas)',
  'convulsion', 'crise d epilepsie', 'tremble de tout le corps',
  'mal de tete (brutal|soudain|violent|insupportable)', 'pire mal de tete', 'raideur (de la|du) (nuque|cou)',
  'confus', 'delire', 'ne reconnait (plus|pas)',
  // Hémorragie
  'saigne(ment)? (beaucoup|abondant|enorme|qui ne s arrete pas)', 'hemorragie',
  'vomi(t|s|ssement)? (du |de )?sang', 'crache (du )?sang', 'sang dans les selles', 'selles noires',
  // Psychiatrique
  'envie de mourir', 'envie de me tuer', 'suicid', 'en finir', 'me faire du mal',
  // Traumatisme / accident
  'accident (grave|de la route|de voiture|de moto)', 'traumatisme cranien', 'chute de hauteur',
  'coup sur la tete', 'os (qui )?sort', 'fracture ouverte',
  // Abdominal / gynécologique aigu
  'ventre (dur|tres dur) et douloureux', 'douleur (abdominale|au ventre) (violente|insupportable|atroce)',
  'enceinte .{0,40}(saign|douleur violente|contraction)',
  // Autres
  'brulure (grave|etendue|profonde)', 'empoisonn', 'intoxication', 'a avale (un|du|de la)',
  'gonflement (de la|du) (gorge|langue)', 'gorge (qui )?se ferme', 'allergie grave', 'choc allergique',
  'bebe .{0,30}(fievre|ne bouge plus|mou|bleu)', 'nourrisson .{0,30}fievre',
  'morsure de serpent', 'piqure de scorpion',
].map(motif)

// Dictionnaire spécialité → motifs. Le score est le nombre de motifs distincts
// rencontrés ; il sert à ordonner, pas à décider seul.
const DICTIONNAIRE = {
  cardiologie: ['coeur', 'cardiaque', 'palpitation', 'tension', 'hypertension', 'arythmie', 'battement', 'oedeme des jambes', 'jambes gonflees'],
  pneumologie: ['toux', 'tousse', 'poumon', 'respir', 'asthme', 'bronchite', 'crachat', 'sifflement', 'essouffle'],
  gastroenterologie: ['ventre', 'estomac', 'digestion', 'diarrhee', 'constipation', 'vomi', 'nausee', 'brulure d estomac', 'reflux', 'ballonn', 'foie', 'jaunisse', 'hemorroide', 'selles'],
  dermatologie: ['peau', 'bouton', 'demangeaison', 'gratte', 'eczema', 'plaque', 'tache', 'acne', 'eruption', 'mycose', 'ongle', 'cheveux', 'chute de cheveux', 'urticaire'],
  orl: ['oreille', 'gorge', 'nez', 'sinus', 'sinusite', 'angine', 'otite', 'entend mal', 'surdite', 'bourdonnement', 'enroue', 'amygdale', 'rhume', 'nez bouche'],
  ophtalmologie: ['oeil', 'yeux', 'vue', 'vision', 'voit (flou|mal|trouble)', 'lunette', 'conjonctivite', 'oeil rouge', 'larmoie'],
  dentaire: ['dent', 'gencive', 'carie', 'machoire', 'mal aux dents', 'rage de dent', 'dentiste', 'abces dentaire'],
  gynecologie: ['regles', 'menstru', 'enceinte', 'grossesse', 'pertes', 'vaginal', 'uterus', 'ovaire', 'sein', 'menopause', 'contraception', 'sterilite', 'infertilite', 'accouchement'],
  urologie: ['urine', 'uriner', 'pisse', 'vessie', 'prostate', 'testicule', 'erection', 'impuissance', 'brulure en urinant', 'sang dans les urines', 'calcul', 'rein'],
  nephrologie: ['rein', 'renal', 'dialyse', 'insuffisance renale'],
  neurologie: ['mal de tete', 'migraine', 'cephalee', 'vertige', 'tremblement', 'engourdi', 'fourmillement', 'memoire', 'epilepsie', 'nerf', 'sciatique', 'crise'],
  orthopedie: ['os', 'articulation', 'genou', 'hanche', 'epaule', 'dos', 'colonne', 'lombaire', 'entorse', 'fracture', 'luxation', 'cheville', 'poignet', 'tendon'],
  rhumatologie: ['articulation', 'arthrose', 'arthrite', 'rhumatisme', 'raideur', 'douleurs articulaires', 'goutte', 'polyarthrite'],
  endocrinologie: ['diabete', 'sucre', 'glycemie', 'thyroide', 'hormone', 'poids', 'maigri', 'grossi', 'soif (intense|permanente)', 'cholesterol'],
  infectiologie: ['fievre', 'paludisme', 'palu', 'malaria', 'typhoide', 'infection', 'vih', 'sida', 'hepatite', 'tuberculose', 'frisson', 'sueur nocturne'],
  psychiatrie: ['depression', 'deprime', 'anxiete', 'anxieux', 'angoisse', 'stress', 'insomnie', 'dort mal', 'panique', 'triste', 'moral', 'hallucination', 'addiction', 'alcool', 'drogue'],
  pediatrie: ['enfant', 'bebe', 'nourrisson', 'mon fils', 'ma fille', 'ans (a|et) (de la |une )?fievre', 'vaccin', 'croissance'],
  oncologie: ['cancer', 'tumeur', 'grosseur', 'boule', 'masse', 'chimio', 'ganglion', 'amaigrissement inexplique'],
  medecine_generale: ['fatigue', 'faible', 'malaise', 'douleur', 'mal partout', 'courbature', 'bilan', 'controle', 'certificat', 'consultation', 'generaliste', 'medecin de famille'],
}

const MOTIFS_PAR_SPECIALITE = Object.fromEntries(
  Object.entries(DICTIONNAIRE).map(([cle, expressions]) => [cle, expressions.map(motif)]),
)

const MAX_SPECIALITES = 3

/**
 * @returns {{ urgence: boolean, specialites: string[], scores: Record<string, number> }}
 */
function trier(symptomes) {
  const texte = normaliser(symptomes)
  if (!texte) return { urgence: false, specialites: ['medecine_generale'], scores: {} }

  const urgence = DRAPEAUX_ROUGES.some((re) => re.test(texte))

  const scores = {}
  for (const [cle, motifs] of Object.entries(MOTIFS_PAR_SPECIALITE)) {
    const touches = motifs.filter((re) => re.test(texte)).length
    if (touches > 0) scores[cle] = touches
  }

  let specialites = Object.entries(scores)
    .sort((a, b) => b[1] - a[1] || SPECIALITES_LOCALES.indexOf(a[0]) - SPECIALITES_LOCALES.indexOf(b[0]))
    .map(([cle]) => cle)
    .slice(0, MAX_SPECIALITES)

  // La médecine générale n'est retenue seule que faute de mieux : si une
  // spécialité précise ressort, elle passe devant, et le généraliste reste en
  // filet de sécurité derrière.
  if (specialites.length === 0) {
    specialites = ['medecine_generale']
  } else if (!specialites.includes('medecine_generale') && specialites.length < MAX_SPECIALITES) {
    specialites.push('medecine_generale')
  }

  return { urgence, specialites, scores }
}

module.exports = { trier, normaliser, DICTIONNAIRE, DRAPEAUX_ROUGES }
