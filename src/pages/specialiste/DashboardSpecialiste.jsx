import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SpecialistShell from '../../components/layout/SpecialistShell'
import { api } from '../../lib/api'
import { useAuthStore } from '../../store/useAuthStore'
import {
  HeartPulse, Brain, Microscope, Activity, Stethoscope, Calendar, Circle,
  ShieldAlert, CheckCircle, ChevronRight, Filter, Check, X, Play, HelpCircle,
} from 'lucide-react'

const SPECIALITE_ICON = [
  [/cardio/i, HeartPulse, 'text-rose-600', 'bg-rose-50'],
  [/neuro/i, Brain, 'text-indigo-600', 'bg-indigo-50'],
  [/onco/i, Microscope, 'text-amber-600', 'bg-amber-50'],
  [/pneumo/i, Activity, 'text-emerald-600', 'bg-emerald-50'],
]
function specialiteVisual(specialite) {
  const match = SPECIALITE_ICON.find(([re]) => re.test(specialite || ''))
  return match ? { Icon: match[1], color: match[2], bg: match[3] } : { Icon: Stethoscope, color: 'text-primary-600', bg: 'bg-primary-50' }
}

const GROUP_OF_STATUS = {
  AFFECTE: 'nouveau',
  ACCEPTE_PAR_SPECIALISTE: 'en-cours',
  EN_ANALYSE: 'en-cours',
  INFORMATION_COMPLEMENTAIRE_DEMANDEE: 'en-cours',
  RAPPORT_EN_PREPARATION: 'en-cours',
  RAPPORT_SOUMIS: 'en-cours',
  RAPPORT_VALIDE: 'termine',
  RAPPORT_TRANSMIS: 'termine',
  SUIVI: 'termine',
  CLOTURE: 'termine',
}

