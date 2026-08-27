import { useTranslation } from 'react-i18next'
import { LayoutDashboard, FolderOpen, Stethoscope, ShieldCheck, BadgeCheck, Settings, MessageSquare, MessageCircleHeart } from 'lucide-react'
import DashboardShell from './DashboardShell'

export default function CoordinatorLayout({ children }) {
  const { t } = useTranslation()

  const links = [
    {
      to: '/coordinateur/tableau-de-bord',
      label: t('shell.coordinatorNav.dashboard'),
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      to: '/coordinateur/recherche-expert',
      label: t('shell.coordinatorNav.dossiers'),
      icon: <FolderOpen className="w-5 h-5" />,
    },
    {
      to: '/coordinateur/recherche-expert',
      label: t('shell.coordinatorNav.experts'),
      icon: <Stethoscope className="w-5 h-5" />,
    },
    {
      to: '/coordinateur/messages',
      label: t('shell.coordinatorNav.messages'),
      icon: <MessageSquare className="w-5 h-5" />,
    },
    {
      to: '/coordinateur/identites',
      label: t('shell.coordinatorNav.identites'),
      icon: <ShieldCheck className="w-5 h-5" />,
    },
    {
      to: '/coordinateur/habilitations',
      label: t('shell.coordinatorNav.habilitations'),
      icon: <BadgeCheck className="w-5 h-5" />,
    },
    {
      to: '/coordinateur/exceptions',
      label: t('shell.coordinatorNav.parametres'),
      icon: <Settings className="w-5 h-5" />,
    },
    {
      to: '/coordinateur/temoignages',
      label: t('shell.coordinatorNav.temoignages'),
      icon: <MessageCircleHeart className="w-5 h-5" />,
    },
  ]

  return (
    <DashboardShell title="IMSOP Admin" links={links} profileTo="/profil">
      {children}
    </DashboardShell>
  )
}
