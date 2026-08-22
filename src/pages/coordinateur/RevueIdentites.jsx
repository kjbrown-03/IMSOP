import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { api } from '../../lib/api'
import { ShieldCheck, FileSearch, Check, X, ExternalLink, Loader2 } from 'lucide-react'

export default function RevueIdentites() {
  const { t } = useTranslation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/patients/identity-reviews')
      setItems(data.items)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function onView(patientId) {
    const { data } = await api.get(`/patients/${patientId}/identity-document`)
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  async function onApprove(patientId) {
    setBusyId(patientId)
    try {
      await api.post(`/patients/${patientId}/identity-review`, { approved: true })
      setItems((prev) => prev.filter((p) => p.id !== patientId))
    } finally {
      setBusyId(null)
    }
  }

  async function onReject(patientId) {
    if (!reason.trim()) return
    setBusyId(patientId)
    try {
      await api.post(`/patients/${patientId}/identity-review`, { approved: false, rejectedReason: reason.trim() })
      setItems((prev) => prev.filter((p) => p.id !== patientId))
      setRejectingId(null)
      setReason('')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <CoordinatorLayout>
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-3xl font-display font-bold text-slate-900 mb-2 flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-primary-600" /> {t('coordinateur.identities.title')}
        </h2>
        <p className="text-slate-500">
          {t('coordinateur.identities.subtitle')}
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('coordinateur.identities.loading')}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 animate-fade-in-up">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          {t('coordinateur.identities.empty')}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {items.map((p, idx) => (
          <div
            key={p.id}
            className="glass-card rounded-2xl p-5 flex flex-col gap-4 animate-fade-in-up"
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-mono font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60">
                    #{p.patientRef}
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900 mt-2">{p.user.fullName}</h4>
                <div className="text-sm text-slate-500">{p.user.email}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onView(p.id)}
                  className="bg-white text-slate-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <FileSearch className="w-4 h-4" /> {t('coordinateur.identities.viewDocument')}
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onApprove(p.id)}
                  disabled={busyId === p.id}
                  className="bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  <Check className="w-4 h-4" /> {t('coordinateur.identities.validate')}
                </button>
                <button
                  onClick={() => { setRejectingId(rejectingId === p.id ? null : p.id); setReason('') }}
                  disabled={busyId === p.id}
                  className="bg-rose-50 text-rose-700 text-sm font-semibold px-4 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                  <X className="w-4 h-4" /> {t('coordinateur.identities.reject')}
                </button>
              </div>
            </div>

            {rejectingId === p.id && (
              <div className="border-t border-slate-100/60 pt-4 flex flex-col gap-3">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t('coordinateur.identities.rejectPlaceholder')}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setRejectingId(null)}
                    className="text-sm font-semibold text-slate-500 px-4 py-2 rounded-xl hover:bg-slate-50"
                  >
                    {t('coordinateur.identities.cancel')}
                  </button>
                  <button
                    onClick={() => onReject(p.id)}
                    disabled={!reason.trim() || busyId === p.id}
                    className="bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-60"
                  >
                    {t('coordinateur.identities.confirmReject')}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </CoordinatorLayout>
  )
}
