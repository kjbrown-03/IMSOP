import { create } from 'zustand'

/**
 * Transition de damier jouée à l'entrée d'un espace connecté.
 *
 * Le déclencheur (formulaire de connexion, vérification 2FA, retour OAuth,
 * vérification d'e-mail) et l'écran qui la joue ne se connaissent pas : le
 * premier appelle `jouer()` juste avant de naviguer, le second est monté une
 * seule fois au niveau de l'application. Passer par l'état de navigation
 * obligerait chaque tableau de bord d'arrivée à s'en occuper lui-même.
 */
export const useTransitionStore = create((set) => ({
  actif: false,
  jouer: () => set({ actif: true }),
  terminer: () => set({ actif: false }),
}))
