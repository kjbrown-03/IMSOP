import { BookOpen, MapPin, NotebookPen, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import DashboardShell from './DashboardShell'

// Espace du tradipraticien, distinct de celui du médecin traitant : pas de
// dossiers de second avis ni d'avis à rédiger, seulement son registre de
// patients et sa fiche d'annuaire. Pas de justificatifs libres : il en joint à
// ses demandes de prise en charge, où la coordination les examine.
export default function TradipraticienShell({ children }) {
  const { t } = useTranslation()
  const links = [
    { to: '/tradipraticien/tutoriel', label: t('shell.tutorial'), icon: <BookOpen className="w-5 h-5" /> },
    { to: '/tradipraticien/registre', label: t('shell.tradipraticienNav.registre'), icon: <NotebookPen className="w-5 h-5" /> },
    { to: '/tradipraticien/annuaire', label: t('shell.tradipraticienNav.annuaire'), icon: <MapPin className="w-5 h-5" /> },
    { to: '/tradipraticien/profil', label: t('shell.tradipraticienNav.profil'), icon: <User className="w-5 h-5" /> },
  ]
  return (
    <DashboardShell title="IMSOP Tradipraticien" links={links} profileTo="/tradipraticien/profil">
      {children}
    </DashboardShell>
  )
}
