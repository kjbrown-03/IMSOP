/**
 * Catégories de formations sanitaires où un médecin peut exercer.
 *
 * Publiques : la numérotation de 1 à 6 est celle du Cameroun, reprise des
 * documents du ministère de la Santé. Elle n'a pas de sens ailleurs dans la zone
 * CEMAC : hors Cameroun on n'affiche que le type de structure, sans quoi on
 * ferait déclarer à un médecin gabonais un rang qui n'existe pas chez lui.
 *
 * Privées : aucun texte de classement lisible n'a été trouvé (l'arrêté
 * n° 631-CAB-PR de 1987 est cité, mais pas publié en ligne). La liste décrit donc
 * des types de structure, à faire vérifier par le comité scientifique.
 *
 * Volontairement absents : cabinets de soins infirmiers, laboratoires,
 * pharmacies, centres de soins ambulatoires. Ce formulaire recrute des médecins.
 */
const CATEGORIES_PUBLIQUES = {
  HOPITAL_GENERAL: { rang: '1re catégorie', nom: 'Hôpital général ou CHU' },
  HOPITAL_CENTRAL: { rang: '2e catégorie', nom: 'Hôpital central ou centre hospitalier régional' },
  HOPITAL_REGIONAL: { rang: '3e catégorie', nom: 'Hôpital régional' },
  HOPITAL_DISTRICT: { rang: '4e catégorie', nom: 'Hôpital de district' },
  CMA: { rang: '5e catégorie', nom: "Centre médical d'arrondissement (CMA)" },
  CSI: { rang: '6e catégorie', nom: 'Centre de santé intégré (CSI)' },
}

const CATEGORIES_PRIVEES = {
  HOPITAL_PRIVE: { nom: 'Hôpital privé' },
  POLYCLINIQUE: { nom: 'Polyclinique' },
  CLINIQUE: { nom: 'Clinique' },
  CENTRE_MEDICAL_PRIVE: { nom: 'Centre médical privé' },
  CABINET_MEDICAL: { nom: 'Cabinet médical' },
  CONFESSIONNELLE: { nom: 'Formation sanitaire confessionnelle ou associative' },
}

const CLES_PUBLIQUES = Object.keys(CATEGORIES_PUBLIQUES)
const CLES_PRIVEES = Object.keys(CATEGORIES_PRIVEES)

function libelleCategorie(cle, pays) {
  const categorie = CATEGORIES_PUBLIQUES[cle] || CATEGORIES_PRIVEES[cle]
  if (!categorie) return cle
  return categorie.rang && String(pays || '').toLowerCase() === 'cm'
    ? `${categorie.rang} — ${categorie.nom}`
    : categorie.nom
}

module.exports = { CLES_PUBLIQUES, CLES_PRIVEES, libelleCategorie }
