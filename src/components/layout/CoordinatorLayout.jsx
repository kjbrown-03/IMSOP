import { useTranslation } from 'react-i18next'
import { LIENS_COORDINATEUR } from '../../lib/navigationCoordinateur'
import DashboardShell from './DashboardShell'

export default function CoordinatorLayout({ children, pleinEcran = false }) {
  const { t } = useTranslation()

  const links = LIENS_COORDINATEUR.map(({ to, cle, icone: Icone }) => ({
    to,
    label: t(`shell.coordinatorNav.${cle}`),
    icon: <Icone className="w-5 h-5" />,
  }))

  return (
    <DashboardShell title="IMSOP Admin" links={links} profileTo="/profil" pleinEcran={pleinEcran}>
      {children}
    </DashboardShell>
  )
}
