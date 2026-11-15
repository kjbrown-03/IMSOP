/**
 * Découpage du Cameroun côté écran : la donnée vient de l'API
 * (`/annuaire/referentiels`, clé `decoupage.cm`), qui la lit dans
 * `backend/src/lib/decoupageCameroun.json`. Une seule source : une copie ici
 * finirait par diverger, et un arrondissement choisi à l'écran serait refusé
 * par le serveur.
 */

/** « Douala IIIe (Wouri) », ou le niveau le plus précis connu. */
export function libelleLieu({ arrondissement, departement, region, ville } = {}) {
  if (arrondissement) return departement ? `${arrondissement} (${departement})` : arrondissement
  return departement || ville || region || ''
}

function distanceKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

// Au-delà, la personne n'est vraisemblablement pas au Cameroun : mieux vaut ne
// rien remplir que la placer dans l'arrondissement frontalier le plus proche.
const DISTANCE_MAX_KM = 60

/**
 * Retrouve l'arrondissement le plus proche d'une position, sans l'envoyer
 * nulle part : le calcul se fait dans le navigateur et seul le nom de
 * l'arrondissement part avec la recherche.
 *
 * Quand le point le plus proche n'est qu'approximatif (les six arrondissements
 * de Douala partagent le centre-ville), on s'arrête au département : choisir
 * « Douala Ier » pour quelqu'un de Bonabéri serait affirmer ce qu'on ignore.
 */
export function lieuLePlusProche(regions, lat, lng) {
  let meilleur = null
  for (const r of regions || []) {
    for (const d of r.departements) {
      for (const a of d.arrondissements) {
        const km = distanceKm({ lat, lng }, a)
        if (!meilleur || km < meilleur.km) meilleur = { km, region: r.nom, departement: d.nom, arrondissement: a.nom, approx: a.approx }
      }
    }
  }
  if (!meilleur || meilleur.km > DISTANCE_MAX_KM) return null
  return {
    region: meilleur.region,
    departement: meilleur.departement,
    arrondissement: meilleur.approx ? '' : meilleur.arrondissement,
  }
}
