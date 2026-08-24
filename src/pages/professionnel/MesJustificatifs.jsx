import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, Loader2, ShieldCheck, ShieldAlert, FileText } from 'lucide-react'
import MedecinShell from '../../components/layout/MedecinShell'
import SpecialistShell from '../../components/layout/SpecialistShell'
import MessageAttachment from '../../components/ui/MessageAttachment'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'

// Mirrors backend/src/middleware/upload.js.
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom']
const MAX_BYTES = 25 * 1024 * 1024

// CDC §16 : les pièces exigées avant activation d'un compte professionnel.
const TYPES = ['DIPLOME', 'LICENCE', 'INSCRIPTION_ORDRE', 'PIECE_IDENTITE', 'CV', 'REFERENCES', 'AUTRE']

const BANDEAU = {
  VALIDE: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900/40', text: 'text-emerald-800 dark:text-emerald-200', Icon: ShieldCheck },
  EN_VERIFICATION: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-900/40', text: 'text-amber-800 dark:text-amber-200', Icon: ShieldAlert },
  SUSPENDU: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-900/40', text: 'text-rose-800 dark:text-rose-200', Icon: ShieldAlert },
  EXPIRE: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-900/40', text: 'text-rose-800 dark:text-rose-200', Icon: ShieldAlert },
  REVOQUE: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-900/40', text: 'text-rose-800 dark:text-rose-200', Icon: ShieldAlert },
}

export default function MesJustificatifs() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const fileInputRef = useRef(null)

  const [documents, setDocuments] = useState([])
  const [habilitation, setHabilitation] = useState(null)
  const [type, setType] = useState('DIPLOME')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/professionnels/me/justificatifs')
      setDocuments(data.documents)
      setHabilitation(data.habilitation)
    } catch (err) {
      setError(err.response?.data?.message || t('errors.loadCasesFailed'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    load()
  }, [load])

  async function upload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!ACCEPTED_MIME.includes(file.type)) {
      setError(t('chat.attachTypeError'))
      return
    }
    if (file.size > MAX_BYTES) {
      setError(t('chat.attachSizeError'))
      return
    }
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)
    form.append('type', type)
    try {
      await api.post('/professionnels/me/justificatifs', form)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || t('chat.attachFailed'))
    } finally {
      setUploading(false)
    }
  }

  // Le praticien reste dans la coque de son propre rôle.
  const Shell = user?.role === 'SPECIALISTE' ? SpecialistShell : MedecinShell
  const statut = habilitation?.status
  const bandeau = BANDEAU[statut] || BANDEAU.EN_VERIFICATION

  return (
    <Shell>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('medecin.justificatifs.title')}
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm leading-relaxed max-w-2xl">
          {t('medecin.justificatifs.subtitle')}
        </p>
      </section>

      {statut && (
        <div className={`${bandeau.bg} ${bandeau.border} border rounded-2xl p-4 flex gap-3 items-start`}>
          <bandeau.Icon className={`w-5 h-5 shrink-0 mt-0.5 ${bandeau.text}`} />
          <div className={`text-sm leading-relaxed ${bandeau.text}`}>
            <p>{t(`medecin.habilitation.${statut}`)}</p>
            {habilitation.motif && (
              <p className="mt-1">
                <span className="font-semibold">{t('medecin.justificatifs.motifLabel')} :</span> {habilitation.motif}
              </p>
            )}
            {habilitation.expireLe && (
              <p className="mt-1">
                <span className="font-semibold">{t('medecin.justificatifs.expiresLabel')} :</span>{' '}
                {new Date(habilitation.expireLe).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')}
              </p>
            )}
          </div>
        </div>
      )}

      <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-end gap-2 flex-wrap">
          <label className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <span className="text-sm font-medium text-slate-700 dark:text-neutral-200">
              {t('medecin.justificatifs.type')}
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all"
            >
              {TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(`medecin.justificatifs.types.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_MIME.join(',')} onChange={upload} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-slate-900 dark:bg-white hover:bg-primary-600 dark:hover:bg-primary-100 text-white dark:text-slate-900 text-sm font-medium rounded-xl px-5 py-2.5 transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {t('medecin.justificatifs.upload')}
          </button>
        </div>

        {error && (
          <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-neutral-400">{t('medecin.dashboard.loading')}</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-neutral-400 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {t('medecin.justificatifs.empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {documents.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500">
                  {t(`medecin.justificatifs.types.${doc.type}`)}
                </span>
                <MessageAttachment document={doc} mine={false} basePath="/professionnels/justificatifs" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  )
}
