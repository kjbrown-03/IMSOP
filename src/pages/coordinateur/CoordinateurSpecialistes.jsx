import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import AdminUserManager from '../../components/admin/AdminUserManager'

/**
 * Gestion du réseau d'experts par la coordination.
 *
 * Le même composant sert l'administration (voir pages/admin/AdminSpecialistes) :
 * les écrans ne diffèrent que par la coquille qui les entoure, et le serveur
 * restreint de son côté le coordinateur aux seuls comptes spécialistes.
 * Dupliquer l'écran n'aurait fait qu'ouvrir deux endroits à corriger.
 *
 * L'habilitation n'est volontairement pas pilotée d'ici : créer un compte ne
 * vaut pas validation (CDC §16), le contrôle des justificatifs reste sur
 * l'écran Habilitations.
 */
export default function CoordinateurSpecialistes() {
  return (
    <CoordinatorLayout>
      <AdminUserManager role="SPECIALISTE" />
    </CoordinatorLayout>
  )
}
