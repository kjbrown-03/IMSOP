import { Children } from 'react'
import { cn } from '@/lib/utils'

/**
 * Bande qui défile horizontalement, en boucle continue.
 *
 * Le contenu est rendu deux fois : l'animation décale la piste de la moitié de
 * sa largeur, ce qui la ramène pile sur la copie suivante. Le raccord est donc
 * invisible et le défilement n'a ni début ni fin.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children éléments à faire défiler
 * @param {number} [props.duree] secondes pour un tour complet (plus grand = plus lent)
 * @param {number} [props.espacement] écart entre éléments, en pixels
 * @param {boolean} [props.inverse] défile de la droite vers la gauche
 * @param {string} [props.className]
 */
export default function Marquee({ children, duree = 40, espacement = 20, inverse = false, className }) {
  const elements = Children.toArray(children)
  if (elements.length === 0) return null

  return (
    <div className={cn('marquee-pause relative overflow-hidden', className)}>
      <div
        className="marquee-piste flex w-max"
        style={{
          '--marquee-duree': `${duree}s`,
          animationDirection: inverse ? 'reverse' : 'normal',
        }}
      >
        {[0, 1].map((copie) => (
          // La seconde copie n'existe que pour la boucle : les lecteurs d'écran
          // ne doivent pas annoncer deux fois le même contenu.
          <div key={copie} className="flex shrink-0" aria-hidden={copie === 1 ? 'true' : undefined}>
            {elements.map((element, index) => (
              <div key={index} className="shrink-0" style={{ marginRight: espacement }}>
                {element}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
