import { useTranslation } from 'react-i18next'
import { AlarmClock, AlertTriangle, Clock } from 'lucide-react'

/**
 * Temps restant avant l'échéance de réponse d'un dossier.
 *
 * `maintenant` vient du parent : une horloge partagée par toute la liste évite
 * d'ouvrir un intervalle par ligne, et garantit que toutes les lignes affichent
 * le même instant.
 *
 * Les deux bornes sont reçues en absolu (`alerteLe`, `echeanceLe`), ce qui
 * permet de changer de couleur en les franchissant sans redemander la liste au
 * serveur ni connaître son réglage de délai.
 */
export default function CompteARebours({ alerteLe, echeanceLe, maintenant }) {
  const { t } = useTranslation()

  const echeance = new Date(echeanceLe).getTime()
  const alerte = new Date(alerteLe).getTime()
  const restant = echeance - maintenant

  const niveau = restant <= 0 ? 'depasse' : maintenant >= alerte ? 'alerte' : 'normal'

  const STYLES = {
    normal: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    alerte: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    depasse: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
  }
  const Icone = { normal: Clock, alerte: AlarmClock, depasse: AlertTriangle }[niveau]

  // Au-delà de l'échéance on compte le retard, pas un temps restant négatif :
  // « en retard de 6 h » se lit, « -6 h » se déchiffre.
  const ecart = Math.abs(restant)
  const heures = Math.floor(ecart / 3_600_000)
  const minutes = Math.floor((ecart % 3_600_000) / 60_000)
  const duree = heures > 0 ? `${heures} h ${String(minutes).padStart(2, '0')}` : `${minutes} min`

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold tabular-nums ${STYLES[niveau]}`}
      title={t('coordinateur.delai.echeance', { date: new Date(echeanceLe).toLocaleString() })}
    >
      <Icone className="w-3.5 h-3.5 shrink-0" />
      {niveau === 'depasse' ? t('coordinateur.delai.retard', { duree }) : t('coordinateur.delai.restant', { duree })}
    </span>
  )
}
