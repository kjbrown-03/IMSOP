import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'

/**
 * Tuile d'indicateur : un chiffre unique et son libellé (CDC §63).
 *
 * Un indicateur non calculable n'affiche PAS zéro. « 0 réclamation » et
 * « on ne sait pas compter les réclamations » sont deux affirmations très
 * différentes, et confondre les deux fait prendre de mauvaises décisions.
 */
export default function StatBloc({ label, valeur, unite, note, indisponible, raison, approximation }) {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'

  if (indisponible) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700 p-5 flex flex-col gap-2 bg-slate-50/50 dark:bg-neutral-800/30">
        <span className="text-sm font-medium text-slate-500 dark:text-neutral-400">{label}</span>
        <span className="text-2xl font-display font-bold text-slate-300 dark:text-neutral-600 tabular-nums">—</span>
        <span className="text-xs text-slate-400 dark:text-neutral-500 flex items-start gap-1.5 leading-snug">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          {raison}
        </span>
      </div>
    )
  }

  const vide = valeur === null || valeur === undefined || (Array.isArray(valeur) && valeur.length === 0)

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-neutral-700 p-5 flex flex-col gap-1.5 bg-white dark:bg-neutral-900">
      <span className="text-sm font-medium text-slate-500 dark:text-neutral-400">{label}</span>
      {vide ? (
        // Un taux sans dénominateur n'est pas 0 % : il n'existe pas encore.
        <span className="text-2xl font-display font-bold text-slate-300 dark:text-neutral-600">—</span>
      ) : Array.isArray(valeur) ? (
        <span className="flex flex-col gap-0.5">
          {valeur.map((v) => (
            <span key={v.devise} className="text-2xl font-display font-bold text-slate-900 dark:text-white tabular-nums">
              {v.montant?.toLocaleString(locale) ?? '—'}
              <span className="text-sm font-sans font-medium text-slate-400 dark:text-neutral-500 ml-1.5">{v.devise}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="text-3xl font-display font-bold text-slate-900 dark:text-white tabular-nums">
          {typeof valeur === 'number' ? valeur.toLocaleString(locale) : valeur}
          {unite && <span className="text-base font-sans font-medium text-slate-400 dark:text-neutral-500 ml-1">{unite}</span>}
        </span>
      )}
      {(note || approximation) && (
        <span className="text-xs text-slate-400 dark:text-neutral-500 leading-snug">
          {approximation && <span className="font-medium">≈ </span>}
          {note}
        </span>
      )}
    </div>
  )
}
