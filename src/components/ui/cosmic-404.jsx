import { useEffect, useRef } from 'react'
import createGlobe from 'cobe'
import { cn } from '../../lib/utils'

// Les reperes ne sont pas decoratifs : ils tracent le corridor que la plateforme
// dessert reellement — le bassin CEMAC d'ou partent les demandes de deuxieme
// avis, et l'Europe d'ou vient l'expertise sollicitee.
const REPERES = [
  { location: [3.848, 11.5021], size: 0.08 }, // Yaounde
  { location: [4.0511, 9.7679], size: 0.07 }, // Douala
  { location: [0.4162, 9.4673], size: 0.06 }, // Libreville
  { location: [48.8566, 2.3522], size: 0.07 }, // Paris
  { location: [50.8503, 4.3517], size: 0.06 }, // Bruxelles
]

// Couleurs reprises du theme sombre de l'application : le vert d'eau #8FC4BA
// pour la sphere et son halo, l'or #C9A85C pour les reperes. `diffuse` bas garde
// la sphere uniformement eclairee, comme une bille de verre, plutot que moitie
// dans l'ombre. `mapBrightness` au-dessus de 1 eclaircit les continents par
// rapport a l'ocean, ce qui les fait ressortir sans casser la teinte.
const CONFIG_GLOBE = {
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.25,
  dark: 0,
  diffuse: 0.4,
  mapSamples: 16000,
  mapBrightness: 1.8,
  baseColor: [0.56, 0.77, 0.73], // #8FC4BA
  markerColor: [0.79, 0.66, 0.36], // #C9A85C
  glowColor: [0.56, 0.77, 0.73], // #8FC4BA
  markers: REPERES,
}

export function Globe({ className, config = CONFIG_GLOBE }) {
  const hoteRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    const hote = hoteRef.current
    // Un globe deja en place signifie qu'on est dans le second montage du mode
    // strict : le reinitialiser le casserait, on garde celui qui tourne.
    if (!hote || instanceRef.current) return undefined

    // Deux pieges se cumulent ici, et tous deux se voient surtout en
    // developpement, ou React monte les effets deux fois :
    //   1. cobe ne survit pas a un destroy() suivi d'une reinitialisation sur le
    //      meme canvas — le contexte WebGL reste attache a l'element et revient
    //      inutilisable : la sphere disparait, seuls les marqueurs subsistent ;
    //   2. cobe enveloppe le canvas dans un div a lui. Retirer le seul canvas au
    //      nettoyage laisse donc cette enveloppe orpheline, et les enveloppes
    //      s'empilent jusqu'a pousser le globe hors de sa case.
    // On travaille donc dans un conteneur qu'on possede : canvas neuf a chaque
    // montage, et au nettoyage on retire le conteneur entier, enveloppe comprise.
    // Il est en position absolue pour ne jamais peser sur la hauteur de l'hote.
    const conteneur = document.createElement('div')
    conteneur.style.cssText = 'position:absolute;inset:0'
    hote.appendChild(conteneur)

    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = 'width:100%;height:100%;contain:layout paint size'
    conteneur.appendChild(canvas)

    let largeur = 0
    const mesurer = () => {
      largeur = hote.offsetWidth
    }
    mesurer()
    window.addEventListener('resize', mesurer)

    let phi = 0
    let globe = null
    let abandonne = false

    // cobe ne se remet pas d'un destroy() immediatement suivi d'une nouvelle
    // initialisation : le globe repart fige, sans ses continents. Or c'est
    // exactement ce que provoque le double montage de React en developpement.
    // Reporter la creation d'une frame laisse le nettoyage l'annuler avant
    // qu'elle ait lieu : une seule initialisation survit, dans les deux modes.
    const frame = requestAnimationFrame(() => {
      if (abandonne) return
      // Sans WebGL (machine ancienne, GPU desactive), createGlobe leve. Une page
      // d'erreur qui plante elle-meme serait le pire des accueils : on laisse
      // alors le canvas vide, le reste de la page tient sans lui.
      try {
        globe = createGlobe(canvas, {
          ...config,
          width: largeur * 2,
          height: largeur * 2,
          onRender: (state) => {
            phi += 0.005
            state.phi = phi
          },
        })
      } catch {
        globe = null
      }
      instanceRef.current = { globe, conteneur }
    })

    return () => {
      abandonne = true
      cancelAnimationFrame(frame)
      // Le nettoyage du premier montage strict survient alors que l'hote est
      // toujours dans le document : detruire la ressource la ferait repartir
      // cassee au montage suivant. On attend donc un vrai demontage, reconnu a
      // ce que l'hote a quitte le document.
      queueMicrotask(() => {
        if (hote.isConnected) return
        window.removeEventListener('resize', mesurer)
        const vivant = instanceRef.current
        instanceRef.current = null
        if (vivant?.globe) vivant.globe.destroy()
        if (vivant?.conteneur) vivant.conteneur.remove()
        else conteneur.remove()
      })
    }
  }, [config])

  return <div ref={hoteRef} className={cn('relative aspect-square w-full max-w-md', className)} />
}

export default Globe
