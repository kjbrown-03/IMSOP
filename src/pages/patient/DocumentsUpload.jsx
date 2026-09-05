import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, Check, ArrowRight, Activity, UploadCloud, FileText, FileImage, Loader2 } from 'lucide-react'
import ConsentementGate from '../../components/ui/ConsentementGate'
import { api } from '../../lib/api'

const CATEGORIES = [
  { value: 'ANALYSE_BIOLOGIQUE', key: 'categoryAnalyse' },
  { value: 'IMAGERIE', key: 'categoryImagerie' },
  { value: 'ORDONNANCE', key: 'categoryOrdonnance' },
  { value: 'COMPTE_RENDU', key: 'categoryCompteRendu' },
  { value: 'AUTRE', key: 'categoryAutre' },
]

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,application/dicom'

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

export default function DocumentsUpload() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const fileInputRef = useRef(null)

  const dossierId = location.state?.dossierId
  const [category, setCategory] = useState('ANALYSE_BIOLOGIQUE')
  const [files, setFiles] = useState([])
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [consentementAccepte, setConsentementAccepte] = useState(false)
  // Preuve que le code envoye par e-mail a bien ete verifie.
  const [otpToken, setOtpToken] = useState(null)
  const [nomSignataire, setNomSignataire] = useState('')

  useEffect(() => {
    if (!dossierId) {
      navigate('/patient/nouvelle-demande', { replace: true })
      return
    }
    let cancelled = false
    api
      .get(`/dossiers/${dossierId}/documents`)
      .then(({ data }) => {
        if (!cancelled) setDocuments(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [dossierId, navigate])

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (files.length === 0) {
      setError(t('patient.documents.selectFileFirst'))
      return
    }
    setError(null)
    setUploading(true)
    let failedCount = 0
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', category)
        const { data } = await api.post(`/dossiers/${dossierId}/documents`, formData)
        setDocuments((prev) => [data, ...prev])
      } catch {
        failedCount += 1
      }
    }
    setFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (failedCount > 0) setError(t('patient.documents.someFilesFailed', { count: failedCount }))
    setUploading(false)
  }

  async function handleContinue() {
    if (!consentementAccepte || nomSignataire.trim().length < 2) {
      setError(t('consentement.required'))
      return
    }
    if (!otpToken) {
      setError(t('consentement.otpRequired'))
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      // Le consentement doit exister comme document du dossier avant que
      // celui-ci ne puisse être soumis (voir soumettreDossier côté serveur) :
      // il est donc enregistré ici, juste avant l'appel qui soumet le dossier.
      await api.post(`/dossiers/${dossierId}/consentements`, {
        type: 'TRANSMISSION_SPECIALISTE',
        accepted: true,
        nomSignataire: nomSignataire.trim(),
        otpToken,
      })
      await api.post(`/dossiers/${dossierId}/soumettre`)
      navigate('/patient/paiement', { state: { dossierId } })
    } catch (err) {
      setError(err.response?.data?.message || t('errors.createCaseFailed'))
      setSubmitting(false)
    }
  }

  if (!dossierId) return null

  return (
    <div className="bg-gradient-to-br from-slate-50 to-primary-50/30 dark:from-neutral-900 dark:to-neutral-900 text-slate-900 dark:text-white min-h-screen flex flex-col md:flex-row font-sans selection:bg-primary-500/30">
      <header className="fixed top-0 w-full z-50 glass-card border-b-0 flex justify-between items-center px-4 h-16 md:hidden">
        <button
          aria-label={t('patient.questionnaire.closeAria')}
          className="text-slate-500 dark:text-slate-400 flex items-center justify-center p-2 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors"
          onClick={() => navigate('/patient/dossiers')}
        >
          <X className="w-6 h-6" />
        </button>
        <span className="font-display text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary-600 dark:text-primary-400" /> IMSOP
        </span>
        <div className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto pt-20 pb-28 md:py-12 px-4 sm:px-6 flex flex-col animate-fade-in">
        <div className="hidden md:flex items-center mb-10">
          <button
            aria-label={t('common.back')}
            className="h-10 w-10 shrink-0 rounded-full bg-white dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700 shadow-sm flex items-center justify-center hover:bg-slate-50 dark:hover:bg-neutral-700 transition-colors text-slate-600 dark:text-slate-400 mr-4 group"
            onClick={() => navigate('/patient/dossiers')}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">{t('patient.questionnaire.title')}</h1>
        </div>

        <div className="mb-10 w-full max-w-3xl mx-auto">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-neutral-700 z-0 rounded-full" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-primary-500 z-0 rounded-full" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold shadow-md shadow-primary-900/20">
                <Check className="w-5 h-5" />
              </div>
              <span className="mt-3 font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:block">
                {t('patient.questionnaire.stepIdentity')}
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold shadow-md shadow-primary-900/20">
                <Check className="w-5 h-5" />
              </div>
              <span className="mt-3 font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:block">
                {t('patient.questionnaire.stepMedical')}
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 flex items-center justify-center font-bold ring-4 ring-white dark:ring-neutral-900 shadow-sm border border-primary-200 dark:border-primary-800">
                3
              </div>
              <span className="mt-3 font-bold text-xs uppercase tracking-wider text-primary-700 dark:text-primary-400 hidden md:block">
                {t('patient.questionnaire.stepDocuments')}
              </span>
            </div>
          </div>
          <div className="text-center mt-6 md:hidden">
            <span className="font-bold text-sm text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-4 py-1.5 rounded-full border border-primary-100 dark:border-primary-800">
              {t('patient.documents.stepMobile')}
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-3xl mx-auto w-full flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
              <UploadCloud className="w-6 h-6 text-primary-600 dark:text-primary-400" /> {t('patient.documents.title')}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('patient.documents.subtitle')}</p>

            {error && (
              <div className="mb-6 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <form className="flex flex-col gap-4" onSubmit={handleUpload}>
              <div className="flex flex-col gap-2.5">
                <label className="font-bold text-sm text-slate-900 dark:text-white" htmlFor="category">
                  {t('patient.documents.categoryLabel')}
                </label>
                <select
                  id="category"
                  className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none cursor-pointer hover:bg-white dark:hover:bg-neutral-700"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {t(`patient.documents.${c.key}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="font-bold text-sm text-slate-900 dark:text-white">{t('patient.documents.chooseFile')}</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="cursor-pointer bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700 text-slate-700 dark:text-slate-300 font-semibold text-sm px-4 py-2.5 rounded-xl shadow-sm transition-colors">
                    {t('patient.documents.chooseFile')}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={ACCEPTED}
                      className="hidden"
                      onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files || [])])}
                    />
                  </label>
                  <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {files.length > 0 ? t('patient.documents.filesSelected', { count: files.length }) : t('patient.documents.noFileChosen')}
                  </span>
                </div>
                {files.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {files.map((f, index) => (
                      <li
                        key={`${f.name}-${f.size}-${index}`}
                        className="flex items-center justify-between gap-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700 rounded-lg px-3 py-2"
                      >
                        <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          aria-label={t('patient.documents.removeFile')}
                          className="text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">{t('patient.documents.acceptedFormats')}</p>
              </div>

              <button
                type="submit"
                disabled={uploading || files.length === 0}
                className="self-start mt-2 bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md shadow-primary-900/10 transition-all flex items-center gap-2 disabled:opacity-60"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {uploading ? t('patient.documents.uploading') : t('patient.documents.uploadButton', { count: files.length || 1 })}
              </button>
            </form>
          </div>

          <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t('patient.documents.uploadedListTitle')}</h3>
            {documents.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">{t('patient.documents.empty')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center gap-3 bg-slate-50 dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700 rounded-xl p-3"
                  >
                    <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 p-2 rounded-lg shrink-0">
                      {doc.mimeType?.startsWith('image/') ? (
                        <FileImage className="w-5 h-5" />
                      ) : (
                        <FileText className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{doc.filename}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t(`patient.documents.category${doc.category?.charAt(0)}${doc.category?.slice(1).toLowerCase()}`, {
                          defaultValue: doc.category,
                        })}{' '}
                        · {formatSize(doc.sizeBytes)}
                      </p>
                    </div>
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {documents.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
              {t('patient.documents.skipNote')}
            </p>
          )}

          <ConsentementGate
            accepted={consentementAccepte}
            onAcceptedChange={setConsentementAccepte}
            nomSignataire={nomSignataire}
            onNomChange={setNomSignataire}
            otpToken={otpToken}
            onOtpTokenChange={setOtpToken}
            disabled={submitting}
          />
        </div>

        <div className="fixed bottom-0 left-0 w-full glass-card border-b-0 border-x-0 p-4 md:static md:bg-transparent md:border-none md:p-0 md:mt-8 max-w-3xl mx-auto flex gap-4 md:shadow-none shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
          <button
            className="flex-1 md:flex-none md:w-32 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600 text-slate-700 dark:text-slate-300 font-bold py-3.5 px-6 rounded-xl transition-all shadow-sm"
            type="button"
            onClick={() => navigate(-1)}
          >
            {t('patient.documents.back')}
          </button>
          <button
            className="flex-[2] md:flex-1 bg-slate-900 dark:bg-white hover:bg-primary-600 dark:hover:bg-primary-500 text-white dark:text-slate-900 dark:hover:text-white font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 group disabled:opacity-60"
            type="button"
            onClick={handleContinue}
            disabled={submitting || !consentementAccepte || nomSignataire.trim().length < 2 || !otpToken}
          >
            {submitting ? t('patient.documents.submitting') : t('patient.documents.finish')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="h-24 md:hidden" />
      </main>
    </div>
  )
}
