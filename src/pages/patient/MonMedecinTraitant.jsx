import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stethoscope, UserPlus, Trash2, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react'
import PatientShell from '../../components/layout/PatientShell'
import { api } from '../../lib/api'

export default function MonMedecinTraitant() {
  const { t } = useTranslation()
  const [dossiers, setDossiers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/dossiers')
        if (cancelled) return
        setDossiers(data.items)
        setSelectedId((prev) => prev || data.items[0]?.id || '')
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

  const selected = dossiers.find((d) => d.id === selectedId)
  const medecin = selected?.medecinLocal

  // The API returns the updated dossier, so the panel reflects what was actually
  // stored rather than an optimistic guess.
  function applyDossier(updated) {
    setDossiers((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)))
  }

  async function designate(e) {
    e.preventDefault()
    if (!selectedId || !email.trim() || busy) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { data } = await api.post(`/dossiers/${selectedId}/medecin-local`, { email: email.trim() })
      applyDossier(data)
      setEmail('')
      setSuccess(t('patientMedecin.designated'))
    } catch (err) {
      setError(err.response?.data?.message || t('errors.loadCasesFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!selectedId || busy) return
    if (!window.confirm(t('patientMedecin.removeConfirm'))) return
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const { data } = await api.delete(`/dossiers/${selectedId}/medecin-local`)
      applyDossier({ ...data, medecinLocal: null })
      setSuccess(t('patientMedecin.removed'))
    } catch (err) {
      setError(err.response?.data?.message || t('errors.loadCasesFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PatientShell title={t('patientMedecin.title')}>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('patientMedecin.title')}
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm leading-relaxed max-w-2xl">
          {t('patientMedecin.subtitle')}
        </p>
      </section>

      {loading && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400">
          {t('medecin.dashboard.loading')}
        </div>
      )}

      {!loading && dossiers.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center text-slate-500 dark:text-neutral-400 text-sm">
          {t('patientMedecin.noDossier')}
        </div>
      )}

      {!loading && dossiers.length > 0 && (
        <div className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">
              {t('patientMedecin.chooseDossier')}
            </span>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value)
                setSuccess(null)
                setError(null)
              }}
              className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
            >
              {dossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.reference} — {d.specialiteRequise}
                </option>
              ))}
            </select>
          </label>

          <div className="border-t border-slate-200/70 dark:border-neutral-700/70 pt-5">
            <p className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500 mb-3">
              {t('patientMedecin.currentLabel')}
            </p>

            {medecin ? (
              <div className="flex items-center gap-3">
                <span className="bg-primary-100 dark:bg-neutral-800 text-primary-600 dark:text-primary-300 p-2.5 rounded-xl shrink-0">
                  <Stethoscope className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    {medecin.user?.fullName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-neutral-400 truncate">
                    {[medecin.specialite, medecin.etablissement].filter(Boolean).join(' — ')}
                  </p>
                  {medecin.verified === false && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-1">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {t('patientMedecin.unverified')}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={revoke}
                  disabled={busy}
                  className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-sm font-medium rounded-lg px-3 py-2 transition-colors shrink-0 disabled:opacity-60"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('patientMedecin.remove')}</span>
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-neutral-400">{t('patientMedecin.none')}</p>
            )}
          </div>

          <form onSubmit={designate} className="border-t border-slate-200/70 dark:border-neutral-700/70 pt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">
                {t('patientMedecin.emailLabel')}
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="dr.exemple@hopital.cm"
                className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all"
              />
              <span className="text-xs text-slate-400 dark:text-neutral-500">
                {t('patientMedecin.emailHelp')}
              </span>
            </label>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || !email.trim()}
              className="self-start flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl px-5 py-3 transition-colors disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              {t('patientMedecin.designate')}
            </button>
          </form>
        </div>
      )}
    </PatientShell>
  )
}
