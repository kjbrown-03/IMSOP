import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Loader2 } from 'lucide-react'
import ChampMotDePasse from './ChampMotDePasse'
import { api } from '../../lib/api'
import { supprimerSession } from '../../lib/session'

/**
 * Changement de mot de passe depuis « Mon profil ».
 *
 * Un praticien recruté reçoit un mot de passe généré par la plateforme, envoyé
 * en clair dans un courriel. Tant qu'il ne peut pas le remplacer, ce courriel
 * reste une clé de son compte — dans sa boîte, et dans celle de qui la lirait.
 *
 * Le serveur révoque toutes les sessions au passage : on redirige donc vers la
 * connexion plutôt que de laisser un écran qui ne répond plus.
 */
const CHAMP =
  'w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500'

const LONGUEUR_MIN = 8

export default function ChangementMotDePasse() {
  const { t } = useTranslation()

  const [actuel, setActuel] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [succes, setSucces] = useState(false)

  const tropCourt = nouveau.length > 0 && nouveau.length < LONGUEUR_MIN
  const discordance = confirmation.length > 0 && confirmation !== nouveau
  const pret = actuel && nouveau.length >= LONGUEUR_MIN && confirmation === nouveau

  async function envoyer(e) {
    e.preventDefault()
    if (!pret) return

    setEnvoi(true)
    setErreur(null)
    try {
      await api.post('/auth/mot-de-passe', { motDePasseActuel: actuel, nouveauMotDePasse: nouveau })
      setSucces(true)
      // Le mot de passe a changé : la session en cours n'est plus valable.
      // Laisser l'utilisateur sur place lui donnerait une application muette.
      setTimeout(() => {
        supprimerSession(roleCourant())
        window.location.href = '/connexion'
      }, 2500)
    } catch (err) {
      setErreur(err.response?.data?.message || t('profile.password.echec'))
    } finally {
      setEnvoi(false)
    }
  }

  if (succes) {
    return (
      <section className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">{t('profile.password.succes')}</p>
      </section>
    )
  }

  return (
    <section className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5 mb-1">
        <KeyRound className="w-5 h-5 text-primary-600" /> {t('profile.password.titre')}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('profile.password.aide')}</p>

      {erreur && (
        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-4 py-3 mb-4">
          {erreur}
        </div>
      )}

      <form onSubmit={envoyer} className="flex flex-col gap-4 max-w-md">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('profile.password.actuel')}</span>
          <ChampMotDePasse
            className={CHAMP}
            value={actuel}
            onChange={(e) => setActuel(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('profile.password.nouveau')}</span>
          <ChampMotDePasse
            className={CHAMP}
            value={nouveau}
            onChange={(e) => setNouveau(e.target.value)}
            autoComplete="new-password"
            required
          />
          <span className={`text-xs ${tropCourt ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}>
            {t('profile.password.longueur', { n: LONGUEUR_MIN })}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('profile.password.confirmer')}</span>
          <ChampMotDePasse
            className={CHAMP}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="new-password"
            required
          />
          {discordance && (
            <span className="text-xs text-rose-600 dark:text-rose-400">{t('profile.password.discordance')}</span>
          )}
        </label>

        <button
          type="submit"
          disabled={!pret || envoi}
          className="self-start bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-50 transition-colors flex items-center gap-2 disabled:opacity-60"
        >
          {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('profile.password.valider')}
        </button>
      </form>
    </section>
  )
}

// Le rôle de l'onglet courant, pour n'effacer que cette session-là : les autres
// espaces ouverts dans d'autres onglets appartiennent à d'autres comptes.
function roleCourant() {
  try {
    return sessionStorage.getItem('imsop_role_actif')
  } catch {
    return null
  }
}
