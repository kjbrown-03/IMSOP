import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PatientShell from '../../components/layout/PatientShell'
import TemoignageForm from '../../components/ui/TemoignageForm'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'
import { Plus, ArrowRight, MoreVertical, RefreshCw, CheckCircle, AlertTriangle, MailWarning, Clock } from 'lucide-react'

const STATUS_ICON = {
  BROUILLON: { bg: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300', icon: Clock },
  SOUMIS: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: RefreshCw },
  EN_ATTENTE_PAIEMENT: { bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20', icon: AlertTriangle },
  EN_ATTENTE_DOCUMENTS: { bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20', icon: AlertTriangle },
  EN_VERIFICATION: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: RefreshCw },
  COMPLET: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: CheckCircle },
  EN_ATTENTE_AFFECTATION: { bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20', icon: Clock },
  AFFECTE: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: RefreshCw },
  ACCEPTE_PAR_SPECIALISTE: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: CheckCircle },
  EN_ANALYSE: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: RefreshCw },
  INFORMATION_COMPLEMENTAIRE_DEMANDEE: { bg: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20', icon: AlertTriangle },
  RAPPORT_EN_PREPARATION: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: RefreshCw },
  RAPPORT_SOUMIS: { bg: 'bg-primary-50 text-primary-700 ring-1 ring-primary-600/20', icon: RefreshCw },
  RAPPORT_VALIDE: { bg: 'bg-secondary-50 text-secondary-700 ring-1 ring-secondary-600/20', icon: CheckCircle },
  RAPPORT_TRANSMIS: { bg: 'bg-secondary-50 text-secondary-700 ring-1 ring-secondary-600/20', icon: CheckCircle },
  SUIVI: { bg: 'bg-secondary-50 text-secondary-700 ring-1 ring-secondary-600/20', icon: RefreshCw },
  CLOTURE: { bg: 'bg-slate-100 text-slate-700 ring-1 ring-slate-300', icon: CheckCircle },
  ANNULE: { bg: 'bg-rose-50 text-rose-700 ring-1 ring-rose-300', icon: AlertTriangle },
  REFUSE: { bg: 'bg-rose-50 text-rose-700 ring-1 ring-rose-300', icon: AlertTriangle },
}

export default function DashboardPatient() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const { data } = await api.get('/dossiers')
        if (!cancelled) setDossiers(data.items)
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

  const incompletDossier = dossiers.find((d) => d.status === 'EN_ATTENTE_PAIEMENT')

  return (
    <PatientShell
      title="IMSOP"
      fab={
        <Link
          to="/patient/nouvelle-demande"
          className="fixed bottom-24 right-4 sm:right-8 bg-slate-900 hover:bg-primary-600 text-white font-medium h-14 px-4 sm:px-6 rounded-full shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 z-40 active:scale-95 transition-all duration-300 group"
        >
          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
          <span className="hidden sm:inline">{t('patient.dashboard.newRequest')}</span>
        </Link>
      }
    >
      {user && !user.emailVerified && (
        <section className="flex flex-col w-full animate-fade-in-up">
          <div className="glass-card bg-amber-50/80 border-amber-200/60 rounded-3xl p-5 sm:p-6 flex gap-4 items-start shadow-sm shadow-amber-900/5">
            <div className="bg-amber-100 p-2 rounded-xl shrink-0 mt-0.5">
              <MailWarning className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <h2 className="text-base font-bold text-amber-900">{t('patient.dashboard.verifyEmailTitle')}</h2>
              <p className="text-amber-700/90 text-sm leading-relaxed">
                {t('patient.dashboard.verifyEmailText')}
              </p>
              <Link
                to="/verifier-email"
                className="mt-2 text-sm font-semibold text-amber-800 self-start flex items-center gap-1.5 hover:text-amber-900 transition-colors group bg-amber-100/50 hover:bg-amber-100 px-4 py-2 rounded-lg"
              >
                {t('patient.dashboard.verifyEmailCta')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {incompletDossier && (
        <section className="flex flex-col w-full animate-fade-in-up">
          <div className="glass-card bg-red-50/80 border-red-200/60 rounded-3xl p-5 sm:p-6 flex gap-4 items-start shadow-sm shadow-red-900/5">
            <div className="bg-red-100 p-2 rounded-xl shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <h2 className="text-base font-bold text-red-900">{t('patient.dashboard.actionRequired')}</h2>
              <p className="text-red-700/90 text-sm leading-relaxed">
                {t('patient.dashboard.paymentPending', {
                  specialite: incompletDossier.specialiteRequise,
                  reference: incompletDossier.reference,
                })}
              </p>
              <Link
                to="/patient/paiement"
                state={{ dossierId: incompletDossier.id }}
                className="mt-2 text-sm font-semibold text-red-700 self-start flex items-center gap-1.5 hover:text-red-800 transition-colors group bg-red-100/50 hover:bg-red-100 px-4 py-2 rounded-lg"
              >
                {t('patient.dashboard.finalizePayment')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-6 w-full pb-8">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100">{t('patient.dashboard.activeCases')}</h2>
        </div>

        {loading && (
          <div className="glass-card rounded-3xl p-8 text-center text-slate-500">{t('patient.dashboard.loading')}</div>
        )}

        {error && !loading && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium rounded-2xl px-5 py-4">
            {error}
          </div>
        )}

        {!loading && !error && dossiers.length === 0 && (
          <div className="glass-card rounded-3xl p-10 text-center flex flex-col items-center gap-3">
            <p className="text-slate-600">{t('patient.dashboard.empty')}</p>
            <Link
              to="/patient/nouvelle-demande"
              className="inline-flex items-center gap-2 bg-slate-900 text-white font-semibold px-5 py-2.5 rounded-full hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-4 h-4" /> {t('patient.dashboard.createFirst')}
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {dossiers.map((d, idx) => {
            const meta = STATUS_ICON[d.status] || STATUS_ICON.BROUILLON
            const StatusIcon = meta.icon
            return (
              <Link
                to={`/patient/dossiers/${d.id}`}
                key={d.id}
                className="glass-card rounded-3xl p-6 flex flex-col gap-4 group hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-900/10 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.1 * (idx + 1)}s` }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-lg">{d.specialiteRequise}</span>
                    <span className="text-xs font-semibold text-slate-500 mt-1">
                      {t('patient.dashboard.reference')}: #{d.reference} • {formatDate(d.createdAt)}
                    </span>
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-xl hover:bg-slate-100">
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 mt-2">
                  <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">{d.motif}</p>
                </div>

                <div className="flex items-center justify-between mt-auto pt-5 border-t border-slate-100/60">
                  <div className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full ${meta.bg}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {t(`patient.dossierStatus.${d.status}`)}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <TemoignageForm />
    </PatientShell>
  )
}
