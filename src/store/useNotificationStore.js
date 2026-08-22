import { create } from 'zustand'
import { api } from '../lib/api'

// The API has no push channel, so the bell polls. 20s keeps a new message
// visible quickly without hammering a rate-limited endpoint; a window focus
// also triggers an immediate refresh, which covers most real usage.
const POLL_INTERVAL_MS = 20000

// The shell mounts a bell in both the mobile bar and the desktop header, and
// only one of the two is ever visible. Ref-counting the timer here keeps a
// single poll running no matter how many bells are on the page.
let pollTimer = null
let pollSubscribers = 0
let onWindowFocus = null

export const useNotificationStore = create((set, get) => ({
  items: [],
  unreadCount: 0,
  loading: false,
  error: null,

  startPolling() {
    pollSubscribers += 1
    if (pollTimer) return

    get().fetchNotifications()
    pollTimer = setInterval(() => get().fetchNotifications({ silent: true }), POLL_INTERVAL_MS)
    onWindowFocus = () => get().fetchNotifications({ silent: true })
    window.addEventListener('focus', onWindowFocus)
  },

  stopPolling() {
    pollSubscribers = Math.max(0, pollSubscribers - 1)
    if (pollSubscribers > 0 || !pollTimer) return

    clearInterval(pollTimer)
    pollTimer = null
    window.removeEventListener('focus', onWindowFocus)
    onWindowFocus = null
  },

  async fetchNotifications({ silent = false } = {}) {
    if (!silent) set({ loading: true })
    try {
      const { data } = await api.get('/notifications', { params: { pageSize: 20 } })
      set({ items: data.items, unreadCount: data.unreadCount, loading: false, error: null })
    } catch (err) {
      // A silent background poll must not replace the list already on screen
      // with an error state, so only surface failures the user asked for.
      if (silent) return
      set({ loading: false, error: err.response?.data?.message || 'Notifications indisponibles' })
    }
  },

  async markRead(id) {
    const target = get().items.find((n) => n.id === id)
    if (!target || target.readAt) return

    // Optimistic: the badge drops the moment the user opens the notification,
    // and the server response reconciles the count straight after.
    set((state) => ({
      items: state.items.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }))

    try {
      const { data } = await api.post(`/notifications/${id}/read`)
      set({ unreadCount: data.unreadCount })
    } catch {
      get().fetchNotifications({ silent: true })
    }
  },

  async markAllRead() {
    const now = new Date().toISOString()
    set((state) => ({
      items: state.items.map((n) => (n.readAt ? n : { ...n, readAt: now })),
      unreadCount: 0,
    }))

    try {
      await api.post('/notifications/read-all')
    } catch {
      get().fetchNotifications({ silent: true })
    }
  },

  reset() {
    set({ items: [], unreadCount: 0, loading: false, error: null })
  },
}))

export { POLL_INTERVAL_MS }
