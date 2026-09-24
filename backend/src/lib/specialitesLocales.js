/**
 * Spécialités de l'annuaire « Trouver un médecin ».
 *
 * Plus large que la liste du second avis (qui ne retient que ce où une
 * expertise internationale apporte quelque chose) : ici on cherche un médecin
 * de proximité, donc médecine générale, dentaire, ORL, dermatologie… doivent
 * exister. Un médecin en coche une ou plusieurs dans son profil.
 *
 * Les clés sont stables et servent de valeur en base ; les libellés sont
 * traduits côté front.
 */
const SPECIALITES_LOCALES = [
  'medecine_generale',
  'pediatrie',
  'gynecologie',
  'cardiologie',
  'dermatologie',
  'orl',
  'ophtalmologie',
  'dentaire',
  'psychiatrie',
  'orthopedie',
  'gastroenterologie',
  'pneumologie',
  'nephrologie',
  'urologie',
  'neurologie',
  'oncologie',
  'rhumatologie',
  'endocrinologie',
  'infectiologie',
]

function estSpecialiteLocale(cle) {
  return SPECIALITES_LOCALES.includes(cle)
}

module.exports = { SPECIALITES_LOCALES, estSpecialiteLocale }
