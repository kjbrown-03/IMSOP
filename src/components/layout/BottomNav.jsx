import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FolderOpen, Stethoscope, MessageSquare, User } from 'lucide-react'

export default function BottomNav() {
  const { t } = useTranslation()
  const items = [
    { to: '/patient/dossiers', label: t('shell.patientNav.dossiers'), icon: FolderOpen },
    { to: '/patient/medecins', label: t('shell.patientNav.medecins'), icon: Stethoscope },
    { to: '/patient/messages', label: t('shell.patientNav.messages'), icon: MessageSquare, dot: true },
    { to: '/patient/profil', label: t('shell.patientNav.profil'), icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 py-3 glass-card rounded-t-3xl md:hidden border-b-0 border-x-0">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center transition-all duration-300 relative ${
              isActive
                ? 'text-primary-600 scale-110'
                : 'text-slate-400 hover:text-slate-600 active:scale-95'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`relative p-2 rounded-2xl ${isActive ? 'bg-primary-50' : ''}`}>
                <item.icon className={`w-6 h-6 ${isActive ? 'fill-primary-100/50' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                {item.dot && !isActive && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                )}
              </div>
              <span className={`text-[10px] font-semibold mt-1 transition-colors ${isActive ? 'text-primary-700' : ''}`}>
                {item.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
