import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Upload, Send, Loader2, FileText, HelpCircle } from 'lucide-react'
import MedecinShell from '../../components/layout/MedecinShell'
import MessageAttachment from '../../components/ui/MessageAttachment'
import { api } from '../../lib/api'

// Mirrors backend/src/middleware/upload.js.
const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'application/dicom']
const MAX_BYTES = 25 * 1024 * 1024

const CATEGORIES = ['ANALYSE_BIOLOGIQUE', 'IMAGERIE', 'ORDONNANCE', 'COMPTE_RENDU', 'AUTRE']

export default function DossierMedecinLocal() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const fileInputRef = useRef(null)

  const [dossier, setDossier] = useState(null)
  const [documents, setDocuments] = useState([])
  const [category, setCategory] = useState('COMPTE_RENDU')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState(null)
  const [uploadError, setUploadError] = useState(null)
  const [question, setQuestion] = useState('')
  const [questionSubmitting, setQuestionSubmitting] = useState(false)
  const [questionError, setQuestionError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: d }, { data: docs }] = await Promise.all([
          api.get(`/dossiers/${id}`),
          api.get(`/dossiers/${id}/documents`),
        ])
        if (cancelled) return
        setDossier(d)
        setDocuments(docs)
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || t('errors.caseNotFound'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  async function upload(e) {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''
    if (selected.length === 0) return

    const invalid = selected.find((f) => !ACCEPTED_MIME.includes(f.type))
    if (invalid) {
      setUploadError(t('chat.attachTypeError'))
      return
    }
    const tooLarge = selected.find((f) => f.size > MAX_BYTES)
    if (tooLarge) {
      setUploadError(t('chat.attachSizeError'))
      return
    }

    setUploading(true)
    setUploadError(null)
    let failedCount = 0
    for (const file of selected) {
      const form = new FormData()
      form.append('file', file)
      form.append('category', category)
      try {
        const { data } = await api.post(`/dossiers/${id}/documents`, form)
        setDocuments((prev) => [data, ...prev])
      } catch {
        failedCount += 1
      }
    }
    if (failedCount > 0) setUploadError(t('patient.documents.someFilesFailed', { count: failedCount }))
    setUploading(false)
  }

  async function submitQuestion(e) {
    e.preventDefault()
    if (!question.trim()) return
    setQuestionSubmitting(true)
    setQuestionError(null)
    try {
      const { data } = await api.post(`/dossiers/${id}/question-medecin-local`, { question: question.trim() })
      setDossier(data)
    } catch (err) {
      setQuestionError(err.response?.data?.message || t('medecin.file.questionError'))
    } finally {
      setQuestionSubmitting(false)
    }
  }

  return (
    <MedecinShell>
      <button
        onClick={() => navigate('/medecin/dossiers')}
        className="self-start flex items-center gap-2 text-sm text-slate-500 dark:text-neutral-400 hover:text-primary-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('medecin.dashboard.title')}
      </button>

      {loading && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400">
          {t('medecin.dashboard.loading')}
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {dossier && (
        <>
          <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                  {dossier.patient?.user?.fullName}
                </h1>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
                  {t('medecin.dashboard.reference')} #{dossier.reference} — {dossier.specialiteRequise}
                </p>
              </div>
            </div>

            <dl className="grid sm:grid-cols-2 gap-4 mt-2">
              {[
                ['medecin.file.motif', dossier.motif],
                ['medecin.file.question', dossier.questionMedicale],
                ['medecin.file.symptomes', dossier.symptomes],
                ['medecin.file.antecedents', dossier.antecedents],
                ['medecin.file.allergies', dossier.allergies],
                ['medecin.file.traitement', dossier.traitementEnCours],
              ]
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500 mb-1">
                      {t(key)}
                    </dt>
                    <dd className="text-sm text-slate-700 dark:text-neutral-200 whitespace-pre-line">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-semibold text-slate-900 dark:text-white">{t('medecin.file.documents')}</h2>
              <div className="flex items-center gap-2">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`medecin.file.categories.${c}`)}
                    </option>
                  ))}
                </select>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_MIME.join(',')}
                  onChange={upload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-slate-900 dark:bg-white hover:bg-primary-600 dark:hover:bg-primary-100 text-white dark:text-slate-900 text-sm font-medium rounded-xl px-4 py-2 transition-colors disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {t('medecin.file.upload')}
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
                {uploadError}
              </div>
            )}

            {documents.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-neutral-400 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                {t('medecin.file.noDocuments')}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {documents.map((doc) => (
                  <li key={doc.id}>
                    <MessageAttachment document={doc} mine={false} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="glass-card rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-primary-600 shrink-0" />
              <h2 className="font-semibold text-slate-900 dark:text-white">{t('medecin.file.questionTitle')}</h2>
            </div>

            {dossier.questionMedecinLocal ? (
              <div className="bg-slate-50 dark:bg-neutral-800/60 rounded-xl p-4">
                <p className="text-sm text-slate-700 dark:text-neutral-200 whitespace-pre-line">
                  {dossier.questionMedecinLocal}
                </p>
                <p className="text-xs text-slate-400 dark:text-neutral-500 mt-2">
                  {t('medecin.file.questionSentOn', {
                    date: new Date(dossier.questionMedecinLocalPoseeLe).toLocaleDateString('fr-FR'),
                  })}
                </p>
              </div>
            ) : (
              <form onSubmit={submitQuestion} className="flex flex-col gap-3">
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  {t('medecin.file.questionHelp')}
                </p>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder={t('medecin.file.questionPlaceholder')}
                  className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:border-primary-500 transition-all resize-none"
                />
                {questionError && (
                  <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
                    {questionError}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={questionSubmitting || !question.trim()}
                  className="self-end flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl px-4 py-2.5 transition-colors disabled:opacity-60"
                >
                  {questionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t('medecin.file.questionSubmit')}
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </MedecinShell>
  )
}
