import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Activity, LogOut, User } from 'lucide-react'
import { Sidebar, SidebarBody, SidebarLink, SidebarButton } from '@/components/ui/sidebar'
import NotificationBell from '../ui/NotificationBell'
import UserProfileDropdown from '../ui/UserProfileDropdown'
import { useAuthStore } from '../../store/useAuthStore'
import { cn } from '@/lib/utils'
import ThemeToggle from '../ui/ThemeToggle'

function Brand({ label, collapsed }) {
  return (
    <Link to="/" className="flex items-center gap-3 py-1 relative z-20 shrink-0">
      <span className="bg-primary-100 dark:bg-neutral-800 text-primary-600 dark:text-white p-2 rounded-xl shrink-0">
        <Activity className="w-5 h-5" />
      </span>
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="font-display font-bold text-slate-900 dark:text-white whitespace-pre tracking-tight"
        >
          {label}
        </motion.span>
      )}
    </Link>
  )
}

function Avatar({ user }) {
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
  }
  return (
    <span className="h-7 w-7 shrink-0 rounded-full bg-slate-200 dark:bg-neutral-700 text-slate-600 dark:text-neutral-200 flex items-center justify-center">
      <User className="w-4 h-4" />
    </span>
  )
}

/**
 * Shared chrome for every role dashboard: a rail that expands on hover on
 * desktop, a slide-in drawer on mobile, and a header carrying the notification
 * bell and the account menu. Page content is passed as children and is not
 * touched, so each dashboard keeps its own data loading and behaviour.
 */
export default function DashboardShell({
  title,
  links = [],
  profileTo,
  children,
  fab = null,
  bottomNav = null,
  headerLeft = null,
  headerRight = null,
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  function onLogout() {
    logout()
    navigate('/')
  }

  const sidebarContent = (
    <>
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        <Brand label={title} collapsed={!open} />
        <nav className="mt-8 flex flex-col gap-1">
          {links.map((link) => (
            <SidebarLink key={link.to + link.label} link={link} />
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-1 border-t border-slate-200/70 dark:border-neutral-800 pt-3">
        {profileTo && (
          <SidebarLink
            link={{
              to: profileTo,
              label: user?.fullName || t('shell.userMenu.user'),
              icon: <Avatar user={user} />,
            }}
          />
        )}
        <SidebarButton label={t('shell.userMenu.logout')} icon={<LogOut className="w-5 h-5" />} onClick={onLogout} />
      </div>
    </>
  )

  return (
    <div
      className={cn(
        // h-dvh et non h-screen : sur mobile 100vh inclut la zone masquee par la
        // barre d'URL, donc le bas du contenu tombait hors de l'ecran sans moyen
        // de l'atteindre, le conteneur etant en overflow-hidden.
        'flex flex-col md:flex-row w-full h-dvh overflow-hidden font-sans antialiased',
        'bg-slate-100 dark:bg-neutral-800 text-slate-900 dark:text-neutral-100 selection:bg-primary-500/30',
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody
          className="justify-between gap-6"
          topBar={
            <div className="flex items-center gap-2">
              <span className="font-display font-bold tracking-tight text-slate-900 dark:text-white mr-1">{title}</span>
              <ThemeToggle />
              <NotificationBell />
              <UserProfileDropdown />
            </div>
          }
        >
          {sidebarContent}
        </SidebarBody>
      </Sidebar>

      <div className="flex flex-1 min-w-0 md:p-2">
        <div className="flex flex-col flex-1 min-w-0 bg-white dark:bg-neutral-900 md:rounded-2xl md:border border-slate-200 dark:border-neutral-700 shadow-sm">
          {/* Desktop header: the mobile equivalent lives in the sidebar top bar. */}
          <header className="hidden md:flex items-center justify-between gap-4 px-8 h-16 shrink-0 border-b border-slate-100 dark:border-neutral-800">
            <div className="flex items-center gap-3 min-w-0">
              {headerLeft}
              <h1 className="text-lg font-display font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {headerRight}
              <ThemeToggle />
              <NotificationBell />
              <UserProfileDropdown />
            </div>
          </header>

          {/* The FAB is `fixed`, so it floats over this scroll area rather than
              taking part in the layout. Without extra bottom padding the last
              element on the page — usually a submit button — sits underneath it
              and cannot be seen or clicked. The FAB occupies 152px of the bottom
              edge (`bottom-24` = 96px, plus `h-14` = 56px), so pb-40 clears it. */}
          <main
            className={`flex-1 overflow-y-auto md:rounded-b-2xl px-4 sm:px-6 md:px-8 py-6 md:py-8 animate-fade-in ${
              fab ? 'pb-40' : 'pb-28 md:pb-8'
            }`}
          >
            <div className="max-w-7xl mx-auto w-full flex flex-col gap-6">{children}</div>
          </main>
        </div>
      </div>

      {fab}
      {bottomNav}
    </div>
  )
}
