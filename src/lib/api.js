import axios from 'axios'
import { ecrireSession, roleActif, sessionActive, supprimerSession } from './session'

export const api = axios.create({
  baseURL: '/api',
})

/**
 * Démonstration derrière un tunnel ngrok gratuit.
 *
 * ngrok intercale une page d'avertissement HTML (ERR_NGROK_6024) devant la
 * première visite d'un tunnel gratuit. Pour une navigation, on clique
 * « Visit Site » et c'est réglé ; pour un appel d'API, il n'y a personne pour
 * cliquer : la réponse arrive en 200 avec du HTML là où le code attend du JSON,
 * et chaque écran affiche « impossible de charger les données ».
 *
 * Cet en-tête fait sauter l'interstitiel. Il ne coûte rien hors tunnel — un
 * en-tête inconnu que le serveur ignore.
 */
const ENTETE_NGROK = { 'ngrok-skip-browser-warning': 'true' }

api.interceptors.request.use((config) => {
  // Le jeton dépend du rôle actif de CET onglet : deux onglets ouverts sur deux
  // espaces différents envoient donc chacun le leur.
  const session = sessionActive()
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`
  }
  Object.assign(config.headers, ENTETE_NGROK)
  return config
})

// Un rafraîchissement par rôle : deux espaces ouverts en parallèle ne doivent
// pas se voler leur promesse en cours ni écrire dans l'emplacement de l'autre.
const rafraichissements = new Map()

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const role = roleActif()
    const session = role ? sessionActive() : null
    if (!session?.refreshToken) return Promise.reject(error)

    original._retry = true
    try {
      if (!rafraichissements.has(role)) {
        rafraichissements.set(
          role,
          axios
            .post('/api/auth/refresh', { refreshToken: session.refreshToken }, { headers: ENTETE_NGROK })
            .finally(() => rafraichissements.delete(role)),
        )
      }
      const { data } = await rafraichissements.get(role)
      ecrireSession(role, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user ?? session.user,
      })
      original.headers.Authorization = `Bearer ${data.accessToken}`
      return api(original)
    } catch (refreshError) {
      // Seule la session de ce rôle est perdue : les autres espaces restent
      // connectés, et on ne renvoie vers l'écran de connexion que celui-là.
      supprimerSession(role)
      window.location.href = '/connexion'
      return Promise.reject(refreshError)
    }
  },
)
