import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import StatistiquesMensuelles from '../../components/coordinateur/StatistiquesMensuelles'

/**
 * Onglet Statistiques de la coordination : les dix indicateurs du MVP (§8),
 * mois par mois.
 *
 * Le revenu y figure : la direction a ouvert les indicateurs financiers à la
 * coordination, par dérogation assumée au §32 (voir admin.controller.js).
 */
export default function CoordinateurStatistiques() {
  return (
    <CoordinatorLayout>
      <StatistiquesMensuelles />
    </CoordinatorLayout>
  )
}
