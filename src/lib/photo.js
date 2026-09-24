/**
 * Préparation d'une photo choisie par un candidat.
 *
 * Deux situations font échouer un envoi de photo en pratique, et toutes deux
 * viennent du téléphone :
 *
 *  - le poids. Un cliché d'un appareil récent pèse 3 à 8 Mo. Le candidat n'a
 *    aucun moyen simple de le réduire depuis son téléphone, et se heurte à un
 *    refus qu'il ne sait pas contourner.
 *  - le format. Un iPhone enregistre en HEIC. Le serveur ne le connaît pas,
 *    et le candidat non plus : pour lui, c'est « une photo ».
 *
 * Plutôt que de refuser, on redessine l'image dans un canvas et on la réencode
 * en JPEG : le poids tombe d'un facteur dix, et tout ce que le navigateur sait
 * décoder ressort dans un format que le serveur accepte — y compris le HEIC
 * sur iOS, où Safari sait le lire.
 */

// Au-delà, on ne gagne plus rien de visible sur un portrait : le comité regarde
// une vignette, pas un tirage.
const COTE_MAX = 1400
const QUALITE = 0.85

// Ce que le serveur accepte tel quel. Le reste passe par la conversion.
const FORMATS_SERVEUR = ['image/jpeg', 'image/png', 'image/webp']

export class PhotoIllisible extends Error {}

function chargerImage(fichier) {
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resoudre(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      // Un HEIC sous Chrome, un fichier corrompu, un PDF renommé en .jpg :
      // dans tous les cas le navigateur ne sait pas en faire une image.
      rejeter(new PhotoIllisible())
    }
    img.src = url
  })
}

function versJpeg(canvas) {
  return new Promise((resoudre, rejeter) => {
    canvas.toBlob(
      (blob) => (blob ? resoudre(blob) : rejeter(new PhotoIllisible())),
      'image/jpeg',
      QUALITE,
    )
  })
}

/**
 * Rend un File prêt à partir : JPEG, redimensionné, quelques centaines de Ko.
 * Lève `PhotoIllisible` si le navigateur ne sait pas décoder le fichier.
 */
export async function preparerPhoto(fichier, { coteMax = COTE_MAX } = {}) {
  const image = await chargerImage(fichier)

  const facteur = Math.min(1, coteMax / Math.max(image.width, image.height))
  const largeur = Math.max(1, Math.round(image.width * facteur))
  const hauteur = Math.max(1, Math.round(image.height * facteur))

  // Une image déjà petite et dans un format connu n'a rien à gagner à être
  // réencodée : on évite une perte de qualité gratuite.
  if (facteur === 1 && FORMATS_SERVEUR.includes(fichier.type) && fichier.size <= 1.5 * 1024 * 1024) {
    return fichier
  }

  const canvas = document.createElement('canvas')
  canvas.width = largeur
  canvas.height = hauteur
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new PhotoIllisible()
  ctx.drawImage(image, 0, 0, largeur, hauteur)

  const blob = await versJpeg(canvas)
  const nom = fichier.name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${nom}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}
