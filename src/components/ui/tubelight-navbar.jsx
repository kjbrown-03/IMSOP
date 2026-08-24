import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

// Classes ecrites en toutes lettres : le JIT de Tailwind scanne le source, il ne
// verrait pas un nom de classe reconstruit dynamiquement (`hidden ${bp}:inline`).
const BREAKPOINTS = {
  sm: { label: 'hidden sm:inline', icon: 'sm:hidden', padding: 'px-4 sm:px-6' },
  md: { label: 'hidden md:inline', icon: 'md:hidden', padding: 'px-4 md:px-6' },
  lg: { label: 'hidden lg:inline', icon: 'lg:hidden', padding: 'px-4 lg:px-6' },
}

/**
 * Barre de navigation "tubelight" : pilule arrondie avec un halo lumineux qui
 * glisse sous l'onglet actif (animation partagee via layoutId).
 *
 * @param {Object} props
 * @param {Array<{name: string, url: string, icon: Function}>} props.items onglets
 * @param {string} [props.className]
 * @param {boolean} [props.floating] flottante et centree a l'ecran (defaut) ou
 *   integree dans un conteneur parent (`false`)
 * @param {(item: Object) => void} [props.onSelect] si fourni, chaque onglet est
 *   un <button> qui delegue la navigation (utile pour les ancres avec scroll doux)
 * @param {'sm'|'md'|'lg'} [props.labelsFrom] palier a partir duquel les libelles
 *   remplacent les icones. A monter si les libelles sont longs.
 */
export function NavBar({ items, className, floating = true, onSelect, labelsFrom = 'md' }) {
  const responsive = BREAKPOINTS[labelsFrom] ?? BREAKPOINTS.md
  const { pathname } = useLocation()
  const [activeTab, setActiveTab] = useState(
    () => items.find((item) => item.url === pathname)?.name ?? items[0].name,
  )

  // Une navigation declenchee ailleurs (lien de page, retour navigateur) doit
  // aussi deplacer le halo : on resynchronise sur l'URL courante.
  useEffect(() => {
    const match = items.find((item) => item.url === pathname)
    if (match) setActiveTab(match.name)
  }, [pathname, items])

  return (
    <div
      className={cn(
        floating && 'fixed bottom-0 sm:top-0 left-1/2 -translate-x-1/2 z-50 mb-6 sm:pt-6',
        className,
      )}
    >
      <div className="isolate flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-container)] px-1 py-1 shadow-lg backdrop-blur-lg">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          const content = (
            <>
              <span className={responsive.label}>{item.name}</span>
              <span className={responsive.icon} aria-hidden="true">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="tubelight"
                  className="absolute inset-0 -z-10 w-full rounded-full"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                >
                  <div className="absolute inset-0 rounded-full bg-[var(--color-primary)] opacity-[0.07]" />
                  <div className="absolute -top-2 left-1/2 h-1 w-8 -translate-x-1/2 rounded-t-full bg-[var(--color-primary)]">
                    <div className="absolute -left-2 -top-2 h-6 w-12 rounded-full bg-[var(--color-primary)] opacity-20 blur-md" />
                    <div className="absolute -top-1 h-6 w-8 rounded-full bg-[var(--color-primary)] opacity-20 blur-md" />
                    <div className="absolute left-2 top-0 h-4 w-4 rounded-full bg-[var(--color-primary)] opacity-20 blur-sm" />
                  </div>
                </motion.div>
              )}
            </>
          )

          const classes = cn(
            'relative cursor-pointer whitespace-nowrap rounded-full py-2 text-sm font-semibold transition-colors',
            responsive.padding,
            'text-[var(--color-on-surface)]/80 hover:text-[var(--color-primary)]',
            isActive && 'bg-[var(--color-surface-container-high)] text-[var(--color-primary)]',
          )

          return onSelect ? (
            <button
              key={item.name}
              type="button"
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                setActiveTab(item.name)
                onSelect(item)
              }}
              className={classes}
            >
              {content}
            </button>
          ) : (
            <Link
              key={item.name}
              to={item.url}
              aria-label={item.name}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => setActiveTab(item.name)}
              className={classes}
            >
              {content}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
