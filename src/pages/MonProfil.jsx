import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, Pencil, Phone, ShieldCheck, ShieldAlert } from 'lucide-react'
import AdminLayout from '../components/layout/AdminLayout'
import CoordinatorLayout from '../components/layout/CoordinatorLayout'
import SpecialistShell from '../components/layout/SpecialistShell'
import TradipraticienShell from '../components/layout/TradipraticienShell'
import MedecinShell from '../components/layout/MedecinShell'
import PatientShell from '../components/layout/PatientShell'
import AvatarUploader from '../components/ui/AvatarUploader'
import ChangementMotDePasse from '../components/ui/ChangementMotDePasse'
import ChangementEmail from '../components/ui/ChangementEmail'
import { useAuthStore } from '../store/useAuthStore'
import ReglageNotifications from '../components/ui/ReglageNotifications'
import { api } from '../lib/api'

// Chaque rôle a déjà sa propre coque (barre latérale, navigation, en-tête) :
// la page se contente de choisir la bonne, pour que « Mon profil » ne dépayse
// personne et reste accessible depuis la même navigation qu'ailleurs.
const SHELL_BY_ROLE = {
  ADMIN: AdminLayout,
  COORDINATEUR: CoordinatorLayout,
  SPECIALISTE: SpecialistShell,
  MEDECIN_LOCAL: MedecinShell,
  TRADIPRATICIEN: TradipraticienShell,
  PATIENT: PatientShell,
}

function InfoRow({ icon: Icon, label, value, muted }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <span className="p-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400 shrink-0">
        <Icon className="w-5 h-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className={`truncate ${muted ? 'text-slate-400 dark:text-slate-500 italic' : 'text-slate-900 dark:text-white font-medium'}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

// Le tradipraticien tient lui-même son numéro à jour : c'est par lui qu'un
// patient le joint après avoir payé la mise en relation. Les autres rôles n'ont
// pas cette route côté serveur, le champ reste donc en lecture pour eux.
function TelephoneModifiable({ phone, onChange }) {
  const { t } = useTranslation()
  const [edition, setEdition] = useState(false)
  const [valeur, setValeur] = useState(phone || '')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [fait, setFait] = useState(false)

  async function enregistrer(e) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await api.patch('/users/me/telephone', { phone: valeur.trim() })
      await onChange()
      setEdition(false)
      setFait(true)
    } catch (err) {
      setErreur(err.response?.data?.message || t('profile.phoneError'))
    } finally {
      setEnvoi(false)
    }
  }

  if (!edition) {
    return (
      <div className="flex items-center gap-4 py-4">
        <span className="p-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400 shrink-0">
          <Phone className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('profile.phone')}</p>
          <p className={`truncate ${phone ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500 italic'}`}>
            {phone || t('profile.phoneEmpty')}
          </p>
          {fait && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('profile.phoneSaved')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setValeur(phone || ''); setEdition(true); setFait(false) }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline shrink-0"
        >
          <Pencil className="w-4 h-4" /> {t('profile.phoneEdit')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={enregistrer} className="flex flex-col gap-2 py-4">
      <label htmlFor="telephone" className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('profile.phone')}</label>
      <input
        id="telephone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        maxLength={30}
        placeholder="+237 6 99 12 34 56"
        className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
      />
      {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}
      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={envoi || valeur.trim().length < 8}
          className="inline-flex items-center gap-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 text-sm font-bold disabled:opacity-50"
        >
          {envoi && <Loader2 className="w-4 h-4 animate-spin" />} {t('common.save')}
        </button>
        <button type="button" onClick={() => { setEdition(false); setErreur(null) }} className="text-sm text-slate-500 hover:underline">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

export default function MonProfil() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const refreshMe = useAuthStore((s) => s.refreshMe)

  // La photo affichée doit être celle du compte réellement connecté, jamais
  // celle laissée en cache par une session précédente.
  useEffect(() => {
    refreshMe()
  }, [refreshMe])

  const Shell = SHELL_BY_ROLE[user?.role]
  const EmailIcon = user?.emailVerified ? ShieldCheck : ShieldAlert

  const content = (
    <div className="p-4 md:p-8 flex flex-col gap-6 max-w-3xl w-full mx-auto">
      <section className="flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 md:p-8 shadow-sm">
        <AvatarUploader size={128} />

        <div className="flex flex-col items-center md:items-start text-center md:text-left min-w-0">
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900 dark:text-white truncate max-w-full">
            {user?.fullName || t('profile.unnamed')}
          </h1>
          <span className="mt-2 font-bold text-[10px] uppercase tracking-wider text-[var(--color-primary)] bg-[var(--color-surface-container-high)] px-3 py-1 rounded-full">
            {t(`profile.roles.${user?.role}`, { defaultValue: user?.role || '' })}
          </span>
        </div>
      </section>

      <section className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl px-6 shadow-sm divide-y divide-slate-100 dark:divide-neutral-800">
        <ChangementEmail user={user} onChange={refreshMe} />
        {/* Sans adresse, « non vérifiée » ne veut rien dire : la ligne au-dessus
            dit déjà qu'il n'y en a pas. */}
        {!user?.sansEmail && (
          <InfoRow
            icon={EmailIcon}
            label={t('profile.emailStatus')}
            value={user?.emailVerified ? t('profile.emailVerified') : t('profile.emailUnverified')}
          />
        )}
        {user?.role === 'TRADIPRATICIEN' ? (
          <TelephoneModifiable phone={user?.phone} onChange={refreshMe} />
        ) : (
          <InfoRow
            icon={Phone}
            label={t('profile.phone')}
            value={user?.phone || t('profile.phoneEmpty')}
            muted={!user?.phone}
          />
        )}
      </section>

      <ReglageNotifications />

      <ChangementMotDePasse />
    </div>
  )

  // Un rôle inconnu (session d'une ancienne version, compte mal configuré) ne
  // doit pas faire écraser la page : on rend le contenu sans coque plutôt que
  // d'appeler `undefined` comme composant.
  if (!Shell) return content

  return <Shell title={t('profile.title')}>{content}</Shell>
}
