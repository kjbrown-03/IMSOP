import { useTranslation } from 'react-i18next'
import { LayoutDashboard, User } from 'lucide-react'
import DashboardShell from './DashboardShell'

export default function SpecialistShell({ children }) {
  const { t } = useTranslation()

  const links = [
    {
      to: '/specialiste/tableau-de-bord',
      label: t('shell.specialistNav.dossiers'),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    { to: '/specialiste/disponibilites', label: t('shell.specialistNav.compte'), icon: <User className="w-5 h-5" /> },
  ]

  return (
    <DashboardShell title="IMSOP Expert" links={links} profileTo="/specialiste/disponibilites">
      {children}
    </DashboardShell>
  )
}
