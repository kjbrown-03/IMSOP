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

/*
 * Découpage administratif du Cameroun : 10 régions, 58 départements, 360
 * arrondissements, d'après l'Annuaire statistique de l'INS (2013).
 *
 * Au Cameroun on situe quelqu'un par son arrondissement, pas par une liste de
 * 25 villes : un patient de Mfou ou de Bonaléa ne trouvait pas sa ville et
 * devait choisir « toutes », ce qui rendait le classement par proximité muet.
 * Les autres pays de la zone gardent leur liste de villes tant qu'on n'a pas
 * leur découpage.
 *
 * Les coordonnées (Wikidata) servent à mesurer une distance entre deux
 * arrondissements, et au navigateur à retrouver l'arrondissement d'un patient
 * qui partage sa position. `approx` marque celles qui ne sont que le centre de
 * la ville (Douala Ier à VIe partagent le même point) ou du département : la
 * géolocalisation ne s'y fie pas pour choisir l'arrondissement à la place du
 * patient.
 */
const DECOUPAGE_CAMEROUN = require('./decoupageCameroun.json')

const ARRONDISSEMENTS = new Map()
const DEPARTEMENTS = new Map()
for (const r of DECOUPAGE_CAMEROUN.regions) {
  for (const d of r.departements) {
    const pts = d.arrondissements
    DEPARTEMENTS.set(d.nom, {
      region: r.nom,
      lat: pts.reduce((s, a) => s + a.lat, 0) / pts.length,
      lng: pts.reduce((s, a) => s + a.lng, 0) / pts.length,
    })
    for (const a of pts) ARRONDISSEMENTS.set(a.nom, { region: r.nom, departement: d.nom, lat: a.lat, lng: a.lng })
  }
}

// Les fiches remplies avant le découpage n'ont qu'une ville. On les rattache à
// leur département pour qu'elles restent classées par proximité au lieu de
// tomber au fond de la liste.
const DEPARTEMENT_DES_VILLES_CM = {
  Bafang: 'Haut-Nkam', Bafoussam: 'Mifi', Bamenda: 'Mezam', Bertoua: 'Lom-et-Djérem', Buea: 'Fako',
  Douala: 'Wouri', Dschang: 'Menoua', Ebolowa: 'Mvila', 'Edéa': 'Sanaga-Maritime', Foumban: 'Noun',
  Garoua: 'Bénoué', Guider: 'Mayo-Louti', 'Kousséri': 'Logone-et-Chari', Kribi: 'Océan', Kumba: 'Meme',
  Limbe: 'Fako', Maroua: 'Diamaré', Mbalmayo: "Nyong-et-So'o", Mbouda: 'Bamboutos', Meiganga: 'Mbéré',
  'Ngaoundéré': 'Vina', Nkongsamba: 'Moungo', 'Sangmélima': 'Dja-et-Lobo', Tiko: 'Fako', 'Yaoundé': 'Mfoundi',
}

/**
 * Vérifie qu'un triplet région / département / arrondissement se tient. Chaque
 * niveau est facultatif, mais un niveau donné doit appartenir au précédent :
 * « Wouri » dans la région du Centre est une erreur, pas une approximation.
 */
function lieuCamerounValide({ region, departement, arrondissement }) {
  if (arrondissement) {
    const a = ARRONDISSEMENTS.get(arrondissement)
    if (!a || (departement && a.departement !== departement) || (region && a.region !== region)) return false
  }
  if (departement) {
    const d = DEPARTEMENTS.get(departement)
    if (!d || (region && d.region !== region)) return false
  }
  if (region && !DECOUPAGE_CAMEROUN.regions.some((r) => r.nom === region)) return false
  return true
}

/**
 * Situe une fiche ou une recherche au Cameroun, du plus précis au plus vague.
 * Renvoie null si l'on ne sait rien de plus que le pays.
 */
function situerAuCameroun({ region, departement, arrondissement, ville }) {
  const a = arrondissement && ARRONDISSEMENTS.get(arrondissement)
  if (a) return { ...a, arrondissement, precision: 'arrondissement' }
  const dep = departement || DEPARTEMENT_DES_VILLES_CM[ville]
  const d = dep && DEPARTEMENTS.get(dep)
  if (d) return { ...d, departement: dep, precision: 'departement' }
  if (region) return { region, precision: 'region' }
  return null
}

/** Distance à vol d'oiseau, en kilomètres. */
function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

module.exports = {
  PAYS_CEMAC, CODES_PAYS, estPaysCemac, villesDe,
  DECOUPAGE_CAMEROUN, lieuCamerounValide, situerAuCameroun, distanceKm,
}
