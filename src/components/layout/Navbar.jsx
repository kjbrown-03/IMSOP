import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { HelpCircle, LayoutGrid, Stethoscope } from 'lucide-react'
import { NavBar } from '@/components/ui/tubelight-navbar'
import Logo from '../ui/Logo'
import ThemeToggle from '../ui/ThemeToggle'
import { useLanguageStore } from '../../store/useLanguageStore'

const LINKS = [
  { key: 'howItWorks', href: '/#fonctionnement', icon: HelpCircle },
  { key: 'specialties', href: '/#specialites', icon: LayoutGrid },
  { key: 'forDoctors', href: '/pour-medecins', icon: Stethoscope },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const lang = useLanguageStore((s) => s.lang)
  const toggleLang = useLanguageStore((s) => s.toggleLang)
  const navigate = useNavigate()
  const { t } = useTranslation()

  const navItems = useMemo(
    () => LINKS.map((link) => ({ name: t(`nav.${link.key}`), url: link.href, icon: link.icon })),
    [t],
  )

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function goToLink(href) {
    setMenuOpen(false)
    if (href.startsWith('/#')) {
      if (window.location.pathname !== '/') {
        navigate(href)
        return
      }
      const el = document.querySelector(href.slice(1))
      el?.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate(href)
    }
  }

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        scrolled ? 'bg-[var(--color-surface)]/85 backdrop-blur-xl shadow-lg border-b border-[var(--color-border)]' : 'bg-[var(--color-surface)] border-b border-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center" onClick={() => setMenuOpen(false)}>
          <Logo light={false} size={52} />
        </Link>

        <NavBar
          items={navItems}
          floating={false}
          labelsFrom="lg"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:static md:translate-x-0"
          onSelect={(item) => goToLink(item.url)}
        />

        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle className="text-[var(--color-on-surface)] hover:text-[var(--color-primary)]" />
          <button
            onClick={toggleLang}
            aria-label="Changer de langue / Switch language"
            className="flex items-center gap-1.5 text-[var(--color-on-surface)] hover:text-[var(--color-primary)] font-label-sm text-label-sm border border-[var(--color-border)] rounded-full px-3 py-1.5 transition-colors hover:bg-[var(--color-bg-2)]"
          >
            <span className="material-symbols-outlined text-[16px]">language</span>
            {lang === 'fr' ? 'FR' : 'EN'}
          </button>
          <Link
            to="/connexion"
            className="bg-[var(--color-primary)] text-[var(--color-on-primary)] font-sans text-[13px] font-bold uppercase tracking-wide px-5 py-2.5 rounded-full hover:opacity-90 transition-opacity shadow-md"
          >
            {t('nav.login')}
          </Link>
        </div>

        <button
          className="md:hidden text-[var(--color-text-primary)] p-2"
          aria-label="Ouvrir le menu"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <span className="material-symbols-outlined text-3xl">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-[var(--color-surface)] border-t border-[var(--color-border)] px-margin-mobile py-4 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <button
              onClick={toggleLang}
              className="flex items-center gap-1.5 text-[var(--color-on-surface)] font-label-sm text-label-sm border border-[var(--color-border)] rounded-full px-3 py-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">language</span>
              {lang === 'fr' ? 'FR' : 'EN'}
            </button>
            <Link
              to="/connexion"
              onClick={() => setMenuOpen(false)}
              className="bg-[var(--color-primary)] text-[var(--color-on-primary)] font-sans text-[13px] font-bold uppercase tracking-wide px-5 py-2.5 rounded-full"
            >
              {t('nav.login')}
            </Link>
          </div>
        </div>
      )}
    </nav>
  )
}
