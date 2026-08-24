import { useEffect, useRef } from 'react'

/**
 * Re-runs `refresh` while the tab is visible: on a fixed interval, and
 * immediately when the tab regains focus.
 *
 * Le tableau de bord du coordinateur doit refléter ce que font les praticiens
 * (une disponibilité que l'on retire, une habilitation qui change) sans obliger
 * à recharger la page. Les rafraîchissements sont suspendus quand l'onglet est
 * en arrière-plan : inutile d'interroger l'API pour un écran que personne ne
 * regarde, et le retour au premier plan déclenche de toute façon une relecture.
 */
export function useLiveRefresh(refresh, { intervalMs = 30000, enabled = true } = {}) {
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    if (!enabled) return undefined

    const run = () => {
      if (document.visibilityState === 'visible') refreshRef.current()
    }

    const timer = setInterval(run, intervalMs)
    window.addEventListener('focus', run)
    document.addEventListener('visibilitychange', run)

    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [intervalMs, enabled])
}
