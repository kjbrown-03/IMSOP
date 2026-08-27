import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { lireSession, roleActif } from '../lib/session'
import { useAuthStore } from '../store/useAuthStore'

const LOGIN_ROUTES = {
  PATIENT: '/connexion/patient',
  COORDINATEUR: '/connexion/coordinateur',
  SPECIALISTE: '/connexion/specialiste',
  MEDECIN_LOCAL: '/connexion/medecin',
  ADMIN: '/connexion/admin',
}

// `role` accepte un rôle ou une liste : la conversation sécurisée est partagée
// entre le patient et le médecin local, une seule route sert donc les deux.
//
// Les sessions étant cloisonnées par rôle, cette route fait aussi l'aiguillage :
// entrer dans l'espace d'un rôle bascule l'onglet sur la session de ce rôle, ce
// qui permet d'être connecté à plusieurs espaces en même temps.
export default function ProtectedRoute({ role, children }) {
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const activerRole = useAuthStore((s) => s.activerRole)

  const allowed = role == null ? null : [].concat(role)
  // Lu directement dans le stockage, pas dans l'état React : le tout premier
  // rendu doit déjà savoir si une session existe, sinon il redirige à tort.
  //
  // Une route partagée (ex: /professionnel/justificatifs, ouverte au
  // spécialiste ET au médecin local) doit rester dans le rôle que cet onglet
  // utilisait déjà, s'il fait partie des rôles acceptés - sinon le simple fait
  // d'avoir aussi une session spécialiste ouverte dans ce navigateur faisait
  // basculer un médecin local vers l'espace spécialiste au moindre clic sur un
  // onglet du menu, l'ordre du tableau `allowed` l'emportant à tort.
  const actif = allowed ? roleActif() : null
  const roleCible = allowed
    ? (allowed.includes(actif) && lireSession(actif) ? actif : allowed.find((r) => lireSession(r)) ?? null)
    : null

  useEffect(() => {
    if (roleCible) activerRole(roleCible)
  }, [roleCible, activerRole])

  if (allowed) {
    if (!roleCible) {
      return <Navigate to={LOGIN_ROUTES[allowed[0]] || '/connexion'} replace />
    }
    // Le basculement passe par un effet : on attend qu'il ait eu lieu pour ne
    // pas afficher une seconde l'interface avec le compte précédent.
    if (user?.role !== roleCible) return null
    return children
  }

  // Route sans rôle imposé (/profil) : la session active de l'onglet suffit.
  if (!isAuthenticated) return <Navigate to="/connexion" replace />
  return children
}
