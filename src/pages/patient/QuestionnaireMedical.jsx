import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, Check, ChevronDown, ArrowRight, Activity, FileText } from 'lucide-react'
import { api } from '../../lib/api'

const SPECIALITE_KEYS = [
  'oncologie', 'cardiologie', 'neurologie', 'orthopedie', 'radiologie', 'anatomopathologie',
  'pediatrie', 'gynecologie', 'nephrologie', 'gastroenterologie', 'pneumologie',
]

// Stored in French regardless of UI language: this text is displayed verbatim
// (with no further translation lookup) to coordinators and specialists
// elsewhere in the app, so the canonical stored value must stay stable.
const SPECIALITE_FR = {
  oncologie: 'Oncologie', cardiologie: 'Cardiologie', neurologie: 'Neurologie', orthopedie: 'Orthopédie',
  radiologie: 'Radiologie', anatomopathologie: 'Anatomopathologie', pediatrie: 'Pédiatrie',
  gynecologie: 'Gynécologie-obstétrique', nephrologie: 'Néphrologie',
  gastroenterologie: 'Gastro-entérologie', pneumologie: 'Pneumologie',
}

const MOTIF_FR = {
  second_avis: 'Demande de second avis médical',
  diag_difficile: 'Diagnostic complexe / incertain',
  suivi: 'Suivi post-opératoire',
  autre: 'Autre motif',
}

