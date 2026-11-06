const { prisma } = require('../lib/prisma')
const { estPaysCemac } = require('../lib/cemac')

/**
 * Avis local : qui peut rediger, et ce que chacun voit de l'autre.
 *
 * L'affectation d'un avis local engage la plateforme de la meme facon que
 * l'annuaire : le patient ne connait pas ce medecin, c'est nous qui le lui
 * designons contre paiement. Les memes exigences s'appliquent donc, plus
 * l'accord explicite de rediger (`avisLocalActif`).
 */

// Tant que le rapport n'est pas remis, le dossier peut changer de mains.
const STATUTS_RECUSABLES = [
  'AFFECTE',
  'ACCEPTE_PAR_SPECIALISTE',
  'EN_ANALYSE',
  'INFORMATION_COMPLEMENTAIRE_DEMANDEE',
  'RAPPORT_EN_PREPARATION',
]

// EN_ATTENTE_AFFECTATION n'est atteint qu'une fois le dossier paye : c'est ce qui
// empeche d'envoyer du travail a un medecin sur un dossier qui ne sera pas regle.
const STATUTS_AFFECTABLES = ['EN_ATTENTE_AFFECTATION', ...STATUTS_RECUSABLES]

// Le dossier est entre ses mains et l'analyse est engagee. Soumettre pendant
// qu'un complement est attendu reviendrait a rendre un avis sans les pieces
// qu'on vient soi-meme de reclamer.
const STATUTS_SOUMISSION = ['ACCEPTE_PAR_SPECIALISTE', 'EN_ANALYSE', 'RAPPORT_EN_PREPARATION']
const STATUTS_REDACTION = [...STATUTS_SOUMISSION, 'INFORMATION_COMPLEMENTAIRE_DEMANDEE']

