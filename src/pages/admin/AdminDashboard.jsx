import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import AdminLayout from '../../components/layout/AdminLayout'
import AuditLogFeed from '../../components/admin/AuditLogFeed'
import { api } from '../../lib/api'
import {
  Sparkles, AlertTriangle, UserPlus, Bell, Users, Stethoscope, ShieldCheck, FileCheck2, ArrowRight,
} from 'lucide-react'

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: statsData }, { data: logsData }] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/admin/audit-logs', { params: { take: 10 } }),
        ])
        if (cancelled) return
        setStats(statsData)
        setLogs(logsData)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('admin.dashboard.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  const METRICS = stats && [
    { label: t('admin.dashboard.metrics.nouveaux'), value: stats.nouveaux, icon: Sparkles, bg: 'bg-blue-50 dark:bg-blue-900/30', fg: 'text-blue-600 dark:text-blue-400' },
    { label: t('admin.dashboard.metrics.incomplets'), value: stats.incomplets, icon: AlertTriangle, bg: 'bg-amber-50 dark:bg-amber-900/30', fg: 'text-amber-600 dark:text-amber-400' },
    { label: t('admin.dashboard.metrics.aAffecter'), value: stats.aAffecter, icon: UserPlus, bg: 'bg-indigo-50 dark:bg-indigo-900/30', fg: 'text-indigo-600 dark:text-indigo-400' },
    { label: t('admin.dashboard.metrics.urgents'), value: stats.urgents, icon: Bell, bg: 'bg-rose-50 dark:bg-rose-900/30', fg: 'text-rose-600 dark:text-rose-400' },
    { label: t('admin.dashboard.metrics.patients'), value: stats.totalPatients, icon: Users, bg: 'bg-teal-50 dark:bg-teal-900/30', fg: 'text-teal-600 dark:text-teal-400' },
    { label: t('admin.dashboard.metrics.specialistes'), value: stats.totalSpecialistes, icon: Stethoscope, bg: 'bg-violet-50 dark:bg-violet-900/30', fg: 'text-violet-600 dark:text-violet-400' },
    { label: t('admin.dashboard.metrics.coordinateurs'), value: stats.totalCoordinateurs, icon: ShieldCheck, bg: 'bg-cyan-50 dark:bg-cyan-900/30', fg: 'text-cyan-600 dark:text-cyan-400' },
    { label: t('admin.dashboard.metrics.rapportsValides'), value: stats.rapportsValides, icon: FileCheck2, bg: 'bg-emerald-50 dark:bg-emerald-900/30', fg: 'text-emerald-600 dark:text-emerald-400' },
  ]

  return (
    <AdminLayout>
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">{t('admin.dashboard.title')}</h2>
        <p className="text-slate-500 dark:text-slate-400">{t('admin.dashboard.subtitle')}</p>
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4 mb-6">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
        {(loading ? Array.from({ length: 8 }) : METRICS).map((m, idx) => (
          <div
            key={m?.label || idx}
            className="glass-card p-6 rounded-3xl flex flex-col items-center justify-center gap-3 animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            {m ? (
              <>
                <div className={`${m.bg} ${m.fg} p-4 rounded-2xl ring-1 ring-black/5 shadow-sm`}>
                  <m.icon className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-900 dark:text-white">{m.value ?? 0}</div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">{m.label}</div>
                </div>
              </>
            ) : (
              <div className="h-24 w-full animate-pulse bg-slate-100 dark:bg-neutral-800 rounded-2xl" />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mb-6 animate-fade-in-up">
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-white">{t('admin.dashboard.recentActivity')}</h3>
        <Link to="/admin/journal" className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1 group">
          {t('admin.dashboard.viewJournal')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <AuditLogFeed logs={logs} loading={loading} />
    </AdminLayout>
  )
}
