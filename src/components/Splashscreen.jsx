import { useEffect, useState } from 'react'

// Trajet Afrique -> international. Défini une seule fois : la courbe visible
// (le pointillé) et la trajectoire du point voyageur (<animateMotion>) DOIVENT
// utiliser exactement le même tracé, sinon le dossier ne suivrait pas la route
// qu'on lui dessine.
const ROUTE = 'M 75 88 Q 100 40 135 42'
const TRAVEL_DURATION_S = 3.4

// Points discrets évoquant une carte du monde en arrière-plan.
const MAP_DOTS = [
  [30, 40], [60, 30], [90, 45], [120, 35], [150, 50],
  [55, 70], [80, 85], [110, 75], [140, 90],
]

// Les lettres n'apparaissent pas d'un bloc : chacune se révèle à son tour,
// pendant que le dossier fait son voyage.
const WORDMARK = ['I', 'M', 'S', 'O', 'P']
const LETTER_START = 0.9 // s - la première lettre s'allume une fois le trajet entamé
const LETTER_STAGGER = 0.32 // s - écart entre deux lettres consécutives
const LETTER_FADE_MS = 500
const SUBTITLE_START = LETTER_START + (WORDMARK.length - 1) * LETTER_STAGGER + 0.4
const SUBTITLE_END_MS = SUBTITLE_START * 1000 + LETTER_FADE_MS

// Le plus long des deux - un voyage complet du dossier, ou la révélation
// entière du texte - plus une courte pause avant de disparaître. Le §
// "minimum 1.2s" du cahier de départ est largement dépassé ici : un splash
// qui s'efface avant la fin de sa propre animation se lit comme un bug.
const DEFAULT_MIN_VISIBLE_MS = Math.max(TRAVEL_DURATION_S * 1000, SUBTITLE_END_MS) + 600

/**
 * SplashScreen IMSOP — concept "carte + pin" : une carte stylisée, un point
 * doré (l'Afrique), un point blanc (l'international), et un dossier qui
 * voyage entre les deux le long d'une route en pointillés. Le mot "IMSOP"
 * se révèle lettre par lettre pendant ce trajet.
 *
 * Comportement :
 * - reste affiché au moins `minVisibleMs` même si `isLoading` repasse à
 *   false plus vite - géré par un état interne (`minDelayElapsed`) +
 *   `setTimeout`, jamais en lisant `isLoading` seul ;
 * - une fois le délai minimum passé ET `isLoading === false`, s'efface en
 *   fondu (+ léger scale) sur `fadeMs`, puis se démonte du DOM
 *   (`return null`) - il ne reste pas caché en arrière-plan ;
 * - respecte `prefers-reduced-motion` : le défilement du pointillé et la
 *   révélation des lettres sont coupés en CSS (index.css), et le point
 *   voyageur est simplement retiré côté JS - <animateMotion> est du SMIL,
 *   qu'une media query CSS ne peut pas désactiver.
 *
 * Usage : voir l'intégration dans App.jsx (prop `isLoading`).
 */
export default function SplashScreen({ isLoading, minVisibleMs = DEFAULT_MIN_VISIBLE_MS, fadeMs = 300 }) {
  const [minDelayElapsed, setMinDelayElapsed] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [unmounted, setUnmounted] = useState(false)
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(media.matches)
    const onChange = (e) => setReduceMotion(e.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => setMinDelayElapsed(true), minVisibleMs)
    return () => clearTimeout(timer)
  }, [minVisibleMs])

  useEffect(() => {
    if (!minDelayElapsed || isLoading) return
    setHiding(true)
    const timer = setTimeout(() => setUnmounted(true), fadeMs)
    return () => clearTimeout(timer)
  }, [minDelayElapsed, isLoading, fadeMs])

  if (unmounted) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 md:gap-8 transition-all ease-out ${
        hiding ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        background: 'linear-gradient(160deg, #0B2A45, #0F3A5E)',
        transitionDuration: `${fadeMs}ms`,
      }}
    >
      <span className="sr-only">Chargement d’IMSOP…</span>

      <svg
        viewBox="0 0 200 140"
        aria-hidden="true"
        className="w-64 sm:w-80 md:w-[30rem] lg:w-[36rem]"
      >
        {/* Carte du monde suggérée par quelques points discrets */}
        {MAP_DOTS.map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="#6E92B2" opacity="0.5" />
        ))}

        {/* Route entre l'Afrique et l'international. Le pointillé défile en
            boucle (classe .splash-route dans index.css). */}
        <path
          className="splash-route"
          d={ROUTE}
          fill="none"
          stroke="#E4C77A"
          strokeWidth="1.3"
          strokeDasharray="3 4"
        />

        {/* Afrique : le point de départ */}
        <circle cx="75" cy="88" r="3.4" fill="#C89B3C" />
        {/* International : la destination */}
        <circle cx="135" cy="42" r="3.4" fill="#FFFFFF" />

        {/* Le dossier qui voyage. Retiré (et non figé) sous
            prefers-reduced-motion : les deux extrémités de la route suffisent
            à raconter le trajet sans mouvement. */}
        {!reduceMotion && (
          <circle r="2.6" fill="#EAF3F8">
            <animateMotion dur={`${TRAVEL_DURATION_S}s`} repeatCount="indefinite" path={ROUTE} />
          </circle>
        )}
      </svg>

      <div className="flex flex-col items-center gap-2">
        <p
          className="text-[21px] sm:text-3xl md:text-4xl font-semibold tracking-wide text-white"
          style={{ fontFamily: "'Fraunces', Georgia, serif" }}
        >
          {WORDMARK.map((letter, index) => (
            <span
              key={index}
              className="splash-fade-up inline-block"
              style={{
                color: letter === 'S' ? '#C89B3C' : undefined,
                animationDelay: `${LETTER_START + index * LETTER_STAGGER}s`,
                animationDuration: `${LETTER_FADE_MS}ms`,
              }}
            >
              {letter}
            </span>
          ))}
        </p>
        <p
          className="splash-fade-up font-mono text-[10px] sm:text-xs md:text-sm uppercase tracking-[0.24em] text-center px-6"
          style={{
            color: '#E4C77A',
            animationDelay: `${SUBTITLE_START}s`,
            animationDuration: `${LETTER_FADE_MS}ms`,
          }}
        >
          Votre dossier voyage, pas vous
        </p>
      </div>
    </div>
  )
}