function formatDate(iso, lang) {
  return new Date(iso).toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function DashboardSpecialiste({ showAvailabilityToggle = false }) {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const setDisponibilite = useAuthStore((s) => s.setDisponibilite)
  const [togglingAvailability, setTogglingAvailability] = useState(false)
  const [availabilityError, setAvailabilityError] = useState(null)

  // Source unique : le profil persisté. L'ancien état local se désynchronisait
  // du store et réaffichait « Disponible » à chaque remontage de l'écran.
  const available = !!user?.disponible
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('tous')
  const [decidingId, setDecidingId] = useState(null)
  const [complementId, setComplementId] = useState(null)
  const [precisions, setPrecisions] = useState('')
  const [refusingId, setRefusingId] = useState(null)
  const [motif, setMotif] = useState('')

  async function load() {
    setLoading(true)
    try {
      const { data } = await api.get('/dossiers')
      setDossiers(data.items)
    } catch (err) {
      setError(err.response?.data?.message || t('errors.loadCasesFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleAvailability() {
    setTogglingAvailability(true)
    setAvailabilityError(null)
    // Un échec doit se voir : sans message, un refus de l'API se lisait comme
    // un interrupteur qui « ne marche pas ».
    const result = await setDisponibilite(!available)
    if (!result.ok) setAvailabilityError(result.error)
    setTogglingAvailability(false)
  }

  async function accepter(id) {
    setDecidingId(id)
    try {
      await api.post(`/dossiers/${id}/accepter`)
      await load()
    } finally {
      setDecidingId(null)
    }
  }

  async function demarrerAnalyse(id) {
    setDecidingId(id)
    try {
      await api.post(`/dossiers/${id}/analyser`)
      await load()
    } finally {
      setDecidingId(null)
    }
  }

  async function demanderComplement(id) {
    if (!precisions.trim()) return
    setDecidingId(id)
    try {
      await api.post(`/dossiers/${id}/demander-complement`, { precisions: precisions.trim() })
      setComplementId(null)
      setPrecisions('')
      await load()
    } finally {
      setDecidingId(null)
    }
  }

  async function refuser(id) {
    setDecidingId(id)
    try {
      await api.post(`/dossiers/${id}/refuser`, motif.trim() ? { motif: motif.trim() } : {})
      setRefusingId(null)
      setMotif('')
      await load()
    } finally {
      setDecidingId(null)
    }
  }

  const counts = { tous: dossiers.length, nouveau: 0, 'en-cours': 0, termine: 0 }
  for (const d of dossiers) counts[GROUP_OF_STATUS[d.status] || 'en-cours']++
  const tabs = [
    { key: 'tous', label: `${t('specialiste.dashboard.tabAll')} (${counts.tous})` },
    { key: 'nouveau', label: `${t('specialiste.dashboard.tabNew')} (${counts.nouveau})` },
    { key: 'en-cours', label: `${t('specialiste.dashboard.tabInProgress')} (${counts['en-cours']})` },
    { key: 'termine', label: `${t('specialiste.dashboard.tabDone')} (${counts.termine})` },
  ]
  const visible = dossiers.filter((d) => activeTab === 'tous' || (GROUP_OF_STATUS[d.status] || 'en-cours') === activeTab)

  const STATUS_BADGE = {
    nouveau: { bg: 'bg-blue-50', fg: 'text-blue-700', border: 'border-blue-200', icon: ShieldAlert, label: t('specialiste.dashboard.badgeNew') },
    'en-cours': { bg: 'bg-amber-50', fg: 'text-amber-700', border: 'border-amber-200', icon: Circle, label: t('specialiste.dashboard.badgeInProgress') },
    termine: { bg: 'bg-emerald-50', fg: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle, label: t('specialiste.dashboard.badgeDone') },
  }

  return (
    <SpecialistShell>
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2">{t('specialiste.dashboard.title')}</h2>
        <p className="text-slate-500 dark:text-slate-400">{t('specialiste.dashboard.subtitle')}</p>
      </div>

      {showAvailabilityToggle && (
        <div className="mb-8 p-6 glass-card rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-white mb-1">{t('specialiste.dashboard.availabilityTitle')}</span>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              {t('specialiste.dashboard.availabilityText')}
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            {availabilityError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 max-w-xs sm:text-right">{availabilityError}</p>
            )}
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-neutral-800 p-2 pl-4 rounded-full border border-slate-200/60 dark:border-neutral-700">
              <span className={`text-sm font-semibold ${available ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
                {available ? t('specialiste.dashboard.available') : t('specialiste.dashboard.unavailable')}
              </span>
              <button
                aria-checked={available}
                role="switch"
                onClick={toggleAvailability}
                disabled={togglingAvailability}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none disabled:opacity-60 ${
                  available ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-neutral-600'
                }`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${available ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-4 mb-4 no-scrollbar animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
        <button className="px-4 py-2 rounded-full glass-card border-slate-200/60 dark:border-neutral-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shrink-0">
          <Filter className="w-5 h-5" />
        </button>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all ${
              activeTab === tab.key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' : 'bg-white dark:bg-neutral-800 border border-slate-200/60 dark:border-neutral-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4 mb-4">{error}</div>}
      {loading && <div className="glass-card rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400">{t('specialiste.dashboard.loading')}</div>}
      {!loading && !error && visible.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400">{t('specialiste.dashboard.empty')}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {visible.map((d, idx) => {
          const group = GROUP_OF_STATUS[d.status] || 'en-cours'
          const badge = STATUS_BADGE[group]
          const BadgeIcon = badge.icon
          const { Icon: SpecialiteIcon, color, bg } = specialiteVisual(d.specialiteRequise)
          const isNew = d.status === 'AFFECTE'
          const peutDemarrer = d.status === 'ACCEPTE_PAR_SPECIALISTE'
          const peutDemanderComplement = ['ACCEPTE_PAR_SPECIALISTE', 'EN_ANALYSE', 'RAPPORT_EN_PREPARATION'].includes(d.status)
          const attendComplement = d.status === 'INFORMATION_COMPLEMENTAIRE_DEMANDEE'

          return (
            <div
              key={d.id}
              className="glass-card dark:bg-neutral-900 rounded-3xl p-6 flex flex-col group hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-900/10 dark:hover:shadow-black/40 transition-all duration-300 animate-fade-in-up"
              style={{ animationDelay: `${0.2 + idx * 0.1}s` }}
            >
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${bg} ${color}`}>
                    <SpecialiteIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className={`font-bold ${color}`}>{d.specialiteRequise}</span>
                    <span className="text-xs font-semibold text-slate-400 block mt-0.5">#{d.reference}</span>
                  </div>
                </div>
                <span className={`${badge.bg} ${badge.fg} border ${badge.border} px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm`}>
                  <BadgeIcon className="w-3.5 h-3.5" />
                  {badge.label}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">{d.motif}</h3>
              {d.symptomes && <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed line-clamp-3 mb-6 flex-grow">{d.symptomes}</p>}

              {isNew ? (
                <div className="mt-auto pt-5 border-t border-slate-100/60 dark:border-neutral-800 flex flex-col gap-3">
                  {refusingId === d.id ? (
                    <>
                      <textarea
                        value={motif}
                        onChange={(e) => setMotif(e.target.value)}
                        placeholder={t('specialiste.dashboard.rejectPlaceholder')}
                        className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setRefusingId(null)} className="flex-1 text-sm font-semibold text-slate-500 dark:text-slate-400 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800">
                          {t('specialiste.dashboard.cancel')}
                        </button>
                        <button
                          onClick={() => refuser(d.id)}
                          disabled={decidingId === d.id}
                          className="flex-1 bg-rose-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-60"
                        >
                          {t('specialiste.dashboard.confirm')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setRefusingId(d.id)}
                        disabled={decidingId === d.id}
                        className="flex-1 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <X className="w-4 h-4" /> {t('specialiste.dashboard.refuse')}
                      </button>
                      <button
                        onClick={() => accepter(d.id)}
                        disabled={decidingId === d.id}
                        className="flex-1 bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                      >
                        <Check className="w-4 h-4" /> {decidingId === d.id ? '...' : t('specialiste.dashboard.accept')}
                      </button>
                    </div>
                  )}
                </div>
              ) : peutDemarrer || peutDemanderComplement || attendComplement ? (
                <div className="mt-auto pt-5 border-t border-slate-100/60 dark:border-neutral-800 flex flex-col gap-3">
                  {attendComplement && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 shrink-0" />
                      {t('specialiste.dashboard.awaitingComplement')}
                    </p>
                  )}
                  {complementId === d.id ? (
                    <>
                      <textarea
                        value={precisions}
                        onChange={(e) => setPrecisions(e.target.value)}
                        placeholder={t('specialiste.dashboard.complementPlaceholder')}
                        className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button onClick={() => { setComplementId(null); setPrecisions('') }} className="flex-1 text-sm font-semibold text-slate-500 dark:text-slate-400 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800">
                          {t('specialiste.dashboard.cancel')}
                        </button>
                        <button
                          onClick={() => demanderComplement(d.id)}
                          disabled={decidingId === d.id || !precisions.trim()}
                          className="flex-1 bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-60"
                        >
                          {t('specialiste.dashboard.confirm')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {peutDemarrer && (
                        <button
                          onClick={() => demarrerAnalyse(d.id)}
                          disabled={decidingId === d.id}
                          className="flex-1 min-w-[140px] bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <Play className="w-4 h-4" /> {t('specialiste.dashboard.startAnalysis')}
                        </button>
                      )}
                      {peutDemanderComplement && (
                        <button
                          onClick={() => setComplementId(d.id)}
                          disabled={decidingId === d.id}
                          className="flex-1 min-w-[140px] bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                        >
                          <HelpCircle className="w-4 h-4" /> {t('specialiste.dashboard.askComplement')}
                        </button>
                      )}
                      <Link
                        to={`/specialiste/redaction/${d.id}`}
                        className="flex-1 min-w-[140px] bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-1.5"
                      >
                        {t('specialiste.dashboard.openReport')}
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to={`/specialiste/redaction/${d.id}`}
                  className="flex justify-between items-center mt-auto pt-5 border-t border-slate-100/60 dark:border-neutral-800"
                >
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" /> {formatDate(d.createdAt, i18n.language)}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-slate-50 dark:bg-neutral-800 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/50 flex items-center justify-center transition-colors">
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
                  </div>
                </Link>
              )}
            </div>
          )
        })}
      </div>
    </SpecialistShell>
  )
}
