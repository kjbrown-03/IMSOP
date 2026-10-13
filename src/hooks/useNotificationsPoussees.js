import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'

/**
 * Abonnement de CET appareil aux notifications poussées.
 *
 * TROIS CONTRAINTES VENUES D'APPLE, QU'ON NE PEUT PAS CONTOURNER
 *
 * 1. Sur iPhone, les notifications n'existent que si l'application a été ajoutée
 *    à l'écran d'accueil. Dans un onglet Safari, `PushManager` est parfois même
 *    absent — d'où les vérifications d'existence plutôt que la confiance.
 * 2. `Notification.requestPermission()` doit partir d'un geste de l'utilisateur.
 *    Appelé au chargement, il est refusé sans rien demander — c'est pourquoi ce
 *    hook expose une fonction à brancher sur un bouton, et ne fait rien tout
 *    seul.
 * 3. Un refus est définitif pour le site : le navigateur ne redemandera plus.
 *    On distingue donc « refusé » de « pas encore demandé », pour ne pas
 *    afficher un bouton qui ne produirait aucun effet.
 */

/** La clé VAPID voyage en base64url ; `applicationServerKey` veut des octets. */
function versOctets(base64url) {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4)
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const brut = atob(base64)
  return Uint8Array.from(brut, (c) => c.charCodeAt(0))
}

const SUPPORTE =
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export function useNotificationsPoussees() {
  const [etat, setEtat] = useState('inconnu') // inconnu | indisponible | refuse | inactif | actif
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState(null)
  // `envoye` dit que le serveur a accepte et transmis — PAS que le telephone a
  // affiche. Seul l'utilisateur peut constater l'affichage, et le libelle le dit.
  const [essai, setEssai] = useState(null)

  useEffect(() => {
    let vivant = true

    async function regarder() {
      if (!SUPPORTE) {
        if (vivant) setEtat('indisponible')
        return
      }
      if (Notification.permission === 'denied') {
        if (vivant) setEtat('refuse')
        return
      }
      try {
        const registration = await navigator.serviceWorker.ready
        const abonnement = await registration.pushManager.getSubscription()
        if (vivant) setEtat(abonnement ? 'actif' : 'inactif')
      } catch {
        if (vivant) setEtat('indisponible')
      }
    }

    regarder()
    return () => {
      vivant = false
    }
  }, [])

  /** À brancher sur un bouton : Apple exige un geste de l'utilisateur. */
  const activer = useCallback(async () => {
    setErreur(null)
    setEnCours(true)
    try {
      const { data } = await api.get('/push/cle')
      if (!data.disponible) {
        // Le serveur n'a pas de clés : les notifications ne sont pas configurées
        // sur cette installation. Ce n'est pas la faute de l'utilisateur.
        setEtat('indisponible')
        return
      }

      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setEtat(permission === 'denied' ? 'refuse' : 'inactif')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const abonnement = await registration.pushManager.subscribe({
        // Obligatoire sur tous les navigateurs modernes : on s'engage à ce que
        // chaque notification soit visible. Une notification silencieuse servirait
        // à pister, et le navigateur révoquerait l'autorisation.
        userVisibleOnly: true,
        applicationServerKey: versOctets(data.cle),
      })

      await api.post('/push/abonnements', abonnement.toJSON())
      setEtat('actif')
    } catch (e) {
      setErreur(e?.response?.data?.message || e?.message || 'Activation impossible')
    } finally {
      setEnCours(false)
    }
  }, [])

  const desactiver = useCallback(async () => {
    setErreur(null)
    setEnCours(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const abonnement = await registration.pushManager.getSubscription()
      if (abonnement) {
        // On prévient le serveur AVANT de résilier côté navigateur : l'inverse
        // laisserait un abonnement mort en base si la requête échouait.
        await api.delete('/push/abonnements', { data: { endpoint: abonnement.endpoint } }).catch(() => {})
        await abonnement.unsubscribe()
      }
      setEtat('inactif')
    } catch (e) {
      setErreur(e?.message || 'Désactivation impossible')
    } finally {
      setEnCours(false)
    }
  }, [])

  /**
   * Demande au serveur de nous notifier nous-memes.
   *
   * C'est le seul essai qui prouve quelque chose : il traverse les cles du
   * serveur, l'abonnement, le relais d'Apple ou de Google, le service worker et
   * l'affichage. Une verification cote navigateur seul ne dirait rien du reste.
   */
  const essayer = useCallback(async () => {
    setErreur(null)
    setEnCours(true)
    setEssai(null)
    try {
      await api.post('/push/essai')
      setEssai('envoye')
    } catch (e) {
      // 409 : plus aucun appareil joignable. L'abonnement a ete revoque du cote
      // du navigateur sans qu'on en soit averti — il faut reactiver.
      if (e?.response?.status === 409) setEtat('inactif')
      setErreur(e?.response?.data?.message || "L'essai n'a pas pu partir")
    } finally {
      setEnCours(false)
    }
  }, [])

  return { etat, enCours, erreur, essai, activer, desactiver, essayer }
}

export default useNotificationsPoussees