// « œ » et « æ » explicitement : NFD ne les decompose pas. « Cœur » ne
// correspondait a rien dans le triage de l'annuaire pour cette raison.
function normaliserSpecialite(texte) {
  return String(texte || '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

// Les dossiers portent un libelle (« Gynécologie-Obstétrique »), l'annuaire des
// cles (`gynecologie`) : on compare donc par inclusion. Pas en dessous de cinq
// lettres, sinon « orl » trouverait n'importe quel mot qui le contient.
function couvreLaSpecialite(medecin, specialiteRequise) {
  const cible = normaliserSpecialite(specialiteRequise)
  if (!cible) return false
  return [...(medecin.annuaireSpecialites || []), medecin.specialite].some((valeur) => {
    const v = normaliserSpecialite(valeur)
    if (!v) return false
    if (v === cible) return true
    return v.length >= 5 && cible.length >= 5 && (v.includes(cible) || cible.includes(v))
  })
}

/** Pourquoi ce medecin ne peut pas recevoir ce dossier, ou null s'il le peut. */
function motifIneligibilite(medecin, dossier) {
  if (!medecin.user?.active) return 'Ce compte médecin est désactivé'
  if (medecin.verificationStatus !== 'VALIDE') return "L'habilitation de ce médecin n'est pas valide"
  if (!medecin.valideParComite) return "Ce médecin n'a pas été retenu par le comité scientifique"
  if (!medecin.avisLocalActif) return "Ce médecin n'a pas accepté de rédiger des avis sur dossier"
  if (medecin.typePratique !== 'CONVENTIONNEL') {
    return 'Un avis sur dossier relève de la médecine conventionnelle'
  }
  if (!estPaysCemac(String(medecin.pays || '').toLowerCase())) {
    return "Ce médecin n'a pas renseigné de pays de la zone CEMAC"
  }
  // Un deuxieme avis rendu par le medecin du premier n'en est pas un.
  if (medecin.id === dossier.medecinLocalId || medecin.id === dossier.demandeurMedecinId) {
    return 'Ce médecin suit déjà ce patient : son avis ne serait pas un deuxième avis'
  }
  return null
}

/**
 * Medecins proposables, les plus pertinents d'abord. La specialite classe sans
 * exclure : les libelles des dossiers et les cles de l'annuaire ne sont pas la
 * meme liste, et un filtre strict laisserait sans reponse un dossier deja paye
 * par simple difference d'ecriture. L'ecran dit ce qui n'est pas confirme, et
 * c'est le coordinateur qui decide.
 */
async function candidatsRedacteurs(dossier) {
  const recusations = await prisma.recusationMedecinLocal.findMany({
    where: { dossierId: dossier.id },
    select: { medecinLocalId: true },
  })
  const exclus = new Set(recusations.map((r) => r.medecinLocalId))
  // Il l'a deja : le reproposer ne ferait que renvoyer une erreur au clic.
  if (dossier.medecinRedacteurId) exclus.add(dossier.medecinRedacteurId)

  const medecins = await prisma.medecinLocal.findMany({
    where: {
      avisLocalActif: true,
      valideParComite: true,
      verificationStatus: 'VALIDE',
      typePratique: 'CONVENTIONNEL',
      user: { active: true },
    },
    include: {
      user: { select: { id: true, fullName: true, active: true, avatarUrl: true } },
      _count: { select: { avisARediger: { where: { status: { in: STATUTS_RECUSABLES } } } } },
    },
  })

  const paysPatient = String(dossier.patient?.country || '').toLowerCase()
  const villePatient = dossier.patient?.city || null

  return medecins
    .filter((m) => !exclus.has(m.id) && !motifIneligibilite(m, dossier))
    .map((m) => ({
      id: m.id,
      fullName: m.user.fullName,
      avatarUrl: m.user.avatarUrl,
      specialite: m.specialite,
      annuaireSpecialites: m.annuaireSpecialites,
      etablissement: m.etablissement,
      pays: m.pays,
      ville: m.ville,
      annuaireExperience: m.annuaireExperience,
      chargeEnCours: m._count.avisARediger,
      specialiteConfirmee: couvreLaSpecialite(m, dossier.specialiteRequise),
      memePays: Boolean(paysPatient) && String(m.pays || '').toLowerCase() === paysPatient,
      memeVille: Boolean(villePatient) && m.ville === villePatient,
    }))
    .sort((a, b) =>
      Number(b.specialiteConfirmee) - Number(a.specialiteConfirmee) ||
      Number(b.memePays) - Number(a.memePays) ||
      Number(b.memeVille) - Number(a.memeVille) ||
      a.chargeEnCours - b.chargeEnCours,
    )
}

/**
 * Ce que chacun voit de l'autre sur un dossier d'avis local.
 *
 * Le patient paie 15 000 XAF pour un avis, pas pour un carnet d'adresses : lui
 * donner le telephone du medecin revendrait pour rien la mise en relation de
 * l'annuaire, et donner le sien au medecin ouvrirait un demarchage hors
 * plateforme. Chacun connait le nom de l'autre, parce qu'un avis se signe.
 * Le filtre est applique a la reponse, pas au chargement : les notifications ont
 * besoin de ces adresses cote serveur.
 */
function vuePubliqueRedacteur(medecin) {
  if (!medecin) return medecin
  return {
    id: medecin.id,
    specialite: medecin.specialite,
    etablissement: medecin.etablissement,
    user: { fullName: medecin.user?.fullName, avatarUrl: medecin.user?.avatarUrl ?? null },
  }
}

function vueDuDossier(dossier, { role, estRedacteur = false } = {}) {
  if (role === 'COORDINATEUR' || role === 'ADMIN') return dossier

  const vue = { ...dossier, medecinRedacteur: vuePubliqueRedacteur(dossier.medecinRedacteur) }
  if (!estRedacteur) return vue

  if (dossier.patient) {
    vue.patient = {
      id: dossier.patient.id,
      dob: dossier.patient.dob,
      gender: dossier.patient.gender,
      country: dossier.patient.country,
      city: dossier.patient.city,
      preferredLanguage: dossier.patient.preferredLanguage,
      user: { fullName: dossier.patient.user?.fullName },
    }
  }
  // Son nom suffit a detecter un conflit d'interets ; ses coordonnees n'ont pas
  // a passer d'un medecin a l'autre par notre intermediaire.
  if (dossier.medecinLocal) {
    vue.medecinLocal = { id: dossier.medecinLocal.id, user: { fullName: dossier.medecinLocal.user?.fullName } }
  }
  return vue
}

module.exports = {
  STATUTS_RECUSABLES,
  STATUTS_AFFECTABLES,
  STATUTS_SOUMISSION,
  STATUTS_REDACTION,
  couvreLaSpecialite,
  motifIneligibilite,
  candidatsRedacteurs,
  vueDuDossier,
}
