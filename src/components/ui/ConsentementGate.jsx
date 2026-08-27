import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Loader2, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'

/**
 * Étape obligatoire avant l'envoi d'une demande (patient ou médecin traitant) :
 * télécharger le formulaire de consentement, cocher l'acceptation, taper son
 * nom comme signature électronique. Ce composant ne fait aucun appel réseau
 * pour la signature elle-même - il expose son état au parent, qui l'envoie
 * avec le reste de la demande (voir DocumentsUpload.jsx / NouvelleDemandeMedecin.jsx).
 */
export default function ConsentementGate({ accepted, onAcceptedChange, nomSignataire, onNomChange, disabled }) {
  const { t } = useTranslation()
  const [telechargement, setTelechargement] = useState(false)
  const [erreurTelechargement, setErreurTelechargement] = useState(null)

  async function telecharger() {
    setTelechargement(true)
    setErreurTelechargement(null)
    try {
      const { data } = await api.get('/consentement-pdf', { responseType: 'blob' })
      const url = window.URL.createObjectURL(data)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
    } catch {
      setErreurTelechargement(t('consentement.downloadError'))
    } finally {
      setTelechargement(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[var(--color-primary,theme(colors.primary.600))] bg-white dark:bg-neutral-900 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary-600 shrink-0" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-700 dark:text-primary-400">
          {t('consentement.title')}
        </h2>
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400">{t('consentement.help')}</p>

      <button
        type="button"
        onClick={telecharger}
        disabled={telechargement}
        className="self-start flex items-center gap-2 rounded-lg border border-slate-300 dark:border-neutral-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
      >
        {telechargement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {t('consentement.download')}
      </button>
      {erreurTelechargement && <p className="text-xs font-semibold text-rose-600">{erreurTelechargement}</p>}

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-slate-700 dark:text-neutral-200">{t('consentement.checkboxLabel')}</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
          {t('consentement.signatureLabel')}
        </span>
        <input
          type="text"
          value={nomSignataire}
          onChange={(e) => onNomChange(e.target.value)}
          disabled={disabled || !accepted}
          placeholder={t('consentement.signaturePlaceholder')}
          className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white disabled:opacity-50"
        />
      </label>
    </section>
  )
}
