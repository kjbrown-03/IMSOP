import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AdminLayout from '../../components/layout/AdminLayout'
import AuditLogFeed from '../../components/admin/AuditLogFeed'
import { api } from '../../lib/api'
import { RefreshCw, ScrollText } from 'lucide-react'

export default function AdminJournal() {
  const { t } = useTranslation()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/admin/audit-logs', { params: { take: 200 } })
      setLogs(data)
    } catch (err) {
      setError(err.response?.data?.message || t('admin.dashboard.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <AdminLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 mb-2 flex items-center gap-3">
            <ScrollText className="w-7 h-7 text-primary-600" /> {t('admin.journal.title')}
          </h2>
          <p className="text-slate-500">{t('admin.journal.subtitle')}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2 disabled:opacity-60 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </button>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-2xl px-5 py-4 mb-6">{error}</div>}

      <AuditLogFeed logs={logs} loading={loading} />
    </AdminLayout>
  )
}
