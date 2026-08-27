import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'

function computeAge(dob) {
  if (!dob) return null
  const diff = Date.now() - new Date(dob).getTime()
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
}

export default function RedactionRapportExpert() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const [dossier, setDossier] = useState(null)
  const [documents, setDocuments] = useState([])
  const [rapport, setRapport] = useState(null)
  const [synthese, setSynthese] = useState('')
  const [diagnostic, setDiagnostic] = useState('')
  const [therapeutique, setTherapeutique] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showDocs, setShowDocs] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [{ data: dossierData }, { data: documentsData }] = await Promise.all([
          api.get(`/dossiers/${id}`),
          api.get(`/dossiers/${id}/documents`),
        ])
        if (cancelled) return
        setDossier(dossierData)
        setDocuments(documentsData)
        try {
          const { data: rapportData } = await api.get(`/dossiers/${id}/rapport`)
          if (cancelled) return
          setRapport(rapportData)
          setSynthese(rapportData.synthese || '')
          setDiagnostic(rapportData.diagnostic || '')
          setTherapeutique(rapportData.optionsTherapeutiques || '')
        } catch {
          // No draft yet - start from a blank report.
        }
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
  }, [id])

  const readOnly = rapport && rapport.status !== 'BROUILLON'

  async function saveDraft() {
    setSaving(true)
    try {
      const { data } = await api.put(`/dossiers/${id}/rapport`, { synthese, diagnostic, optionsTherapeutiques: therapeutique })
      setRapport(data)
    } catch (err) {
      setError(err.response?.data?.message || t('specialiste.report.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function submitReport(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await api.put(`/dossiers/${id}/rapport`, { synthese, diagnostic, optionsTherapeutiques: therapeutique })
      await api.post(`/dossiers/${id}/rapport/soumettre`)
      navigate('/specialiste/tableau-de-bord')
    } catch (err) {
      setError(err.response?.data?.message || t('specialiste.report.submitFailed'))
      setSubmitting(false)
    }
  }

  async function openDocument(docId) {
    const { data } = await api.get(`/documents/${docId}/download`)
    window.open(data.url, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="bg-background min-h-screen flex items-center justify-center text-on-surface-variant">
        {t('specialiste.report.loadingCase')}
      </div>
    )
  }

  if (error && !dossier) {
    return (
      <div className="bg-background min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-on-surface-variant">{error}</p>
        <button onClick={() => navigate('/specialiste/tableau-de-bord')} className="text-primary font-label-md">
          {t('specialiste.report.backToDashboard')}
        </button>
      </div>
    )
  }

  const age = computeAge(dossier.patient.dob)

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col pt-12 pb-24 md:pb-0">
      <header className="fixed top-0 flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop h-12 z-50 bg-surface border-b border-outline-variant">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/specialiste/tableau-de-bord')}>
            <span className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer rounded-full p-1">
              close
            </span>
          </button>
          <h1 className="text-headline-md font-headline-md font-bold text-primary">IMSOP</h1>
        </div>
      </header>

      <main className="flex-grow flex flex-col w-full max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-md">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md mb-stack-lg flex flex-col md:flex-row md:justify-between md:items-start gap-stack-md">
          <div>
            <h2 className="text-headline-md font-headline-md text-on-surface mb-1">{dossier.patient.user.fullName}</h2>
            <div className="flex flex-wrap gap-2 text-body-md font-body-md text-on-surface-variant">
              {age !== null && (
                <>
                  <span>{t('specialiste.report.age')} : {age} {t('specialiste.report.years')}</span>
                  <span className="text-outline-variant">•</span>
                </>
              )}
              {dossier.patient.gender && (
                <>
                  <span className="capitalize">{dossier.patient.gender}</span>
                  <span className="text-outline-variant">•</span>
                </>
              )}
              <span className="font-mono text-sm">{t('specialiste.report.caseLabel')} #{dossier.reference}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDocs((v) => !v)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 border border-outline-variant rounded-full text-label-md font-label-md text-primary hover:bg-surface-container transition-colors w-full md:w-auto h-12"
          >
            <span className="material-symbols-outlined text-[18px]">description</span>
            {t('specialiste.report.documents', { count: documents.length })}
          </button>
        </section>

        {showDocs && (
          <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-stack-md mb-stack-lg flex flex-col gap-2">
            {documents.length === 0 ? (
              <p className="font-body-md text-on-surface-variant">{t('specialiste.report.noDocuments')}</p>
            ) : (
              documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => openDocument(doc.id)}
                  className="flex items-center justify-between text-left p-3 rounded-lg hover:bg-surface-container transition-colors border border-outline-variant/50"
                >
                  <span className="flex items-center gap-2 font-body-md text-on-surface">
                    <span className="material-symbols-outlined text-primary text-[20px]">draft</span>
                    {doc.filename}
                  </span>
                  <span className="font-label-sm text-on-surface-variant">{doc.category}</span>
                </button>
              ))
            )}
          </section>
        )}

        {dossier.questionMedecinLocal && (
          <section className="bg-secondary/10 border border-secondary/30 rounded-lg p-stack-md mb-stack-lg">
            <p className="font-label-sm text-label-sm font-bold text-secondary uppercase tracking-wider mb-1">
              {t('specialiste.report.doctorQuestionTitle')}
            </p>
            <p className="font-body-md text-on-surface">{dossier.questionMedecinLocal}</p>
          </section>
        )}

        {dossier.questionMedicale && (
          <section className="bg-primary/5 border border-primary/20 rounded-lg p-stack-md mb-stack-lg">
            <p className="font-label-sm text-label-sm font-bold text-primary uppercase tracking-wider mb-1">{t('specialiste.report.questionTitle')}</p>
            <p className="font-body-md text-on-surface">{dossier.questionMedicale}</p>
          </section>
        )}

        {error && (
          <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-4 py-3 mb-stack-md">{error}</div>
        )}

        {readOnly && (
          <div className="bg-secondary-container text-on-secondary-container text-label-sm font-label-sm rounded-lg px-4 py-3 mb-stack-md">
            {t('specialiste.report.alreadySubmitted')}
          </div>
        )}

        <form className="flex flex-col gap-stack-lg pb-stack-lg" onSubmit={submitReport}>
          <fieldset className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">biotech</span>
              <legend className="text-label-md font-label-md text-on-surface font-bold uppercase tracking-wider">{t('specialiste.report.diagnosticTitle')}</legend>
            </div>
            <div className="p-4">
              <textarea
                className="block w-full rounded-md border-0 py-3 text-on-surface shadow-sm ring-1 ring-inset ring-outline-variant placeholder:text-outline focus:ring-2 focus:ring-inset focus:ring-primary sm:text-body-md font-body-md bg-surface resize-y min-h-[150px] disabled:opacity-60"
                placeholder={t('specialiste.report.diagnosticPlaceholder')}
                value={diagnostic}
                onChange={(e) => setDiagnostic(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </fieldset>

          <fieldset className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">medical_services</span>
              <legend className="text-label-md font-label-md text-on-surface font-bold uppercase tracking-wider">{t('specialiste.report.therapeuticTitle')}</legend>
            </div>
            <div className="p-4">
              <textarea
                className="block w-full rounded-md border-0 py-3 text-on-surface shadow-sm ring-1 ring-inset ring-outline-variant placeholder:text-outline focus:ring-2 focus:ring-inset focus:ring-primary sm:text-body-md font-body-md bg-surface resize-y min-h-[150px] disabled:opacity-60"
                placeholder={t('specialiste.report.therapeuticPlaceholder')}
                value={therapeutique}
                onChange={(e) => setTherapeutique(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </fieldset>

          <fieldset className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
            <div className="bg-surface-container-low px-4 py-3 border-b border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">summarize</span>
              <legend className="text-label-md font-label-md text-on-surface font-bold uppercase tracking-wider">{t('specialiste.report.synthesisTitle')}</legend>
            </div>
            <div className="p-4">
              <textarea
                className="block w-full rounded-md border-0 py-3 text-on-surface shadow-sm ring-1 ring-inset ring-outline-variant placeholder:text-outline focus:ring-2 focus:ring-inset focus:ring-primary sm:text-body-md font-body-md bg-surface resize-y min-h-[150px] disabled:opacity-60"
                placeholder={t('specialiste.report.synthesisPlaceholder')}
                value={synthese}
                onChange={(e) => setSynthese(e.target.value)}
                disabled={readOnly}
              />
            </div>
          </fieldset>

          {!readOnly && (
            <div className="h-24 md:h-8" />
          )}

          {!readOnly && (
            <div className="fixed bottom-0 left-0 w-full z-50 bg-surface border-t border-outline-variant p-margin-mobile flex flex-col md:flex-row gap-stack-sm md:justify-end md:static md:border-t-0 md:bg-transparent md:p-0 md:mt-auto">
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving || submitting}
                className="w-full md:w-auto min-h-[48px] px-6 py-3 border border-primary text-primary bg-transparent rounded-full text-label-md font-label-md hover:bg-primary-container/10 transition-colors flex justify-center items-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">save</span>
                {saving ? t('specialiste.report.saving') : t('specialiste.report.saveDraft')}
              </button>
              <button
                type="submit"
                disabled={saving || submitting || !synthese || !diagnostic}
                className="w-full md:w-auto min-h-[48px] px-6 py-3 border border-transparent text-on-secondary bg-secondary rounded-full text-label-md font-label-md hover:bg-secondary/90 transition-colors shadow-sm flex justify-center items-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[20px]">send</span>
                {submitting ? t('specialiste.report.submitting') : t('specialiste.report.submit')}
              </button>
            </div>
          )}
        </form>
      </main>
    </div>
  )
}
