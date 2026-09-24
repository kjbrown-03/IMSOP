import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Timer, ChevronRight, FileText } from 'lucide-react'
import { api } from '../../lib/api'
import { useLiveRefresh } from '../hooks/useLiveRefresh'
import CompteARebours from '../ui/CompteARebours'
import { nomPatient } from '../../lib/dossier'

/**
 * File des dossiers confiés à un spécialiste dont la réponse n'est pas encore
 * parvenue au demandeur, avec leur compte à rebours.
 *
 * Le chrono démarre à l'affectation et s'arrête à la mise à disposition du
 * rapport — pas à sa remise par le spécialiste. Un rapport soumis mais non
 * validé continue donc de décompter : c'est voulu, c'est ce qui empêche un
 * rapport rendu à l'heure de dormir en attente de contrôle.
 */
export default function SuiviDelais() {
  const { t } = useTranslation()
  const [dossiers, setDossiers] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)

  // Une seule horloge pour toute la liste : un intervalle par ligne
  // multiplierait les rendus sans rien apporter, et les lignes pourraient
  // afficher des instants légèrement différents.
  const [maintenant, setMaintenant] = useState(() => Date.now())

  async function charger({ silencieux = false } = {}) {
    if (!silencieux) setChargement(true)
    try {
      const { data } = await api.get('/dossiers/en-cours')
      setDossiers(data)
      setErreur(null)
    } catch (err) {
      if (!silencieux) setErreur(err.response?.data?.message || t('coordinateur.delai.chargementEchoue'))
    } finally {
      if (!silencieux) setChargement(false)
    }
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const battement = setInterval(() => setMaintenant(Date.now()), 1000)
    return () => clearInterval(battement)
  }, [])

  // La liste ne bouge qu'aux changements de statut, qui viennent d'ailleurs :
  // sans relecture, un dossier validé resterait affiché avec son chrono.
  useLiveRefresh(() => charger({ silencieux: true }))

  if (chargement) return null

  return (
    <>
      <div className="flex justify-between items-center mb-6 mt-12 animate-fade-in-up">
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary-600" /> {t('coordinateur.delai.titre')}
        </h3>
        {dossiers.length > 0 && (
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t('coordinateur.delai.compte', { count: dossiers.length })}
          </span>
        )}
      </div>

      {erreur && (
        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4 mb-4">
          {erreur}
        </div>
      )}

      {!erreur && dossiers.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400">
          {t('coordinateur.delai.aucun')}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {dossiers.map((d) => (
          <div
            key={d.id}
            className="glass-card dark:bg-neutral-900 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:shadow-xl dark:hover:shadow-black/40 transition-all duration-300 animate-fade-in-up"
          >
            <div className="flex flex-col gap-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-neutral-700">
                  #{d.reference}
                </span>
                <CompteARebours
                  alerteLe={d.delai.alerteLe}
                  echeanceLe={d.delai.echeanceLe}
                  maintenant={maintenant}
                />
              </div>
              <div className="min-w-0">
                <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">{nomPatient(d, t)}</h4>
                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 truncate">
                  <FileText className="w-4 h-4 shrink-0" />
                  {d.specialiteRequise}
                  {d.specialiste?.user?.fullName && <span>— Dr. {d.specialiste.user.fullName}</span>}
                </div>
              </div>
            </div>

            <Link
              to={`/coordinateur/affectation/${d.id}`}
              className="shrink-0 self-start md:self-center bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
            >
              {t('coordinateur.delai.ouvrir')} <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ))}
      </div>
    </>
  )
}
