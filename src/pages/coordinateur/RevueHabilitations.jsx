import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShieldCheck, Loader2, FileText, ChevronRight } from 'lucide-react'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import MessageAttachment from '../../components/ui/MessageAttachment'
import { api } from '../../lib/api'

const ETATS = ['EN_VERIFICATION', 'VALIDE', 'SUSPENDU', 'EXPIRE', 'REVOQUE']

const COULEUR = {
  EN_VERIFICATION: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/40',
  VALIDE: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40',
  SUSPENDU: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40',
  EXPIRE: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40',
  REVOQUE: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/40',
}

export default function RevueHabilitations() {
  const { t, i18n } = useTranslation()
  const [filtre, setFiltre] = useState('EN_VERIFICATION')
  const [items, setItems] = useState([])
  const [ouvert, setOuvert] = useState(null)
  const [detail, setDetail] = useState(null)
  const [decision, setDecision] = useState('VALIDE')
  const [motif, setMotif] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/professionnels/verifications', { params: { status: filtre } })
      setItems(data.items)
    } catch (err) {
      setError(err.response?.data?.message || t('errors.loadCasesFailed'))
    } finally {
      setLoading(false)
    }
  }, [filtre, t])

  useEffect(() => {
    load()
  }, [load])

  async function ouvrir(userId) {
    if (ouvert === userId) {
      setOuvert(null)
      setDetail(null)
      return
    }
    setOuvert(userId)
    setDetail(null)
    try {
      const { data } = await api.get(`/professionnels/${userId}/justificatifs`)
      setDetail(data)
      setDecision(data.professionnel.verificationStatus === 'VALIDE' ? 'SUSPENDU' : 'VALIDE')
      setMotif('')
    } catch (err) {
      setError(err.response?.data?.message || t('errors.loadCasesFailed'))
    }
  }

  async function statuer(userId) {
    setBusy(true)
    setError(null)
    try {
      await api.post(`/professionnels/${userId}/habilitation`, {
        status: decision,
        ...(motif.trim() ? { motif: motif.trim() } : {}),
      })
      setOuvert(null)
      setDetail(null)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || t('errors.loadCasesFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <CoordinatorLayout>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('medecin.verifications.title')}
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm leading-relaxed max-w-2xl">
          {t('medecin.verifications.subtitle')}
        </p>
      </section>

      <div className="flex gap-2 flex-wrap">
        {ETATS.map((e) => (
          <button
            key={e}
            onClick={() => setFiltre(e)}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-colors ${
              filtre === e
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700'
            }`}
          >
            {t(`medecin.habilitationLabel.${e}`)}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {loading && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400">
          {t('medecin.verifications.loading')}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center text-slate-500 dark:text-neutral-400 text-sm">
          {t('medecin.verifications.empty')}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {items.map((p) => (
          <article key={p.userId} className="glass-card rounded-2xl overflow-hidden">
            <button
              onClick={() => ouvrir(p.userId)}
              className="w-full text-left p-5 flex items-start gap-4 hover:bg-slate-50/60 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-slate-900 dark:text-white truncate">{p.fullName}</h2>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${COULEUR[p.verificationStatus]}`}>
                    {t(`medecin.habilitationLabel.${p.verificationStatus}`)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                  {p.email} · {[p.specialite, p.etablissement, p.pays].filter(Boolean).join(' — ')}
                </p>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                  {p.numeroOrdre ? `${t('medecin.verifications.ordre')} ${p.numeroOrdre} · ` : ''}
                  {p.nombreJustificatifs} {t('medecin.verifications.documents')} ·{' '}
                  {t('medecin.verifications.registered')}{' '}
                  {new Date(p.inscritLe).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')}
                </p>
                {p.verificationMotif && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{p.verificationMotif}</p>
                )}
              </div>
              <ChevronRight className={`w-5 h-5 text-slate-400 dark:text-slate-500 shrink-0 transition-transform ${ouvert === p.userId ? 'rotate-90' : ''}`} />
            </button>

            {ouvert === p.userId && (
              <div className="border-t border-slate-200/70 dark:border-neutral-700/70 p-5 flex flex-col gap-4">
                {!detail ? (
                  <p className="text-sm text-slate-500 dark:text-neutral-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('medecin.verifications.loading')}
                  </p>
                ) : (
                  <>
                    {detail.documents.length === 0 ? (
                      <p className="text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <FileText className="w-4 h-4" /> {t('medecin.verifications.noDocuments')}
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {detail.documents.map((doc) => (
                          <li key={doc.id} className="flex flex-col gap-1">
                            <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500">
                              {t(`medecin.justificatifs.types.${doc.type}`)}
                            </span>
                            <MessageAttachment document={doc} mine={false} basePath="/professionnels/justificatifs" />
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="border-t border-slate-200/70 dark:border-neutral-700/70 pt-4 flex flex-col gap-3">
                      <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500">
                        {t('medecin.verifications.decide')}
                      </span>
                      <div className="flex gap-2 flex-wrap">
                        {ETATS.map((e) => (
                          <button
                            key={e}
                            onClick={() => setDecision(e)}
                            className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
                              decision === e
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                                : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700'
                            }`}
                          >
                            {t(`medecin.habilitationLabel.${e}`)}
                          </button>
                        ))}
                      </div>
                      <textarea
                        value={motif}
                        onChange={(e) => setMotif(e.target.value)}
                        placeholder={t('medecin.verifications.motifPlaceholder')}
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                      />
                      <button
                        onClick={() => statuer(p.userId)}
                        disabled={busy || (decision !== 'VALIDE' && !motif.trim())}
                        className="self-start flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        {t('medecin.verifications.apply')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </CoordinatorLayout>
  )
}
