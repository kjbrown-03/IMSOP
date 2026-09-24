import React, { useState, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import { NavLink } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Adapted from the Aceternity animated sidebar. Two deliberate departures from
// the original: navigation goes through react-router's NavLink instead of
// next/link (this app is Vite + React Router), and MobileSidebar takes a
// `topBar` slot so the mobile bar can host the brand and header actions rather
// than a lone hamburger.

const SidebarContext = createContext(undefined)

export const useSidebar = () => {
  const context = useContext(SidebarContext)
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider')
  }
  return context
}

export const SidebarProvider = ({ children, open: openProp, setOpen: setOpenProp, animate = true }) => {
  const [openState, setOpenState] = useState(false)

  const open = openProp !== undefined ? openProp : openState
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState

  return <SidebarContext.Provider value={{ open, setOpen, animate }}>{children}</SidebarContext.Provider>
}

export const Sidebar = ({ children, open, setOpen, animate }) => (
  <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
    {children}
  </SidebarProvider>
)

export const SidebarBody = ({ topBar, ...props }) => (
  <>
    <DesktopSidebar {...props} />
    <MobileSidebar topBar={topBar} {...props} />
  </>
)

export const DesktopSidebar = ({ className, children, ...props }) => {
  const { open, setOpen, animate } = useSidebar()
  return (
    <motion.div
      className={cn(
        'h-full px-4 py-4 hidden md:flex md:flex-col bg-slate-50 dark:bg-neutral-900 border-r border-slate-200/70 dark:border-neutral-800 w-[300px] flex-shrink-0',
        className,
      )}
      animate={{ width: animate ? (open ? '300px' : '72px') : '300px' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export const MobileSidebar = ({ className, children, topBar, ...props }) => {
  const { open, setOpen } = useSidebar()

  // Le tiroir est monté sur <body>, pas dans la barre du haut. Celle-ci porte
  // `backdrop-blur-xl`, et un `backdrop-filter` fait de l'élément le bloc
  // conteneur de ses descendants `position: fixed` — au même titre qu'un
  // `transform`. Le tiroir héritait donc des 64 px de la barre : il s'ouvrait
  // réduit à un bandeau, le reste du dashboard peignant par-dessus, et la
  // moitié des onglets devenait inatteignable sur téléphone.
  //
  // `md:hidden` sur le tiroir lui-même remplace celui de la barre : hors du
  // portail, il ne bénéficie plus du `display: none` du parent, et le survol du
  // rail de bureau (qui partage le drapeau `open`) l'aurait déployé en plein
  // écran sur ordinateur.
  const tiroir = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: '-100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '-100%', opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          // h-dvh et non h-full : sur mobile, 100vh compte la zone cachée par la
          // barre d'URL, ce qui repoussait le compte et la déconnexion hors écran.
          className={cn(
            'fixed inset-0 h-dvh w-full md:hidden bg-white dark:bg-neutral-900 px-6 py-8 z-[100] flex flex-col justify-between',
            className,
          )}
        >
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute right-5 top-8 z-50 p-1 text-slate-700 dark:text-neutral-200"
            onClick={() => setOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <div
        className="h-16 px-4 flex flex-row md:hidden items-center justify-between gap-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-neutral-800 w-full shrink-0"
        {...props}
      >
        <button
          type="button"
          aria-label="Ouvrir le menu"
          onClick={() => setOpen(!open)}
          className="p-2 -ml-2 rounded-xl text-slate-700 dark:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {topBar}
      </div>

      {typeof document !== 'undefined' && createPortal(tiroir, document.body)}
    </>
  )
}

// `link` is { label, to, icon }. The `end` flag maps to NavLink's exact match,
// needed for parent routes like /patient/dossiers that also prefix child routes.
export const SidebarLink = ({ link, className, onClick, ...props }) => {
  const { open, animate, setOpen } = useSidebar()

  // Closing on click is for the mobile drawer only. On desktop the same flag
  // drives the hover rail, so collapsing it here would snap the sidebar shut
  // under the pointer that is still resting on it.
  function handleClick(e) {
    if (window.matchMedia('(max-width: 767px)').matches) setOpen(false)
    onClick?.(e)
  }

  return (
    <NavLink
      to={link.to}
      end={link.end}
      onClick={handleClick}
      className={({ isActive }) =>
        cn(
          'flex items-center justify-start gap-3 group/sidebar rounded-xl px-2.5 py-2.5 transition-colors',
          isActive
            ? 'bg-primary-50 text-primary-700 dark:bg-neutral-800 dark:text-white'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-300 dark:hover:bg-neutral-800',
          className,
        )
      }
      {...props}
    >
      <span className="shrink-0">{link.icon}</span>
      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-sm font-medium group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {link.label}
      </motion.span>
    </NavLink>
  )
}

// Same visual treatment as SidebarLink but for actions that are not navigation
// (logout), so the collapsed rail stays visually consistent.
export const SidebarButton = ({ label, icon, onClick, className }) => {
  const { open, animate } = useSidebar()

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-start gap-3 group/sidebar rounded-xl px-2.5 py-2.5 text-slate-600 hover:bg-rose-50 hover:text-rose-600 dark:text-neutral-300 dark:hover:bg-neutral-800 transition-colors',
        className,
      )}
    >
      <span className="shrink-0">{icon}</span>
      <motion.span
        animate={{
          display: animate ? (open ? 'inline-block' : 'none') : 'inline-block',
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="text-sm font-medium group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre inline-block !p-0 !m-0"
      >
        {label}
      </motion.span>
    </button>
  )
}
