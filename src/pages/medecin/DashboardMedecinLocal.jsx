import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageSquare, FolderOpen, ShieldAlert, Stethoscope } from 'lucide-react'
import MedecinShell from '../../components/layout/MedecinShell'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'

export default function DashboardMedecinLocal() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // The API scopes this to the dossiers this doctor was designated on;
        // there is no client-side filtering to get wrong.
        const { data } = await api.get('/dossiers')
        if (!cancelled) setDossiers(data.items)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('errors.loadCasesFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  return (
    <MedecinShell>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('medecin.dashboard.title')}
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm">
          {t('medecin.dashboard.subtitle')}
        </p>
      </section>

      {user?.verificationStatus && user.verificationStatus !== 'VALIDE' && (
        <div className="glass-card bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/40 rounded-2xl p-4 flex gap-3 items-start">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
            {t(`medecin.habilitation.${user.verificationStatus}`)}
            {user.verificationMotif && <span className="block mt-1 font-medium">{user.verificationMotif}</span>}
          </p>
        </div>
      )}

      {loading && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400">
          {t('medecin.dashboard.loading')}
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && dossiers.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <Stethoscope className="w-8 h-8 text-slate-300 dark:text-neutral-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-neutral-400 text-sm leading-relaxed max-w-md mx-auto">
            {t('medecin.dashboard.empty')}
          </p>
        </div>
      )}

      {dossiers.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {dossiers.map((d) => (
            <article key={d.id} className="glass-card rounded-2xl p-5 flex flex-col gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                  {d.patient?.user?.fullName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  {t('medecin.dashboard.reference')} #{d.reference} — {d.specialiteRequise}
                </p>
              </div>

              <p className="text-sm text-slate-600 dark:text-neutral-300 line-clamp-2">{d.motif}</p>

              <p className="text-xs text-slate-500 dark:text-neutral-400">
                {t('medecin.dashboard.specialist')} :{' '}
                {d.specialiste?.user?.fullName || t('medecin.dashboard.noSpecialist')}
              </p>

              <div className="flex gap-2 mt-1">
                <Link
                  to={`/medecin/messages/${d.id}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl py-2.5 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t('medecin.dashboard.openChat')}
                </Link>
                <Link
                  to={`/medecin/dossiers/${d.id}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-neutral-800 hover:bg-slate-200 dark:hover:bg-neutral-700 text-slate-700 dark:text-neutral-200 text-sm font-medium rounded-xl py-2.5 transition-colors"
                >
                  <FolderOpen className="w-4 h-4" />
                  {t('medecin.dashboard.openFile')}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </MedecinShell>
  )
}
