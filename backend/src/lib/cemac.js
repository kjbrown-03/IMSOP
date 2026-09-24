/**
 * Zone CEMAC — pays et villes proposés à l'annuaire « Trouver un médecin ».
 *
 * Liste fermée, comme villesCameroun.js côté front : un patient qui cherche
 * « à Douala » doit tomber sur les médecins qui ont coché « Douala », pas sur
 * ceux qui ont écrit « douala » ou « Dla ». La saisie contrainte est ce qui
 * rend la recherche géographique juste.
 *
 * Les codes pays sont ISO-2 minuscules, comme `Patient.country` et
 * `MedecinLocal.pays` ailleurs dans le projet. Les villes camerounaises
 * reprennent la liste du front pour que les deux restent alignées.
 */

const PAYS_CEMAC = {
  cm: {
    nom: 'Cameroun',
    villes: [
      'Bafang', 'Bafoussam', 'Bamenda', 'Bertoua', 'Buea', 'Douala', 'Dschang',
      'Ebolowa', 'Edéa', 'Foumban', 'Garoua', 'Guider', 'Kousséri', 'Kribi',
      'Kumba', 'Limbe', 'Maroua', 'Mbalmayo', 'Mbouda', 'Meiganga',
      'Ngaoundéré', 'Nkongsamba', 'Sangmélima', 'Tiko', 'Yaoundé',
    ],
  },
  cf: {
    nom: 'République centrafricaine',
    villes: ['Bambari', 'Bangui', 'Berbérati', 'Bimbo', 'Bossangoa', 'Bouar', 'Carnot', 'Kaga-Bandoro', 'Mbaïki'],
  },
  cg: {
    nom: 'Congo',
    villes: ['Brazzaville', 'Dolisie', 'Impfondo', 'Nkayi', 'Ouesso', 'Owando', 'Pointe-Noire', 'Sibiti'],
  },
  ga: {
    nom: 'Gabon',
    villes: ['Franceville', 'Koulamoutou', 'Lambaréné', 'Libreville', 'Makokou', 'Moanda', 'Mouila', 'Oyem', 'Port-Gentil', 'Tchibanga'],
  },
  gq: {
    nom: 'Guinée équatoriale',
    villes: ['Bata', 'Ebebiyín', 'Evinayong', 'Luba', 'Malabo', 'Mongomo'],
  },
  td: {
    nom: 'Tchad',
    villes: ['Abéché', 'Bongor', 'Doba', 'Koumra', 'Moundou', "N'Djaména", 'Sarh'],
  },
}

const CODES_PAYS = Object.keys(PAYS_CEMAC)

function estPaysCemac(code) {
  return CODES_PAYS.includes(String(code || '').toLowerCase())
}

function villesDe(code) {
  return PAYS_CEMAC[String(code || '').toLowerCase()]?.villes ?? []
}

module.exports = { PAYS_CEMAC, CODES_PAYS, estPaysCemac, villesDe }
