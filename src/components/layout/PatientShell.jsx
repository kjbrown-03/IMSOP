import { useTranslation } from 'react-i18next'
import { FolderOpen, User } from 'lucide-react'
import DashboardShell from './DashboardShell'
import BottomNav from './BottomNav'

export default function PatientShell({ title, left, right, children, fab }) {
  const { t } = useTranslation()

  const links = [
    { to: '/patient/dossiers', label: t('shell.patientNav.dossiers'), icon: <FolderOpen className="w-5 h-5" /> },
    { to: '/patient/profil', label: t('shell.patientNav.profil'), icon: <User className="w-5 h-5" /> },
  ]

  return (
    <DashboardShell
      title={title || 'IMSOP'}
      links={links}
      profileTo="/patient/profil"
      headerLeft={left}
      headerRight={right}
      fab={fab}
      // The patient area already navigates by bottom bar on phones; the sidebar
      // drawer stays available from the header for the full list.
      bottomNav={<BottomNav />}
    >
      {children}
    </DashboardShell>
  )
}
