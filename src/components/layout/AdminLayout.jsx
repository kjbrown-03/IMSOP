import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Stethoscope, ShieldCheck, ScrollText } from 'lucide-react'
import DashboardShell from './DashboardShell'

export default function AdminLayout({ children }) {
  const { t } = useTranslation()

  const links = [
    {
      to: '/admin/tableau-de-bord',
      label: t('shell.adminNav.dashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      to: '/admin/specialistes',
      label: t('shell.adminNav.specialistes'),
      icon: <Stethoscope className="w-5 h-5" />,
    },
    {
      to: '/admin/coordinateurs',
      label: t('shell.adminNav.coordinateurs'),
      icon: <ShieldCheck className="w-5 h-5" />,
    },
    {
      to: '/admin/journal',
      label: t('shell.adminNav.journal'),
      icon: <ScrollText className="w-5 h-5" />,
    },
  ]

  return (
    <DashboardShell title="IMSOP Admin" links={links}>
      {children}
    </DashboardShell>
  )
}
