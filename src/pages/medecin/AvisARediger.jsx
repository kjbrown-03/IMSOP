import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, FileSignature, HelpCircle, Play, ShieldAlert, X } from 'lucide-react'
import MedecinShell from '../../components/layout/MedecinShell'
import { ReponseComplement } from '../../components/ui/ComplementDemande'
import { api } from '../../lib/api'

// Tant que le rapport n'est pas remis, le medecin peut encore se retirer. Passe ce
// point, le serveur refuse : on n'affiche donc pas un bouton qui echouerait.
const STATUTS_RECUSABLES = new Set([
  'AFFECTE',
  'ACCEPTE_PAR_SPECIALISTE',
  'EN_ANALYSE',
  'INFORMATION_COMPLEMENTAIRE_DEMANDEE',
  'RAPPORT_EN_PREPARATION',
])
const STATUTS_COMPLEMENT = new Set(['ACCEPTE_PAR_SPECIALISTE', 'EN_ANALYSE', 'RAPPORT_EN_PREPARATION'])

const champ =
  'w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500'

export default function AvisARediger() {
  const { t } = useTranslation()
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [enCours, setEnCours] = useState(null)
  // Un seul formulaire ouvert a la fois : { id, action: 'refuser'|'complement'|'conflit' }.
  const [saisie, setSaisie] = useState(null)
  const [texte, setTexte] = useState('')

  const charger = useCallback(async () => {
    const { data } = await api.get('/dossiers/avis-a-rediger')
    setDossiers(data.items)
  }, [])

  useEffect(() => {
    let cancelled = false
    charger()
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || t('errors.loadCasesFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [charger, t])

  async function agir(id, chemin, corps) {
    setEnCours(id)
    setError(null)
    try {
      await api.post(`/dossiers/${id}/${chemin}`, corps)
      setSaisie(null)
      setTexte('')
      await charger()
    } catch (err) {
      setError(err.response?.data?.message || t('medecin.avis.actionFailed'))
    } finally {
      setEnCours(null)
    }
  }

  function ouvrirSaisie(id, action) {
    setSaisie({ id, action })
    setTexte('')
  }

  function confirmerSaisie(id) {
    const valeur = texte.trim()
    if (saisie.action === 'refuser') return agir(id, 'refuser', valeur ? { motif: valeur } : {})
    if (saisie.action === 'complement') return agir(id, 'demander-complement', { precisions: valeur })
    return agir(id, 'conflit-interets', { motif: valeur })
  }

  // Memes bornes que le serveur : le bouton n'est actif que si l'envoi peut aboutir.
  const saisieValide =
    saisie?.action === 'refuser' ||
    (saisie?.action === 'complement' && texte.trim().length > 0) ||
    (saisie?.action === 'conflit' && texte.trim().length >= 10)

  return (
    <MedecinShell>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('medecin.avis.title')}
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm">{t('medecin.avis.subtitle')}</p>
      </section>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {loading && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400">{t('medecin.dashboard.loading')}</div>
      )}

      {!loading && dossiers.length === 0 && !error && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <FileSignature className="w-8 h-8 text-slate-300 dark:text-neutral-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-neutral-400 text-sm leading-relaxed max-w-md mx-auto">{t('medecin.avis.empty')}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {dossiers.map((d) => {
          const occupe = enCours === d.id
          const formulaire = saisie?.id === d.id ? saisie.action : null
          return (
            <article key={d.id} className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-slate-900 dark:text-white truncate">{d.specialiteRequise}</h2>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                    {t('medecin.dashboard.reference')} #{d.reference}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] font-semibold rounded-lg px-2 py-1 bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300">
                  {t(`dossierStatus.${d.status}`, { defaultValue: d.status })}
                </span>
              </div>

              <p className="text-sm text-slate-600 dark:text-neutral-300 line-clamp-3">{d.motif}</p>

              {d.status === 'INFORMATION_COMPLEMENTAIRE_DEMANDEE' && (
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 shrink-0" /> {t('specialiste.dashboard.awaitingComplement')}
                </p>
              )}
              <ReponseComplement dossier={d} />

              {formulaire ? (
                <div className="flex flex-col gap-2 mt-1">
                  <label className="text-xs text-slate-500 dark:text-neutral-400">
                    {t(`medecin.avis.${formulaire}Aide`)}
                    <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={3} maxLength={2000} className={`${champ} mt-1`} />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSaisie(null)}
                      className="flex-1 text-sm font-semibold text-slate-500 dark:text-neutral-400 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800"
                    >
                      {t('specialiste.dashboard.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => confirmerSaisie(d.id)}
                      disabled={occupe || !saisieValide}
                      className="flex-1 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60"
                    >
                      {t('specialiste.dashboard.confirm')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 mt-1">
                  {d.status === 'AFFECTE' && (
                    <>
                      <button
                        type="button"
                        onClick={() => ouvrirSaisie(d.id, 'refuser')}
                        disabled={occupe}
                        className="flex-1 min-w-[120px] bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <X className="w-4 h-4" /> {t('specialiste.dashboard.refuse')}
                      </button>
                      <button
                        type="button"
                        onClick={() => agir(d.id, 'accepter')}
                        disabled={occupe}
                        className="flex-1 min-w-[120px] bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Check className="w-4 h-4" /> {t('specialiste.dashboard.accept')}
                      </button>
                    </>
                  )}
                  {d.status === 'ACCEPTE_PAR_SPECIALISTE' && (
                    <button
                      type="button"
                      onClick={() => agir(d.id, 'analyser')}
                      disabled={occupe}
                      className="flex-1 min-w-[120px] bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-700 flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      <Play className="w-4 h-4" /> {t('specialiste.dashboard.startAnalysis')}
                    </button>
                  )}
                  {STATUTS_COMPLEMENT.has(d.status) && (
                    <button
                      type="button"
                      onClick={() => ouvrirSaisie(d.id, 'complement')}
                      disabled={occupe}
                      className="flex-1 min-w-[120px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-sm font-semibold px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      <HelpCircle className="w-4 h-4" /> {t('specialiste.dashboard.askComplement')}
                    </button>
                  )}
                  {d.status !== 'AFFECTE' && (
                    <Link
                      to={`/medecin/avis/${d.id}`}
                      className="flex-1 min-w-[120px] bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-neutral-700 flex items-center justify-center gap-1.5"
                    >
                      {t('specialiste.dashboard.openReport')}
                    </Link>
                  )}
                </div>
              )}

              {!formulaire && STATUTS_RECUSABLES.has(d.status) && (
                <button
                  type="button"
                  onClick={() => ouvrirSaisie(d.id, 'conflit')}
                  className="self-start text-xs font-semibold text-slate-500 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" /> {t('specialiste.dashboard.declareConflict')}
                </button>
              )}
            </article>
          )
        })}
      </div>
    </MedecinShell>
  )
}
