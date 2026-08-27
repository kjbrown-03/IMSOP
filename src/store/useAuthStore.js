import { create } from 'zustand'
import { api } from '../lib/api'
import {
  definirRoleActif,
  ecrireSession,
  migrerAncienneSession,
  roleActif,
  rolesConnectes,
  sessionActive,
  supprimerSession,
} from '../lib/session'
import { useNotificationStore } from './useNotificationStore'

// Les sessions d'avant le cloisonnement par rôle sont reprises au chargement.
migrerAncienneSession()

// L'API répond aux violations de schéma par un message générique ("Requête
// invalide") accompagné d'un tableau `errors` par champ. Les afficher évite
// à l'utilisateur de deviner quel champ pose problème.
function errorMessage(err, fallback) {
  const data = err.response?.data
  if (data?.errors?.length) {
    return data.errors.map((e) => `${e.field} : ${e.message}`).join(' — ')
  }
  return data?.message || fallback
}

export const useAuthStore = create((set, get) => ({
  user: sessionActive()?.user ?? null,
  isAuthenticated: !!sessionActive(),
  loading: false,
  error: null,
  // Les rôles pour lesquels une session est ouverte dans ce navigateur.
  rolesOuverts: rolesConnectes(),

  async login(email, password, role) {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/login', { email, password, role })
      if (data.twoFactorRequired) {
        set({ loading: false })
        return { twoFactorRequired: true, challengeToken: data.challengeToken }
      }
      get()._persistSession(data)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err, 'Connexion impossible')
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
  },

  async verifyTwoFactor(challengeToken, code) {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/2fa/verify', { challengeToken, code })
      get()._persistSession(data)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err, 'Code invalide')
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
  },

  async forgotPassword(email) {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      set({ loading: false })
      return { ok: true, message: data.message }
    } catch (err) {
      const message = errorMessage(err, 'Une erreur est survenue')
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
  },

  async resetPassword(token, newPassword) {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/reset-password', { token, newPassword })
      set({ loading: false })
      return { ok: true, message: data.message }
    } catch (err) {
      const message = errorMessage(err, 'Lien invalide ou expiré')
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
  },

  // L'API repond desormais la meme chose que l'adresse soit libre ou deja prise
  // (202, sans session) : c'est ce qui empeche un bot de moissonner les comptes
  // existants. On enchaine donc sur une connexion normale avec les identifiants
  // qui viennent d'etre saisis — elle ne reussit que si le compte a reellement
  // ete cree a l'instant, ce qui preserve l'entree directe dans l'application.
  async _inscrire(route, payload, role) {
    set({ loading: true, error: null })
    try {
      await api.post(route, payload)
    } catch (err) {
      const message = errorMessage(err, 'Inscription impossible')
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }

    const connexion = await get().login(payload.email, payload.password, role)
    set({ loading: false })

    if (connexion.ok) return { ok: true }
    if (connexion.twoFactorRequired) {
      return { ok: true, twoFactorRequired: true, challengeToken: connexion.challengeToken }
    }

    // Adresse deja utilisee : on ne le dit pas, le titulaire est prevenu par
    // e-mail. L'erreur de connexion ne doit pas remonter a l'ecran.
    set({ error: null })
    return { ok: true, verificationEnAttente: true }
  },

  async register(payload) {
    return get()._inscrire('/auth/register/patient', payload, 'PATIENT')
  },

  async registerMedecinLocal(payload) {
    return get()._inscrire('/auth/register/medecin-local', payload, 'MEDECIN_LOCAL')
  },

  async verifyEmailCode(code) {
    set({ loading: true, error: null })
    try {
      const { data: user } = await api.post('/auth/verify-email', { code })
      get()._patchUser(user)
      set({ loading: false })
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err, 'Code invalide')
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
  },

  async resendEmailVerification() {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/verify-email/resend')
      set({ loading: false })
      return { ok: true, message: data.message }
    } catch (err) {
      const message = errorMessage(err, 'Une erreur est survenue')
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
  },

  async uploadIdentityDocument(file) {
    set({ loading: true, error: null })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/patients/me/identity-document', formData)
      get()._patchUser(data)
      set({ loading: false })
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err, "Le téléversement a échoué")
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
  },

  // Remplacement COMPLET du profil, contrairement à `_patchUser` : c'est ce qui
  // garantit qu'aucun champ du compte précédent (photo, référence, statut) ne
  // survive dans l'objet affiché. Le serveur répond d'après le jeton, donc la
  // réponse appartient forcément au compte réellement connecté.
  async refreshMe() {
    try {
      const { data } = await api.get('/auth/me')
      const role = roleActif()
      const session = sessionActive()
      if (role && session) ecrireSession(role, { ...session, user: data })
      set({ user: data })
      return { ok: true, user: data }
    } catch (err) {
      return { ok: false, error: errorMessage(err, 'Profil indisponible') }
    }
  },

  // La photo de profil vit sur User, pas sur le profil d'un rôle : le même
  // appel sert donc au patient, au spécialiste, au coordinateur et à l'admin.
  // `loading` n'est volontairement pas touché ici, sinon l'envoi d'une photo
  // ferait tourner le bouton du téléversement de pièce d'identité, qui lit le
  // même drapeau global.
  async uploadAvatar(file) {
    set({ error: null })
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/users/me/avatar', formData)
      get()._patchUser(data)
      return { ok: true, avatarUrl: data.avatarUrl }
    } catch (err) {
      const message = errorMessage(err, "L'envoi de la photo a échoué")
      set({ error: message })
      return { ok: false, error: message }
    }
  },

  async removeAvatar() {
    set({ error: null })
    try {
      const { data } = await api.delete('/users/me/avatar')
      get()._patchUser(data)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err, 'La suppression de la photo a échoué')
      set({ error: message })
      return { ok: false, error: message }
    }
  },

  // La disponibilité vit dans le profil utilisateur persisté, pas seulement dans
  // l'état local d'un écran : sans ça, le basculement était perdu au premier
  // remontage (navigation Dossiers <-> Compte, rechargement), et le praticien
  // revoyait « Disponible » alors qu'il venait de se retirer.
  async setDisponibilite(disponible) {
    set({ error: null })
    try {
      const { data } = await api.patch('/specialistes/me/disponibilite', { disponible })
      get()._patchUser({ disponible: data.disponible })
      return { ok: true, disponible: data.disponible }
    } catch (err) {
      const message = errorMessage(err, 'Impossible de mettre à jour votre disponibilité')
      set({ error: message })
      return { ok: false, error: message }
    }
  },

  _patchUser(partial) {
    const role = roleActif()
    const session = sessionActive()
    if (!role || !session) return
    const user = { ...session.user, ...partial }
    ecrireSession(role, { ...session, user })
    set({ user })
  },

  _persistSession(data) {
    ecrireSession(data.user.role, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
    })
    definirRoleActif(data.user.role)
    set({
      user: data.user,
      isAuthenticated: true,
      loading: false,
      error: null,
      rolesOuverts: rolesConnectes(),
    })
  },

  // Appelé au montage d'une route protégée : un onglet qui entre dans l'espace
  // d'un autre rôle bascule sur la session de ce rôle si elle existe, au lieu
  // de continuer avec celle du rôle précédent.
  activerRole(role) {
    if (!role || role === roleActif()) return
    definirRoleActif(role)
    const session = sessionActive()
    set({
      user: session?.user ?? null,
      isAuthenticated: !!session,
      rolesOuverts: rolesConnectes(),
    })
  },

  // Ne ferme que l'espace courant : les autres rôles connectés dans ce
  // navigateur gardent leur session.
  logout() {
    supprimerSession(roleActif())
    // Clear the bell too, otherwise the next account to sign in on this device
    // briefly sees the previous user's unread count and previews.
    useNotificationStore.getState().reset()
    const session = sessionActive()
    set({
      user: session?.user ?? null,
      isAuthenticated: !!session,
      rolesOuverts: rolesConnectes(),
    })
  },
}))

