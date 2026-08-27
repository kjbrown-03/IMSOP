import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Star, MessageCircleHeart, CheckCircle2 } from 'lucide-react'
import { api } from '../../lib/api'

export default function TemoignageForm() {
  const { t } = useTranslation()
  const [texte, setTexte] = useState('')
  const [note, setNote] = useState(0)
  const [hoverNote, setHoverNote] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (texte.trim().length < 10) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/temoignages', { texte: texte.trim(), ...(note ? { note } : {}) })
      setSent(true)
      setTexte('')
      setNote(0)
    } catch (err) {
      setError(err.response?.data?.message || t('temoignage.error'))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <section className="glass-card rounded-2xl p-5 sm:p-6 flex gap-3 items-start">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{t('temoignage.thanksTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-neutral-400 mt-1">{t('temoignage.thanksText')}</p>
        </div>
      </section>
    )
  }

  return (
    <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircleHeart className="w-5 h-5 text-primary-600 shrink-0" />
        <h2 className="font-semibold text-slate-900 dark:text-white">{t('temoignage.title')}</h2>
      </div>
      <p className="text-sm text-slate-500 dark:text-neutral-400">{t('temoignage.help')}</p>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNote(n === note ? 0 : n)}
              onMouseEnter={() => setHoverNote(n)}
              onMouseLeave={() => setHoverNote(0)}
              aria-label={t('temoignage.rating', { count: n })}
              className="p-0.5"
            >
              <Star
                className={`w-5 h-5 transition-colors ${
                  n <= (hoverNote || note) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-neutral-600'
                }`}
              />
            </button>
          ))}
        </div>

        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder={t('temoignage.placeholder')}
          className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all resize-none"
        />

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || texte.trim().length < 10}
          className="self-end bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-60"
        >
          {t('temoignage.submit')}
        </button>
      </form>
    </section>
  )
}
