/**
 * Clés des catégories de formations sanitaires, identiques à celles que le
 * serveur valide (backend/src/lib/formationsSanitaires.js). Les libellés sont
 * dans candidature.categories.* : le numéro de catégorie n'est affiché qu'au
 * Cameroun, le seul pays dont cette numérotation est celle du ministère.
 */
export const CATEGORIES_PUBLIQUES = ['HOPITAL_GENERAL', 'HOPITAL_CENTRAL', 'HOPITAL_REGIONAL', 'HOPITAL_DISTRICT', 'CMA', 'CSI']
export const CATEGORIES_PRIVEES = ['HOPITAL_PRIVE', 'POLYCLINIQUE', 'CLINIQUE', 'CENTRE_MEDICAL_PRIVE', 'CABINET_MEDICAL', 'CONFESSIONNELLE']

export function libelleCategorie(t, cle, pays) {
  const nom = t(`candidature.categories.${cle}.nom`)
  // On ne demande le rang qu'aux catégories publiques : i18next traite une valeur
  // par défaut vide comme une absence, et affichait la clé brute pour le privé.
  const numerotee = CATEGORIES_PUBLIQUES.includes(cle) && String(pays || '').toLowerCase() === 'cm'
  return numerotee ? `${t(`candidature.categories.${cle}.rang`)} — ${nom}` : nom
}

export function optionsCategories(t, cles, pays) {
  return cles.map((cle) => ({ valeur: cle, label: libelleCategorie(t, cle, pays) }))
}
