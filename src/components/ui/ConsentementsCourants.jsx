import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, MinusCircle, ShieldCheck, XCircle } from 'lucide-react'
import { api } from '../../lib/api'

/**
 * État courant des consentements d'un dossier.
 *
 * La table des consentements est append-only : révoquer écrit une nouvelle ligne
 * plutôt que d'effacer la précédente, ce qui garde la preuve du revirement.
 * L'historique n'est donc pas lisible tel quel — c'est `/consentements/courants`
 * qui rend, pour chaque type, la ligne qui fait foi.
 */
export default function ConsentementsCourants({ dossierId }) {
  const { t } = useTranslation()
  const [consentements, setConsentements] = useState(null)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    if (!dossierId) return undefined
    let annule = false

    async function charger() {
      try {
        const { data } = await api.get(`/dossiers/${dossierId}/consentements/courants`)
        if (!annule) setConsentements(data)
      } catch (err) {
        if (!annule) setErreur(err.response?.data?.message || t('consentement.etatErreur'))
      }
    }

    charger()
    return () => {
      annule = true
    }
  }, [dossierId, t])

  if (erreur) {
    return (
      <section className="glass-card rounded-3xl p-6 shadow-sm">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{erreur}</p>
      </section>
    )
  }

  if (!consentements) return null

  return (
    <section className="glass-card rounded-3xl p-6 shadow-sm mb-8 animate-fade-in-up">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100/60 dark:border-neutral-800">
        <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('consentement.etatTitre')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('consentement.etatSousTitre')}</p>
        </div>
      </div>

      <ul className="flex flex-col divide-y divide-slate-100/60 dark:divide-neutral-800">
        {consentements.map(({ type, renseigne, accepted, decideLe }) => {
          // « Jamais demandé » et « retiré » valent tous deux false : les
          // présenter pareil laisserait croire à un refus qui n'a pas eu lieu.
          const Icone = !renseigne ? MinusCircle : accepted ? CheckCircle2 : XCircle
          const couleur = !renseigne
            ? 'text-slate-400 dark:text-neutral-500'
            : accepted
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'

          const date = decideLe
            ? new Date(decideLe).toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' })
            : null

          return (
            <li key={type} className="flex items-start gap-3 py-3">
              <Icone className={`w-5 h-5 shrink-0 mt-0.5 ${couleur}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {t(`consentement.types.${type}`)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {!renseigne
                    ? t('consentement.etatNonDemande')
                    : accepted
                      ? t('consentement.etatAccorde', { date })
                      : t('consentement.etatRetire', { date })}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
