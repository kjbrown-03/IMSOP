/**
 * Zone CEMAC — pays et villes, côté écran.
 *
 * Reflet de `backend/src/lib/cemac.js` : les deux doivent rester alignés, sinon
 * une ville choisie dans un formulaire ne serait pas reconnue par la recherche.
 * Codes ISO-2 minuscules, comme partout ailleurs dans le projet.
 */
export const PAYS_CEMAC = {
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

/** Les pays, triés par nom — on cherche un pays dans une liste alphabétique. */
export const OPTIONS_PAYS = Object.entries(PAYS_CEMAC)
  .map(([code, { nom }]) => ({ code, nom }))
  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

export function villesDe(code) {
  return PAYS_CEMAC[String(code || '').toLowerCase()]?.villes ?? []
}

export function nomDuPays(code) {
  return PAYS_CEMAC[String(code || '').toLowerCase()]?.nom ?? ''
}
