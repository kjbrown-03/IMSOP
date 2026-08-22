import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PatientShell from '../../components/layout/PatientShell'
import { api } from '../../lib/api'
import { ArrowLeft, CheckCircle, Download, Stethoscope, Activity, FileText, ClipboardList, Clock } from 'lucide-react'

export default function RapportExpertFinal() {
  const { id } = useParams()
  const { t, i18n } = useTranslation()
  const [dossier, setDossier] = useState(null)
  const [rapport, setRapport] = useState(null)
  const [rapportError, setRapportError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  function formatDate(iso) {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data: dossierData } = await api.get(`/dossiers/${id}`)
        if (cancelled) return
        setDossier(dossierData)
        try {
          const { data: rapportData } = await api.get(`/dossiers/${id}/rapport`)
          if (!cancelled) setRapport(rapportData)
        } catch (err) {
          if (!cancelled) setRapportError(err.response?.data?.message || t('errors.reportUnavailable'))
        }
      } catch (err) {
        if (!cancelled) setRapportError(err.response?.data?.message || t('errors.caseNotFound'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id, t])

  async function downloadPdf() {
    if (!rapport?.id) return
    setDownloading(true)
    try {
      const { data } = await api.get(`/rapports/${rapport.id}/pdf`)
      if (data.url) window.open(data.url, '_blank', 'noopener')
    } catch (err) {
      alert(err.response?.data?.message || t('errors.pdfUnavailable'))
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <PatientShell title={t('patient.report.title')}>
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 animate-fade-in-up">{t('common.loading')}</div>
      </PatientShell>
    )
  }

  return (
    <PatientShell
      title={t('patient.report.title')}
      left={
        <Link to="/patient/dossiers" className="h-10 w-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
      }
    >
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-6 animate-fade-in-up">
        <div>
          <h2 className="text-3xl font-display font-bold text-slate-900">{t('patient.report.heading')}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
              {t('patient.report.caseLabel')} #{dossier?.reference}
            </span>
            {rapport?.validatedAt && (
              <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                • {t('patient.report.validatedOn')} {formatDate(rapport.validatedAt)}
              </span>
            )}
          </div>
        </div>
        {rapport && (
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2.5 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm">
              <CheckCircle className="w-4 h-4" /> {t('patient.report.validated')}
            </div>
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="bg-slate-900 text-white font-semibold py-2.5 px-5 rounded-xl flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-md shadow-slate-900/10 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">{downloading ? t('patient.report.preparing') : t('patient.report.download')}</span>
            </button>
          </div>
        )}
      </div>

      {rapportError && !rapport && (
        <div className="glass-card rounded-3xl p-10 flex flex-col items-center gap-3 text-center animate-fade-in-up">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">{t('patient.report.notAvailableTitle')}</h3>
          <p className="text-slate-500 max-w-md">{rapportError}</p>
        </div>
      )}

      {rapport && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
          <section className="glass-card rounded-3xl p-6 shadow-sm flex flex-col h-full animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100/60">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t('patient.report.caseInfoTitle')}</h3>
            </div>
            <div className="flex flex-col gap-5 flex-grow">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('patient.report.patientLabel')}</span>
                <span className="text-sm font-semibold text-slate-900">{dossier?.patient?.user?.fullName}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('patient.report.specialiteLabel')}</span>
                <span className="text-sm font-semibold text-slate-900">{dossier?.specialiteRequise}</span>
              </div>
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">{t('patient.report.motifLabel')}</span>
                <span className="text-sm font-semibold text-slate-900">{dossier?.motif}</span>
              </div>
            </div>
          </section>

          <section className="glass-card rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 h-full lg:col-span-2 animate-fade-in-up">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-lg flex-shrink-0 bg-primary-100 flex items-center justify-center">
              <Stethoscope className="w-10 h-10 text-primary-600" />
            </div>
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <h3 className="text-xl font-bold text-slate-900">{dossier?.specialiste?.user?.fullName}</h3>
                <span className="inline-flex self-center items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 text-primary-700 text-xs font-bold uppercase tracking-wider border border-primary-100">
                  <Stethoscope className="w-3.5 h-3.5" /> {dossier?.specialiste?.specialite}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-3">{dossier?.specialiste?.etablissement}</p>
            </div>
          </section>

          <section className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm lg:col-span-3 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-primary-100 text-primary-600 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-display font-bold text-slate-900">{t('patient.report.synthesisTitle')}</h3>
            </div>

            <div className="bg-primary-50/50 p-5 sm:p-6 rounded-2xl border-l-4 border-primary-500 mb-8 shadow-sm">
              <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                {rapport.diagnostic || t('patient.report.noDiagnostic')}
              </p>
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-slate-500" /> {t('patient.report.clinicalSynthesis')}
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line bg-white/60 p-4 rounded-xl border border-slate-100">
              {rapport.synthese || t('patient.report.noSynthesis')}
            </p>
          </section>

          {rapport.optionsTherapeutiques && (
            <section className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm lg:col-span-3 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-display font-bold text-slate-900">{t('patient.report.therapeuticOptions')}</h3>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{rapport.optionsTherapeutiques}</p>
            </section>
          )}
        </div>
      )}
    </PatientShell>
  )
}
