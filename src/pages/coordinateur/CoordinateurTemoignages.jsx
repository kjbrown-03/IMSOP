import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageCircleHeart, Star, Check, X, RefreshCw } from 'lucide-react'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { api } from '../../lib/api'

const STATUTS = ['EN_ATTENTE', 'PUBLIE', 'REJETE']

export default function CoordinateurTemoignages() {
  const { t } = useTranslation()
  const [statut, setStatut] = useState('EN_ATTENTE')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [motifDrafts, setMotifDrafts] = useState({})
  const [acting, setActing] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/temoignages', { params: { statut } })
      setItems(data)
    } catch (err) {
      setError(err.response?.data?.message || t('coordinateur.temoignages.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut])

  async function moderer(id, nextStatut) {
    const motifRejet = motifDrafts[id]?.trim()
    if (nextStatut === 'REJETE' && !motifRejet) return

    setActing(id)
    try {
      await api.patch(`/temoignages/${id}`, {
        statut: nextStatut,
        ...(nextStatut === 'REJETE' ? { motifRejet } : {}),
      })
      setItems((prev) => prev.filter((it) => it.id !== id))
    } catch (err) {
      setError(err.response?.data?.message || t('coordinateur.temoignages.actionError'))
    } finally {
      setActing(null)
    }
  }

  return (
    <CoordinatorLayout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in-up">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
            <MessageCircleHeart className="w-7 h-7 text-primary-600 dark:text-primary-400" /> {t('coordinateur.temoignages.title')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">{t('coordinateur.temoignages.subtitle')}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="bg-white dark:bg-neutral-800 text-slate-700 dark:text-slate-300 text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors flex items-center gap-2 disabled:opacity-60 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {STATUTS.map((s) => (
          <button
            key={s}
            onClick={() => setStatut(s)}
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
              statut === s
                ? 'bg-primary-600 text-white'
                : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700'
            }`}
          >
            {t(`coordinateur.temoignages.statuts.${s}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4 mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400">
          {t('coordinateur.temoignages.loading')}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center text-slate-500 dark:text-neutral-400">
          {t('coordinateur.temoignages.empty')}
        </div>
      )}

      <div className="grid gap-4">
        {items.map((item) => (
          <article key={item.id} className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{item.user?.fullName}</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400">
                  {item.user?.email} — {t(`coordinateur.temoignages.roles.${item.roleAuteur}`)}
                </p>
              </div>
              {item.note && (
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-4 h-4 ${n <= item.note ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-neutral-600'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <p className="text-sm text-slate-700 dark:text-neutral-200 whitespace-pre-line">{item.texte}</p>

            {statut === 'EN_ATTENTE' && (
              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                <input
                  type="text"
                  value={motifDrafts[item.id] || ''}
                  onChange={(e) => setMotifDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder={t('coordinateur.temoignages.motifPlaceholder')}
                  className="flex-1 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => moderer(item.id, 'PUBLIE')}
                    disabled={acting === item.id}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" /> {t('coordinateur.temoignages.approve')}
                  </button>
                  <button
                    onClick={() => moderer(item.id, 'REJETE')}
                    disabled={acting === item.id || !motifDrafts[item.id]?.trim()}
                    className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-xl px-4 py-2 transition-colors disabled:opacity-60"
                  >
                    <X className="w-4 h-4" /> {t('coordinateur.temoignages.reject')}
                  </button>
                </div>
              </div>
            )}

            {statut === 'REJETE' && item.motifRejet && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {t('coordinateur.temoignages.motifLabel')}: {item.motifRejet}
              </p>
            )}
          </article>
        ))}
      </div>
    </CoordinatorLayout>
  )
}
