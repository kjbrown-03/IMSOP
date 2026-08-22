import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PatientShell from '../../components/layout/PatientShell'
import { useAuthStore } from '../../store/useAuthStore'
import { useLanguageStore } from '../../store/useLanguageStore'
import {
  User, Phone, Mail, Calendar, FileText, Settings, Shield, Bell, Globe, ChevronRight, LogOut, Edit2,
  ShieldCheck, ShieldAlert, ShieldQuestion, UploadCloud, Loader2,
} from 'lucide-react'

const AVATAR =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCoaSuIidDTjWtdTFJd0KrP9XPr3mg1gOpIiFkj0985V-rIxmsgdPPv84IY9kdSbwb7dT3vdpgHjEYOtZv--BnGxnfcoFUcD6X-zIN2ljixr4UWCxoGmfYY6qORhOJLruxxe64Jcf9_G-E2M-PvPgvNikBh3VUCgS2NFRtu7rSGE9KJygLC1ibHIM_N4gsqjHmTa1n18z1bXkYNPsMWRF9M1Y9PHznOY5GJHgflzxgNAuDO8VP19ED3'

export default function ProfilPatient() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const uploadIdentityDocument = useAuthStore((s) => s.uploadIdentityDocument)
  const loading = useAuthStore((s) => s.loading)
  const lang = useLanguageStore((s) => s.lang)
  const toggleLang = useLanguageStore((s) => s.toggleLang)
  const fileInputRef = useRef(null)
  const [uploadError, setUploadError] = useState(null)

  const IDENTITY_STATUS = {
    verified: { icon: ShieldCheck, bg: 'bg-emerald-50', color: 'text-emerald-600', label: t('patient.profile.identityVerified') },
    rejected: { icon: ShieldAlert, bg: 'bg-rose-50', color: 'text-rose-600', label: t('patient.profile.identityRejected') },
    pending: { icon: ShieldQuestion, bg: 'bg-amber-50', color: 'text-amber-600', label: t('patient.profile.identityPending') },
    none: { icon: Shield, bg: 'bg-slate-100', color: 'text-slate-500', label: t('patient.profile.identityNone') },
  }

  const identityKey = user?.identityVerified
    ? 'verified'
    : user?.identityRejectedReason
      ? 'rejected'
      : user?.identityDocumentSubmitted
        ? 'pending'
        : 'none'
  const identity = IDENTITY_STATUS[identityKey]
  const IdentityIcon = identity.icon

  async function onFileSelected(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    const result = await uploadIdentityDocument(file)
    if (!result.ok) setUploadError(result.error)
    e.target.value = ''
  }

  function onLogout() {
    logout()
    navigate('/connexion/patient')
  }

  const settingsItems = [
    { icon: Globe, label: t('patient.profile.language'), value: lang === 'fr' ? t('patient.profile.languageFr') : t('patient.profile.languageEn'), color: 'text-blue-600', bg: 'bg-blue-50', onClick: toggleLang },
    { icon: Bell, label: t('patient.profile.notifications'), value: t('patient.profile.notificationsValue'), color: 'text-amber-600', bg: 'bg-amber-50' },
    { icon: Shield, label: t('patient.profile.security'), value: t('patient.profile.securityValue'), color: 'text-rose-600', bg: 'bg-rose-50' },
  ]

  return (
    <PatientShell title={t('patient.profile.title')}>
      <section className="flex flex-col md:flex-row items-center md:items-start gap-6 glass-card dark:bg-neutral-900 p-6 md:p-8 rounded-3xl animate-fade-in-up shadow-sm">
        <div className="relative w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 border-white dark:border-neutral-800 shadow-lg flex-shrink-0 group">
          <img className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" src={user?.avatarUrl || AVATAR} alt="Photo de profil" />
          <button className="absolute bottom-2 right-2 bg-primary-600 text-white p-2 rounded-full shadow-md hover:bg-primary-700 transition-colors z-10">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col items-center md:items-start text-center md:text-left pt-2">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white">
            {user?.fullName || t('patient.profile.defaultName')}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-bold text-[10px] uppercase tracking-wider text-primary-700 dark:text-primary-400 bg-primary-100 dark:bg-primary-900/30 px-3 py-1 rounded-full shadow-sm border border-transparent dark:border-primary-800/50">
              {t('patient.profile.roleBadge')}
            </span>
            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-neutral-800 px-3 py-1 rounded-full border border-slate-200 dark:border-neutral-700">
              #{user?.patientRef || 'IMS-2026-0000'}
            </span>
          </div>
        </div>
      </section>

      <section className="glass-card dark:bg-neutral-900 rounded-3xl p-6 shadow-sm animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2.5 rounded-xl ${identity.bg} ${identity.color} dark:bg-opacity-20`}>
            <IdentityIcon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('patient.profile.identityTitle')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{identity.label}</p>
          </div>
        </div>

        {user?.identityRejectedReason && (
          <div className="mb-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm rounded-xl p-3">
            {t('patient.profile.rejectedReason')} : {user.identityRejectedReason}
          </div>
        )}
        {uploadError && (
          <div className="mb-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm rounded-xl p-3">{uploadError}</div>
        )}

        {!user?.identityVerified && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="hidden"
              onChange={onFileSelected}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-md shadow-slate-900/10 dark:shadow-white/10 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {user?.identityDocumentSubmitted ? t('patient.profile.uploadNew') : t('patient.profile.uploadFirst')}
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{t('patient.profile.uploadHint')}</p>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
        {/* Informations */}
        <section className="glass-card dark:bg-neutral-900 rounded-3xl p-6 shadow-sm flex flex-col h-full animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <User className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('patient.profile.infoTitle')}</h2>
          </div>

          <div className="flex flex-col gap-6">
            <div className="group">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4" /> {t('patient.profile.email')}
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-transparent group-hover:border-slate-200 dark:group-hover:border-neutral-700 transition-colors">
                {user?.email || 'patient@exemple.com'}
                <button className="text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="group">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                <Phone className="w-4 h-4" /> {t('patient.profile.phone')}
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-between p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl border border-transparent group-hover:border-slate-200 dark:group-hover:border-neutral-700 transition-colors">
                {user?.phone || '+237 6 00 00 00 00'}
                <button className="text-slate-400 dark:text-slate-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"><Edit2 className="w-4 h-4" /></button>
              </div>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4" /> {t('patient.profile.dob')}
              </span>
              <div className="text-sm font-semibold text-slate-900 dark:text-white p-3 bg-slate-50 dark:bg-neutral-800 rounded-xl">
                {user?.dob || '—'}
              </div>
            </div>
          </div>
        </section>

        {/* Documents */}
        <section className="glass-card dark:bg-neutral-900 rounded-3xl p-6 shadow-sm flex flex-col h-full animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('patient.profile.documentsTitle')}</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            {t('patient.profile.documentsText')}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6 flex-grow">
            <div className="bg-emerald-50/50 dark:bg-emerald-900/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-emerald-100/50 dark:border-emerald-800/30 group cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors">
              <div className="bg-white dark:bg-neutral-800 p-3 rounded-xl shadow-sm mb-3 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">3 {t('patient.profile.analyses')}</span>
            </div>
            <div className="bg-blue-50/50 dark:bg-blue-900/20 rounded-2xl p-4 flex flex-col items-center justify-center text-center border border-blue-100/50 dark:border-blue-800/30 group cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/40 transition-colors">
              <div className="bg-white dark:bg-neutral-800 p-3 rounded-xl shadow-sm mb-3 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                <FileText className="w-6 h-6" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white">2 {t('patient.profile.prescriptions')}</span>
            </div>
          </div>

          <Link
            to="/patient/dossiers"
            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors shadow-md shadow-slate-900/10"
          >
            <FileText className="w-4 h-4" />
            {t('patient.profile.viewCases')}
          </Link>
        </section>

        {/* Paramètres */}
        <section className="glass-card dark:bg-neutral-900 rounded-3xl p-6 shadow-sm flex flex-col h-full animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-300 rounded-xl">
              <Settings className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('patient.profile.settingsTitle')}</h2>
          </div>

          <div className="flex flex-col gap-3 flex-grow">
            {settingsItems.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                disabled={!item.onClick}
                className="flex items-center justify-between p-4 bg-white/50 dark:bg-neutral-800/50 rounded-2xl hover:bg-white dark:hover:bg-neutral-800 transition-colors cursor-pointer border border-transparent hover:border-slate-200/60 dark:hover:border-neutral-700 shadow-sm hover:shadow-md text-left disabled:cursor-default"
              >
                <div className="flex items-center gap-4">
                  <div className={`${item.bg} ${item.color} dark:bg-opacity-20 p-2.5 rounded-xl`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white block">{item.label}</span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{item.value}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </button>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100/60 dark:border-neutral-800">
            <button
              onClick={onLogout}
              className="w-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              {t('patient.profile.logout')}
            </button>
          </div>
        </section>
      </div>
    </PatientShell>
  )
}
