import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('imsop_access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshing = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('imsop_refresh_token')
      if (!refreshToken) return Promise.reject(error)

      try {
        refreshing =
          refreshing ||
          axios.post('/api/auth/refresh', { refreshToken }).finally(() => {
            refreshing = null
          })
        const { data } = await refreshing
        localStorage.setItem('imsop_access_token', data.accessToken)
        localStorage.setItem('imsop_refresh_token', data.refreshToken)
        original.headers.Authorization = `Bearer ${data.accessToken}`
        return api(original)
      } catch (refreshError) {
        localStorage.removeItem('imsop_access_token')
        localStorage.removeItem('imsop_refresh_token')
        window.location.href = '/connexion'
        return Promise.reject(refreshError)
      }
    }
    return Promise.reject(error)
  },
)
