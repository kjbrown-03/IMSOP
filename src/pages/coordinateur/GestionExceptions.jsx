import { useEffect, useState } from 'react'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'

export default function GestionExceptions() {
  const { t } = useTranslation()
  const [stats, setStats] = useState(null)
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const METRIC_META = [
    { key: 'nouveaux', label: t('coordinateur.metrics.nouveaux'), icon: 'fiber_new', bg: 'bg-primary-container', fg: 'text-on-primary-container' },
    { key: 'incomplets', label: t('coordinateur.metrics.incomplets'), icon: 'warning', bg: 'bg-[#FFF3CD]', fg: 'text-[#856404]' },
    { key: 'aAffecter', label: t('coordinateur.metrics.aAffecter'), icon: 'assignment_ind', bg: 'bg-error-container', fg: 'text-on-error-container' },
    { key: 'urgents', label: t('coordinateur.metrics.urgents'), icon: 'notifications_active', bg: 'bg-error', fg: 'text-on-error' },
  ]

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: statsData }, { data: dossiersData }] = await Promise.all([
          api.get('/admin/stats'),
          api.get('/dossiers', { params: { status: 'EN_ATTENTE_AFFECTATION', pageSize: 20 } }),
        ])
        if (cancelled) return
        setStats(statsData)
        setDossiers(dossiersData.items)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('coordinateur.exceptions.loadFailed'))
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
    <CoordinatorLayout>
      <div className="mb-stack-lg">
        <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-text-main mb-stack-sm">
          {t('coordinateur.overviewTitle')}
        </h2>
        <p className="font-body-md text-body-md text-on-surface-variant">{t('coordinateur.overviewSubtitle')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-stack-lg w-full">
        {METRIC_META.map((m) => (
          <div
            key={m.key}
            className="bg-surface-container-lowest p-4 rounded-xl border border-outline-variant flex flex-col items-center justify-center gap-2 hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <div className={`${m.bg} ${m.fg} p-3 rounded-full flex items-center justify-center`}>
              <span className="material-symbols-outlined text-3xl">{m.icon}</span>
            </div>
            <div className="text-center">
              <div className="font-headline-md text-headline-md text-text-main">{loading ? '—' : stats?.[m.key] ?? 0}</div>
              <div className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{m.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-error-container border-2 border-error rounded-xl p-6 mb-stack-lg w-full overflow-x-auto">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-error text-3xl">warning</span>
          <h3 className="font-headline-md text-headline-md text-on-error-container font-bold">
            {t('coordinateur.exceptions.manualAssignTitle')}
          </h3>
        </div>

        {error && <div className="font-label-sm text-label-sm text-on-error-container mb-3">{error}</div>}
        {loading && <div className="font-label-sm text-label-sm text-on-error-container">{t('coordinateur.exceptions.loading')}</div>}
        {!loading && !error && dossiers.length === 0 && (
          <div className="font-label-sm text-label-sm text-on-error-container">{t('coordinateur.exceptions.emptyManual')}</div>
        )}

        <div className="flex flex-col gap-4">
          {dossiers.map((d) => (
            <div key={d.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-mono bg-surface-container px-2 py-1 rounded">#{d.reference}</span>
                  {d.urgence === 'URGENT' && (
                    <span className="bg-error text-on-error font-label-sm text-label-sm px-2 py-1 rounded-full flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">error</span> {t('coordinateur.dashboard.urgent')}
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-headline-md text-headline-md text-text-main">{d.patient.user.fullName}</h4>
                  <div className="font-body-md text-body-md text-error font-bold flex items-center gap-2 mt-1">
                    <span className="material-symbols-outlined text-sm">psychiatry</span> {d.specialiteRequise}
                  </div>
                </div>
              </div>
              <Link
                to={`/coordinateur/affectation/${d.id}`}
                className="bg-primary text-on-primary font-label-md text-label-md px-6 py-3 rounded-full hover:bg-primary-container transition-colors h-12 flex items-center justify-center"
              >
                {t('coordinateur.exceptions.assignManually')}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </CoordinatorLayout>
  )
}
