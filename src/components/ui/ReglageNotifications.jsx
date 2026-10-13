import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import useNotificationsPoussees from '../../hooks/useNotificationsPoussees'

/**
 * Activation des notifications sur CET appareil.
 *
 * « Cet appareil » n'est pas une précision de détail : l'autorisation est liée
 * au navigateur, pas au compte. Quelqu'un qui l'active sur son téléphone ne
 * recevra rien sur son ordinateur tant qu'il n'aura pas fait de même là-bas.
 * Le libellé le dit, sinon l'absence de notification passerait pour une panne.
 */
export default function ReglageNotifications() {
  const { t } = useTranslation()
  const { etat, enCours, erreur, activer, desactiver } = useNotificationsPoussees()

  // Rien à proposer sur un appareil qui ne sait pas les recevoir. Afficher un
  // bouton mort serait pire que de ne rien afficher.
  if (etat === 'inconnu' || etat === 'indisponible') return null

  const actif = etat === 'actif'
  const refuse = etat === 'refuse'

  return (
    <section className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {actif ? (
          <Bell className="w-5 h-5 text-primary-600 dark:text-primary-400 shrink-0 mt-0.5" />
        ) : (
          <BellOff className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
        )}
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-slate-900 dark:text-white">{t('notifications.titre')}</h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">
            {refuse ? t('notifications.refuseAide') : t('notifications.aide')}
          </p>
        </div>
      </div>

      {/* Un refus est definitif pour le site : le navigateur ne redemandera
          plus, et un bouton ici ne produirait aucun effet. On explique ou aller
          plutot que de laisser l'utilisateur appuyer dans le vide. */}
      {refuse ? (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl px-4 py-3">
          {t('notifications.refuseSolution')}
        </p>
      ) : (
        <button
          type="button"
          onClick={actif ? desactiver : activer}
          disabled={enCours}
          className={`self-start inline-flex items-center gap-2 rounded-xl px-5 py-2.5 font-semibold text-sm transition-colors disabled:opacity-60 ${
            actif
              ? 'border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800'
              : 'bg-primary-600 text-white hover:bg-primary-700'
          }`}
        >
          {enCours && <Loader2 className="w-4 h-4 animate-spin" />}
          {actif ? t('notifications.desactiver') : t('notifications.activer')}
        </button>
      )}

      {erreur && <p className="text-sm text-red-600 dark:text-red-400">{erreur}</p>}

      {/* Sur iPhone, rien ne fonctionne depuis un onglet Safari : l'application
          doit avoir ete ajoutee a l'ecran d'accueil. Plutot que de laisser
          l'utilisateur conclure a une panne, on le dit — mais seulement sur iOS,
          ou la contrainte existe. */}
      {estIOS() && !estInstallee() && (
        <p className="text-sm text-slate-600 dark:text-neutral-400 flex items-start gap-2 bg-slate-50 dark:bg-neutral-800/60 rounded-xl px-4 py-3">
          <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
          {t('notifications.iosInstaller')}
        </p>
      )}
    </section>
  )
}

function estIOS() {
  if (typeof navigator === 'undefined') return false
  // `MacIntel` + ecran tactile : un iPad recent se declare comme un Mac.
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

function estInstallee() {
  if (typeof window === 'undefined') return false
  // `standalone` est la propriete propre a Safari iOS ; `display-mode` couvre le
  // reste.
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}
