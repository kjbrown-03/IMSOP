import { create } from 'zustand'
import { api } from '../lib/api'
import { useNotificationStore } from './useNotificationStore'

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
  user: JSON.parse(localStorage.getItem('imsop_user') || 'null'),
  isAuthenticated: !!localStorage.getItem('imsop_access_token'),
  loading: false,
  error: null,

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

  async register(payload) {
    set({ loading: true, error: null })
    try {
      const { data } = await api.post('/auth/register/patient', payload)
      get()._persistSession(data)
      return { ok: true }
    } catch (err) {
      const message = errorMessage(err, "Inscription impossible")
      set({ loading: false, error: message })
      return { ok: false, error: message }
    }
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

  _patchUser(partial) {
    const user = { ...get().user, ...partial }
    localStorage.setItem('imsop_user', JSON.stringify(user))
    set({ user })
  },

  _persistSession(data) {
    localStorage.setItem('imsop_access_token', data.accessToken)
    localStorage.setItem('imsop_refresh_token', data.refreshToken)
    localStorage.setItem('imsop_user', JSON.stringify(data.user))
    set({ user: data.user, isAuthenticated: true, loading: false, error: null })
  },

  logout() {
    localStorage.removeItem('imsop_access_token')
    localStorage.removeItem('imsop_refresh_token')
    localStorage.removeItem('imsop_user')
    // Clear the bell too, otherwise the next account to sign in on this device
    // briefly sees the previous user's unread count and previews.
    useNotificationStore.getState().reset()
    set({ user: null, isAuthenticated: false })
  },
}))
