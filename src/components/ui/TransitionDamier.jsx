import { useEffect } from 'react'
import { useTransitionStore } from '../../store/useTransitionStore'

// Grille du damier. Assez de cases pour que le motif se lise, assez peu pour
// que chacune reste une vraie surface plutôt qu'un grain.
const COLONNES = 8
const LIGNES = 6

// Balayage de gauche à droite : chaque colonne part un cran après la
// précédente, et une case sur deux part un demi-cran plus tard. C'est ce
// décalage alterné qui donne le damier plutôt qu'un simple rideau.
//
// Le rythme se règle ici, et nulle part ailleurs : la feuille de style ne pose
// que le nom, la courbe et le fill-mode, la durée et le délai de chaque case
// sont écrits en style inline à partir de ces trois valeurs.
const PAS_COLONNE = 150
const DECALAGE_ALTERNE = 300
const DUREE_CASE = 850

const DUREE_TOTALE = (COLONNES - 1) * PAS_COLONNE + DECALAGE_ALTERNE + DUREE_CASE

const CASES = Array.from({ length: COLONNES * LIGNES }, (_, index) => {
  const ligne = Math.floor(index / COLONNES)
  const colonne = index % COLONNES
  return { index, delai: colonne * PAS_COLONNE + ((ligne + colonne) % 2) * DECALAGE_ALTERNE }
})

/**
 * Rideau de cases qui se retirent en damier, révélant l'écran en dessous.
 *
 * Monté une seule fois au niveau de l'application (voir App.jsx) et déclenché
 * par `useTransitionStore` : l'écran d'arrivée n'a rien à faire, il se rend
 * normalement pendant que le rideau se retire par-dessus.
 */
export default function TransitionDamier() {
  const actif = useTransitionStore((s) => s.actif)
  const terminer = useTransitionStore((s) => s.terminer)

  useEffect(() => {
    if (!actif) return undefined

    // Réglage système « moins d'animations » : on ne joue rien du tout plutôt
    // que de recouvrir brièvement l'écran sans raison visible.
    const reduit = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduit) {
      terminer()
      return undefined
    }

    const minuteur = setTimeout(terminer, DUREE_TOTALE + 60)
    return () => clearTimeout(minuteur)
  }, [actif, terminer])

  if (!actif) return null

  return (
    <div
      // `pointer-events-none` : le rideau ne dure qu'un instant, il ne doit
      // jamais avaler un clic sur l'écran qu'il découvre.
      className="fixed inset-0 z-[100] pointer-events-none grid"
      style={{
        gridTemplateColumns: `repeat(${COLONNES}, 1fr)`,
        gridTemplateRows: `repeat(${LIGNES}, 1fr)`,
      }}
      aria-hidden="true"
    >
      {CASES.map(({ index, delai }) => (
        <div
          key={index}
          className="damier-case bg-[var(--color-bg)]"
          style={{ animationDelay: `${delai}ms`, animationDuration: `${DUREE_CASE}ms` }}
        />
      ))}
    </div>
  )
}
