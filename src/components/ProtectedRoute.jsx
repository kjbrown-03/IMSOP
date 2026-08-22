import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const LOGIN_ROUTES = {
  PATIENT: '/connexion/patient',
  COORDINATEUR: '/connexion/coordinateur',
  SPECIALISTE: '/connexion/specialiste',
  MEDECIN_LOCAL: '/connexion/medecin',
  ADMIN: '/connexion/admin',
}

// `role` accepts a single role or a list: the secure conversation is shared
// between the patient and the médecin local, so one route serves both.
export default function ProtectedRoute({ role, children }) {
  const { isAuthenticated, user } = useAuthStore()
  const allowed = role == null ? null : [].concat(role)
  const fallback = (allowed && LOGIN_ROUTES[allowed[0]]) || '/connexion'

  if (!isAuthenticated) {
    return <Navigate to={fallback} replace />
  }
  if (allowed && !allowed.includes(user?.role)) {
    return <Navigate to={fallback} replace />
  }
  return children
}