export default function QuestionnaireMedical() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [specialiteKey, setSpecialiteKey] = useState('')
  const [motif, setMotif] = useState('')
  const [symptomes, setSymptomes] = useState('')
  const [antecedents, setAntecedents] = useState('non')
  const [traitement, setTraitement] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const { data: dossier } = await api.post('/dossiers', {
        specialiteRequise: SPECIALITE_FR[specialiteKey] || specialiteKey,
        motif: MOTIF_FR[motif] || motif,
        symptomes,
        antecedents: antecedents === 'oui' ? 'Antécédents médicaux déclarés par le patient' : 'Aucun antécédent déclaré',
        traitementEnCours: traitement || undefined,
      })
      navigate('/patient/nouvelle-demande/documents', { state: { dossierId: dossier.id } })
    } catch (err) {
      setError(err.response?.data?.message || t('errors.createCaseFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-slate-50 to-primary-50/30 text-slate-900 min-h-screen flex flex-col md:flex-row font-sans selection:bg-primary-500/30">
      <header className="fixed top-0 w-full z-50 glass-card border-b-0 flex justify-between items-center px-4 h-16 md:hidden">
        <button
          aria-label={t('patient.questionnaire.closeAria')}
          className="text-slate-500 flex items-center justify-center p-2 hover:bg-slate-100 rounded-full transition-colors"
          onClick={() => navigate('/patient/dossiers')}
        >
          <X className="w-6 h-6" />
        </button>
        <span className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
           <Activity className="w-5 h-5 text-primary-600" /> IMSOP
        </span>
        <div className="w-10" />
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto pt-20 pb-28 md:py-12 px-4 sm:px-6 flex flex-col animate-fade-in">
        <div className="hidden md:flex items-center mb-10">
          <button
            aria-label={t('common.back')}
            className="h-10 w-10 shrink-0 rounded-full bg-white border border-slate-200/60 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors text-slate-600 mr-4 group"
            onClick={() => navigate('/patient/dossiers')}
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <h1 className="font-display text-3xl font-bold text-slate-900">{t('patient.questionnaire.title')}</h1>
        </div>

        <div className="mb-10 w-full max-w-3xl mx-auto">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 z-0 rounded-full" />
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1/2 h-1 bg-primary-500 z-0 rounded-full" />

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold shadow-md shadow-primary-900/20">
                <Check className="w-5 h-5" />
              </div>
              <span className="mt-3 font-semibold text-xs uppercase tracking-wider text-slate-500 hidden md:block">
                {t('patient.questionnaire.stepIdentity')}
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center font-bold ring-4 ring-white shadow-sm border border-primary-200">
                2
              </div>
              <span className="mt-3 font-bold text-xs uppercase tracking-wider text-primary-700 hidden md:block">
                {t('patient.questionnaire.stepMedical')}
              </span>
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-white text-slate-400 border border-slate-200 flex items-center justify-center font-bold shadow-sm">
                3
              </div>
              <span className="mt-3 font-semibold text-xs uppercase tracking-wider text-slate-400 hidden md:block">
                {t('patient.questionnaire.stepDocuments')}
              </span>
            </div>
          </div>
          <div className="text-center mt-6 md:hidden">
            <span className="font-bold text-sm text-primary-700 bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100">
              {t('patient.questionnaire.stepMobile')}
            </span>
          </div>
        </div>

        <div className="flex-1 max-w-3xl mx-auto w-full">
          <div className="glass-card rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-8 flex items-center gap-3 border-b border-slate-100/60 pb-4">
               <FileText className="w-6 h-6 text-primary-600" /> {t('patient.questionnaire.formTitle')}
            </h2>

            {error && (
              <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <form className="flex flex-col gap-8" onSubmit={onSubmit} id="questionnaire-form">
              <div className="flex flex-col gap-2.5">
                <label className="font-bold text-sm text-slate-900" htmlFor="specialite">
                  {t('patient.questionnaire.specialiteLabel')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none cursor-pointer hover:bg-white"
                    id="specialite"
                    required
                    value={specialiteKey}
                    onChange={(e) => setSpecialiteKey(e.target.value)}
                  >
                    <option disabled value="">
                      {t('patient.questionnaire.specialiteSelect')}
                    </option>
                    {SPECIALITE_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {t(`common.specialites.${key}`)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 w-5 h-5" />
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="font-bold text-sm text-slate-900" htmlFor="motif">
                  {t('patient.questionnaire.motifLabel')} <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none cursor-pointer hover:bg-white"
                    id="motif"
                    required
                    value={motif}
                    onChange={(e) => setMotif(e.target.value)}
                  >
                    <option disabled value="">
                      {t('patient.questionnaire.motifSelect')}
                    </option>
                    <option value="second_avis">{t('patient.questionnaire.motifSecondAvis')}</option>
                    <option value="diag_difficile">{t('patient.questionnaire.motifDiagDifficile')}</option>
                    <option value="suivi">{t('patient.questionnaire.motifSuivi')}</option>
                    <option value="autre">{t('patient.questionnaire.motifAutre')}</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 w-5 h-5" />
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="font-bold text-sm text-slate-900" htmlFor="symptomes">
                  {t('patient.questionnaire.symptomesLabel')} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-y placeholder:text-slate-400 hover:bg-white min-h-[120px]"
                  id="symptomes"
                  placeholder={t('patient.questionnaire.symptomesPlaceholder')}
                  rows={4}
                  required
                  value={symptomes}
                  onChange={(e) => setSymptomes(e.target.value)}
                />
                <p className="text-xs font-semibold text-slate-500 mt-1">
                  {t('patient.questionnaire.symptomesHint')}
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <label className="font-bold text-sm text-slate-900">
                  {t('patient.questionnaire.antecedentsQuestion')}
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {['oui', 'non'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAntecedents(val)}
                      className={`rounded-xl p-4 text-center font-bold text-sm capitalize transition-all border shadow-sm ${
                        antecedents === val
                          ? 'bg-primary-50 border-primary-500 text-primary-700 shadow-primary-900/5'
                          : 'bg-slate-50 border-slate-200/60 text-slate-700 hover:bg-white'
                      }`}
                    >
                      {t(`patient.questionnaire.antecedents${val === 'oui' ? 'Oui' : 'Non'}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <label className="font-bold text-sm text-slate-900" htmlFor="traitement">
                  {t('patient.questionnaire.traitementLabel')}{' '}
                  <span className="text-slate-400 font-medium">{t('patient.questionnaire.optional')}</span>
                </label>
                <input
                  className="w-full bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-3.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all placeholder:text-slate-400 hover:bg-white"
                  id="traitement"
                  placeholder={t('patient.questionnaire.traitementPlaceholder')}
                  type="text"
                  value={traitement}
                  onChange={(e) => setTraitement(e.target.value)}
                />
              </div>
            </form>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 w-full glass-card border-b-0 border-x-0 p-4 md:static md:bg-transparent md:border-none md:p-0 md:mt-8 max-w-3xl mx-auto flex gap-4 md:shadow-none shadow-[0_-8px_30px_rgba(0,0,0,0.04)]">
          <button
            className="flex-1 md:flex-none md:w-32 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700 font-bold py-3.5 px-6 rounded-xl transition-all shadow-sm"
            type="button"
            onClick={() => navigate('/patient/dossiers')}
          >
            {t('patient.questionnaire.back')}
          </button>
          <button
            className="flex-[2] md:flex-1 bg-slate-900 hover:bg-primary-600 text-white font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-slate-900/10 group disabled:opacity-60"
            type="submit"
            form="questionnaire-form"
            disabled={submitting}
          >
            {submitting ? t('patient.questionnaire.submitting') : t('patient.questionnaire.next')}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="h-24 md:hidden" />
      </main>
    </div>
  )
}
