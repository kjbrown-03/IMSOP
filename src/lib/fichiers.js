import { api } from './api'

/**
 * Ouvre un fichier servi par l'API dans un nouvel onglet.
 *
 * L'API sert désormais les documents elle-même au lieu de rendre une URL
 * signée : le stockage n'est pas joignable depuis Internet, et chaque
 * téléchargement repasse par l'authentification. Conséquence ici : la requête
 * doit porter le jeton, ce que `window.open` ne sait pas faire. On récupère
 * donc le fichier avec le client authentifié, puis on ouvre une adresse locale
 * au navigateur.
 *
 * Renvoie `true` si l'onglet s'est ouvert. Un bloqueur de fenêtres peut le
 * refuser : l'appelant peut alors proposer un téléchargement.
 */
export async function ouvrirFichier(chemin) {
  const { data } = await api.get(chemin, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const onglet = window.open(url, '_blank', 'noopener,noreferrer')

  // L'onglet a pris sa copie : on rend la mémoire, sans quoi chaque
  // consultation en retiendrait une de plus jusqu'au rechargement de la page.
  // Une minute laisse au navigateur le temps de charger le document.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)

  if (!onglet) {
    // Fenêtre bloquée : on retombe sur un téléchargement, qui n'est jamais
    // refusé. Mieux vaut un fichier dans les téléchargements que rien.
    const lien = document.createElement('a')
    lien.href = url
    lien.download = ''
    lien.click()
    return false
  }
  return true
}
