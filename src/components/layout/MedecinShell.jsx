import { LayoutDashboard, User, FileCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import DashboardShell from './DashboardShell'

export default function MedecinShell({ children }) {
  const { t } = useTranslation()
  const links = [
    { to: '/medecin/dossiers', label: t('shell.medecinNav.dossiers'), icon: <LayoutDashboard className="w-5 h-5" /> },
    { to: '/professionnel/justificatifs', label: t('shell.medecinNav.justificatifs'), icon: <FileCheck className="w-5 h-5" /> },
    { to: '/medecin/profil', label: t('shell.medecinNav.profil'), icon: <User className="w-5 h-5" /> },
  ]
  return (
    <DashboardShell title="IMSOP Médecin" links={links} profileTo="/medecin/profil">
      {children}
    </DashboardShell>
  )
}
