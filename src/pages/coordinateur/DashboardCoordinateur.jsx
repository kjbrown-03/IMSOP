import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { api } from '../../lib/api'
import { Sparkles, AlertTriangle, UserPlus, Bell, ChevronRight, ShieldAlert, FileText, FileSearch, ArrowRight, CheckCircle2, ClipboardCheck } from 'lucide-react'

export default function DashboardCoordinateur() {
  const { t, i18n } = useTranslation()
  const [stats, setStats] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [rapportsAValider, setRapportsAValider] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [validatingId, setValidatingId] = useState(null)

  const METRIC_META = [
    { key: 'nouveaux', label: t('coordinateur.metrics.nouveaux'), icon: Sparkles, bg: 'bg-blue-50', fg: 'text-blue-600', ring: 'ring-blue-100' },
    { key: 'incomplets', label: t('coordinateur.metrics.incomplets'), icon: AlertTriangle, bg: 'bg-amber-50', fg: 'text-amber-600', ring: 'ring-amber-100' },
    { key: 'aAffecter', label: t('coordinateur.metrics.aAffecter'), icon: UserPlus, bg: 'bg-indigo-50', fg: 'text-indigo-600', ring: 'ring-indigo-100' },
    { key: 'urgents', label: t('coordinateur.metrics.urgents'), icon: Bell, bg: 'bg-rose-50', fg: 'text-rose-600', ring: 'ring-rose-100' },
  ]

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  async function load() {
    setLoading(true)
    try {
      const [{ data: statsData }, { data: dossiersData }, { data: soumisData }] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/dossiers', { params: { status: 'EN_ATTENTE_AFFECTATION', pageSize: 6 } }),
        api.get('/dossiers', { params: { status: 'RAPPORT_SOUMIS', pageSize: 20 } }),
      ])
      setStats(statsData)
      const sorted = [...dossiersData.items].sort((a, b) => (a.urgence === 'URGENT' ? -1 : b.urgence === 'URGENT' ? 1 : 0))
      setDossiers(sorted)

      const rapports = await Promise.all(
        soumisData.items.map(async (d) => {
          try {
            const { data: rapport } = await api.get(`/dossiers/${d.id}/rapport`)
            return { dossier: d, rapport }
          } catch {
            return null
          }
        }),
      )
      setRapportsAValider(rapports.filter(Boolean))
    } catch (err) {
      setError(err.response?.data?.message || t('coordinateur.dashboard.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function validerRapport(rapportId) {
    setValidatingId(rapportId)
    try {
      await api.post(`/rapports/${rapportId}/valider`)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || t('coordinateur.dashboard.validateFailed'))
    } finally {
      setValidatingId(null)
    }
  }

  return (
    <CoordinatorLayout>
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">{t('coordinateur.overviewTitle')}</h2>
        <p className="text-slate-500 dark:text-slate-400">{t('coordinateur.overviewSubtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
        {METRIC_META.map((m, idx) => (
          <div
            key={m.key}
            className="glass-card dark:bg-neutral-900 p-6 rounded-3xl flex flex-col items-center justify-center gap-3 hover:-translate-y-1 hover:shadow-xl dark:hover:shadow-black/40 transition-all duration-300 group cursor-pointer animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <div className={`${m.bg} ${m.fg} p-4 rounded-2xl ring-1 ${m.ring} dark:bg-opacity-10 dark:ring-opacity-20 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
              <m.icon className="w-7 h-7" />
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '—' : stats?.[m.key] ?? 0}</div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" /> {t('coordinateur.dashboard.pendingTitle')}
        </h3>
        <Link to="/coordinateur/recherche-expert" className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 group">
          {t('coordinateur.dashboard.viewExperts')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4 mb-4">{error}</div>}

      {loading && <div className="glass-card rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400">{t('coordinateur.dashboard.loading')}</div>}

      {!loading && !error && dossiers.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400">{t('coordinateur.dashboard.emptyPending')}</div>
      )}

      <div className="flex flex-col gap-4">
        {dossiers.map((d, idx) => (
          <div
            key={d.id}
            className="glass-card dark:bg-neutral-900 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:shadow-xl hover:shadow-primary-900/5 dark:hover:shadow-black/40 hover:-translate-y-0.5 transition-all duration-300 animate-fade-in-up group"
            style={{ animationDelay: `${0.4 + idx * 0.1}s` }}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-neutral-700">
                  #{d.reference}
                </span>
                {d.urgence === 'URGENT' && (
                  <span className="bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-sm">
                    <Bell className="w-3.5 h-3.5" /> {t('coordinateur.dashboard.urgent')}
                  </span>
                )}
              </div>
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">{d.patient.user.fullName}</h4>
                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <FileText className="w-4 h-4" /> {d.specialiteRequise}
                </div>
              </div>
            </div>

            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-4 mt-2 md:mt-0 pt-4 md:pt-0 border-t md:border-0 border-slate-100/60 dark:border-neutral-800">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('coordinateur.dashboard.receivedOn')} {formatDate(d.createdAt)}</div>
              <Link
                to={`/coordinateur/affectation/${d.id}`}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-50 transition-colors shadow-md shadow-slate-900/10 flex items-center gap-2 group-hover:scale-105"
              >
                {t('coordinateur.dashboard.assign')} <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-6 mt-12 animate-fade-in-up">
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-emerald-600" /> {t('coordinateur.dashboard.reportsToValidateTitle')}
        </h3>
      </div>

      {!loading && !error && rapportsAValider.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400">{t('coordinateur.dashboard.emptyReports')}</div>
      )}

      <div className="flex flex-col gap-4">
        {rapportsAValider.map(({ dossier: d, rapport }, idx) => (
          <div
            key={rapport.id}
            className="glass-card dark:bg-neutral-900 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 hover:shadow-xl hover:shadow-primary-900/5 dark:hover:shadow-black/40 transition-all duration-300 animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <div className="flex flex-col gap-3">
              <span className="text-xs font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-neutral-700 w-fit">
                #{d.reference}
              </span>
              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">{d.patient.user.fullName}</h4>
                <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <FileText className="w-4 h-4" /> {d.specialiteRequise} — Dr. {d.specialiste?.user?.fullName}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to={`/coordinateur/rapport/${d.id}`}
                className="bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2"
              >
                <FileSearch className="w-4 h-4" /> {t('coordinateur.dashboard.consult')}
              </Link>
              <button
                onClick={() => validerRapport(rapport.id)}
                disabled={validatingId !== null}
                className="bg-emerald-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors shadow-md flex items-center gap-2 disabled:opacity-60"
              >
                <CheckCircle2 className="w-4 h-4" />
                {validatingId === rapport.id ? t('coordinateur.dashboard.validating') : t('coordinateur.dashboard.validateAndSend')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </CoordinatorLayout>
  )
}
