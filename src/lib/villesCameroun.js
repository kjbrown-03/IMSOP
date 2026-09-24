/**
 * Villes du Cameroun proposées à l'inscription.
 *
 * Une liste fermée plutôt qu'un champ libre : « Douala », « douala », « Dwala »
 * et « Douala 3e » comptent aujourd'hui pour quatre villes différentes, ce qui
 * rend tout classement par ville faux. La saisie contrainte est ce qui rend
 * l'indicateur exploitable.
 *
 * Classées par ordre alphabétique, pas par taille : on cherche une ville dans
 * une liste, on ne la parcourt pas par importance.
 */
export const VILLES_CAMEROUN = [
  'Bafang',
  'Bafoussam',
  'Bamenda',
  'Bertoua',
  'Buea',
  'Douala',
  'Dschang',
  'Ebolowa',
  'Edéa',
  'Foumban',
  'Garoua',
  'Guider',
  'Kousséri',
  'Kribi',
  'Kumba',
  'Limbe',
  'Maroua',
  'Mbalmayo',
  'Mbouda',
  'Meiganga',
  'Ngaoundéré',
  'Nkongsamba',
  'Sangmélima',
  'Tiko',
  'Yaoundé',
]

/**
 * Valeur sentinelle du choix « Autre ».
 *
 * Une liste fermée sans échappatoire refuserait l'inscription à qui habite une
 * ville absente — un village, une ville d'un autre pays. Le champ libre reste
 * donc accessible ; il concernera une minorité de comptes, ce qui laisse le
 * classement lisible.
 */
export const VILLE_AUTRE = '__autre__'

/** Le pays pour lequel la liste s'applique (code du sélecteur de pays). */
export const PAYS_DE_LA_LISTE = 'cm'