// Les sessions étant cloisonnées par rôle, un autre onglet ne peut plus voler
// celle-ci : il écrit dans SON emplacement. L'écoute sert donc uniquement à
// rester synchronisé, sans jamais changer le rôle de cet onglet.
//
// L'événement `storage` ne se déclenche que dans les AUTRES onglets, jamais dans
// celui qui écrit : pas de boucle de rechargement possible.
function surStockageModifie(event) {
    if (!event.key || !event.key.startsWith('imsop_session_')) return

    const role = event.key.slice('imsop_session_'.length)
    const etat = useAuthStore.getState()

    // Une session ouverte ou fermée pour un AUTRE rôle : rien à changer ici,
    // on met juste à jour la liste des espaces disponibles.
    if (role !== roleActif()) {
      useAuthStore.setState({ rolesOuverts: rolesConnectes() })
      return
    }

    const session = sessionActive()

    // Déconnexion de CE rôle faite dans un autre onglet : on suit.
    if (!session) {
      useNotificationStore.getState().reset()
      useAuthStore.setState({ user: null, isAuthenticated: false, rolesOuverts: rolesConnectes() })
      return
    }

    // Même compte, profil mis à jour ailleurs (photo, nom, disponibilité) :
    // on recopie la valeur sans toucher à la navigation.
    if (session.user?.id !== etat.user?.id || session.user !== etat.user) {
      useAuthStore.setState({ user: session.user, isAuthenticated: true, rolesOuverts: rolesConnectes() })
    }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', surStockageModifie)

  // Rechargement a chaud (dev) : sans ce nettoyage, l'ancien ecouteur reste
  // attache en plus du nouveau. Deux ecouteurs de generations differentes, c'est
  // exactement ce qui pouvait renvoyer un onglet vers la connexion.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => window.removeEventListener('storage', surStockageModifie))
  }
}
