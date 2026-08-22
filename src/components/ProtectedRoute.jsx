import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/useAuthStore'

const LOGIN_ROUTES = {
  PATIENT: '/connexion/patient',
  COORDINATEUR: '/connexion/coordinateur',
  SPECIALISTE: '/connexion/specialiste',
  ADMIN: '/connexion/admin',
}

export default function ProtectedRoute({ role, children }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to={LOGIN_ROUTES[role] || '/connexion'} replace />
  }
  if (role && user?.role !== role) {
    return <Navigate to={LOGIN_ROUTES[role] || '/connexion'} replace />
  }
  return children
}
