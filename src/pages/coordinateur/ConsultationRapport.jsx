import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { api } from '../../lib/api'
import { ArrowLeft, CheckCircle2, FileText, Stethoscope } from 'lucide-react'

// Coordinator-facing report view: read-only by design (no textarea, no save
// endpoint reachable by this role) — validation here is administrative
// conformity, never medical content, so there is nothing to edit.
export default function ConsultationRapport() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [dossier, setDossier] = useState(null)
  const [rapport, setRapport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: dossierData }, { data: rapportData }] = await Promise.all([
          api.get(`/dossiers/${id}`),
          api.get(`/dossiers/${id}/rapport`),
        ])
        if (cancelled) return
        setDossier(dossierData)
        setRapport(rapportData)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('errors.caseNotFound'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  async function valider() {
    if (!rapport) return
    setValidating(true)
    try {
      await api.post(`/rapports/${rapport.id}/valider`)
      navigate('/coordinateur/tableau-de-bord')
    } catch (err) {
      setError(err.response?.data?.message || t('coordinateur.dashboard.validateFailed'))
      setValidating(false)
    }
  }

  if (loading) {
    return (
      <CoordinatorLayout>
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400 animate-fade-in-up">
          {t('common.loading')}
        </div>
      </CoordinatorLayout>
    )
  }

  if (error && !rapport) {
    return (
      <CoordinatorLayout>
        <div className="glass-card rounded-3xl p-10 flex flex-col items-center gap-3 text-center animate-fade-in-up">
          <p className="text-slate-500 dark:text-slate-400">{error}</p>
          <button
            onClick={() => navigate('/coordinateur/tableau-de-bord')}
            className="text-primary-600 dark:text-primary-400 font-semibold text-sm"
          >
            {t('specialiste.report.backToDashboard')}
          </button>
        </div>
      </CoordinatorLayout>
    )
  }

  return (
    <CoordinatorLayout>
      <button
        onClick={() => navigate('/coordinateur/tableau-de-bord')}
        className="mb-6 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t('shell.coordinatorNav.dashboard')}
      </button>

      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white">{t('patient.report.heading')}</h2>
          <span className="inline-block mt-2 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-neutral-800 px-3 py-1 rounded-full border border-slate-200 dark:border-neutral-700">
            {t('patient.report.caseLabel')} #{dossier?.reference}
          </span>
        </div>
        <button
          onClick={valider}
          disabled={validating}
          className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-60 shrink-0"
        >
          <CheckCircle2 className="w-4 h-4" />
          {validating ? t('coordinateur.dashboard.validating') : t('coordinateur.dashboard.validateAndSend')}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
        <section className="glass-card rounded-3xl p-6 shadow-sm flex flex-col h-full animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100/60 dark:border-neutral-800">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('patient.report.caseInfoTitle')}</h3>
          </div>
          <div className="flex flex-col gap-5 flex-grow">
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">{t('patient.report.patientLabel')}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{dossier?.patient?.user?.fullName}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">{t('patient.report.specialiteLabel')}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{dossier?.specialiteRequise}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">{t('patient.report.motifLabel')}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{dossier?.motif}</span>
            </div>
          </div>
        </section>

        <section className="glass-card rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 h-full lg:col-span-2 animate-fade-in-up">
          <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white dark:border-neutral-800 shadow-lg flex-shrink-0 bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Stethoscope className="w-10 h-10 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{dossier?.specialiste?.user?.fullName}</h3>
            <span className="inline-flex self-center items-center gap-1.5 px-3 py-1 mt-2 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 text-xs font-bold uppercase tracking-wider border border-primary-100 dark:border-primary-800">
              <Stethoscope className="w-3.5 h-3.5" /> {dossier?.specialiste?.specialite}
            </span>
          </div>
        </section>

        <section className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm lg:col-span-3 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">{t('patient.report.synthesisTitle')}</h3>
          </div>

          <div className="bg-primary-50/50 dark:bg-primary-900/20 p-5 sm:p-6 rounded-2xl border-l-4 border-primary-500 mb-8 shadow-sm">
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-line">
              {rapport?.diagnostic || t('patient.report.noDiagnostic')}
            </p>
          </div>

          <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-4">{t('patient.report.clinicalSynthesis')}</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-line bg-white/60 dark:bg-neutral-800/60 p-4 rounded-xl border border-slate-100 dark:border-neutral-700">
            {rapport?.synthese || t('patient.report.noSynthesis')}
          </p>
        </section>

        {rapport?.optionsTherapeutiques && (
          <section className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm lg:col-span-3 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">{t('patient.report.therapeuticOptions')}</h3>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">{rapport.optionsTherapeutiques}</p>
          </section>
        )}
      </div>
    </CoordinatorLayout>
  )
}
