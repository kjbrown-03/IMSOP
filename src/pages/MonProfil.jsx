import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail, Phone, ShieldCheck, ShieldAlert } from 'lucide-react'
import AdminLayout from '../components/layout/AdminLayout'
import CoordinatorLayout from '../components/layout/CoordinatorLayout'
import SpecialistShell from '../components/layout/SpecialistShell'
import MedecinShell from '../components/layout/MedecinShell'
import PatientShell from '../components/layout/PatientShell'
import AvatarUploader from '../components/ui/AvatarUploader'
import ChangementMotDePasse from '../components/ui/ChangementMotDePasse'
import { useAuthStore } from '../store/useAuthStore'

// Chaque rôle a déjà sa propre coque (barre latérale, navigation, en-tête) :
// la page se contente de choisir la bonne, pour que « Mon profil » ne dépayse
// personne et reste accessible depuis la même navigation qu'ailleurs.
const SHELL_BY_ROLE = {
  ADMIN: AdminLayout,
  COORDINATEUR: CoordinatorLayout,
  SPECIALISTE: SpecialistShell,
  MEDECIN_LOCAL: MedecinShell,
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
        <InfoRow icon={Mail} label={t('profile.email')} value={user?.email || '—'} />
        <InfoRow
          icon={EmailIcon}
          label={t('profile.emailStatus')}
          value={user?.emailVerified ? t('profile.emailVerified') : t('profile.emailUnverified')}
        />
        <InfoRow
          icon={Phone}
          label={t('profile.phone')}
          value={user?.phone || t('profile.phoneEmpty')}
          muted={!user?.phone}
        />
      </section>

      <ChangementMotDePasse />
    </div>
  )

  // Un rôle inconnu (session d'une ancienne version, compte mal configuré) ne
  // doit pas faire écraser la page : on rend le contenu sans coque plutôt que
  // d'appeler `undefined` comme composant.
  if (!Shell) return content

  return <Shell title={t('profile.title')}>{content}</Shell>
}
