import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import AdminUserManager from '../../components/admin/AdminUserManager'

/**
 * Gestion des médecins traitants de proximité par la coordination.
 *
 * Le pendant de l'écran « Gestion des experts », pour l'autre moitié du réseau.
 * Elle n'existait pas : un médecin traitant recruté depuis une candidature ne
 * pouvait plus être ni corrigé ni suspendu ensuite, faute d'écran — alors que
 * c'est le même métier que pour un spécialiste.
 *
 * L'habilitation n'est pas pilotée d'ici : créer un compte ne vaut pas
 * validation (CDC §16), le contrôle du numéro d'ordre reste sur l'écran
 * Habilitations.
 */
export default function CoordinateurMedecins() {
  return (
    <CoordinatorLayout>
      <AdminUserManager role="MEDECIN_LOCAL" />
    </CoordinatorLayout>
  )
}
