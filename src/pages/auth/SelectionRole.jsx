import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// Motif de croix médicales répété en filigrane : c'est le signe le plus
// immédiatement « hospitalier », sans photo à charger ni licence à gérer.
const CROIX = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 56 56'><path d='M25 16h6v9h9v6h-9v9h-6v-9h-9v-6h9z' fill='#163A52'/></svg>"
)

export default function SelectionRole() {
  const { t } = useTranslation()

  const ROLES = [
    {
      to: '/connexion/patient',
      icon: 'personal_injury',
      title: t('auth.roleSelection.patientTitle'),
      description: t('auth.roleSelection.patientDesc'),
    },
    {
      to: '/connexion/specialiste',
      icon: 'medical_services',
      title: t('auth.roleSelection.specialistTitle'),
      description: t('auth.roleSelection.specialistDesc'),
    },
    {
      to: '/connexion/medecin',
      icon: 'stethoscope',
      title: t('auth.roleSelection.localDoctorTitle'),
      description: t('auth.roleSelection.localDoctorDesc'),
    },
    {
      to: '/connexion/coordinateur',
      icon: 'health_and_safety',
      title: t('auth.roleSelection.coordinatorTitle'),
      description: t('auth.roleSelection.coordinatorDesc'),
    },
  ]

  return (
    <div className="relative isolate overflow-hidden min-h-screen flex items-center justify-center font-body-md text-[var(--color-text-main)] p-margin-mobile transition-colors duration-300 bg-gradient-to-br from-[#EAF3F8] via-[#F7FBFD] to-[#DDEBF2] dark:from-[#0A1820] dark:via-[#0E2230] dark:to-[#0C2A3A]">
      {/* ---- Fond hospitalier : filigrane de croix, halos, tracé ECG ---- */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.07] dark:opacity-[0.06] dark:invert"
        style={{ backgroundImage: `url("data:image/svg+xml,${CROIX}")` }}
      />
      <div aria-hidden="true" className="absolute -top-32 -left-32 -z-10 w-[520px] h-[520px] rounded-full bg-[#8FC4BA]/35 dark:bg-[#8FC4BA]/10 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 -right-24 -z-10 w-[560px] h-[560px] rounded-full bg-[#163A52]/15 dark:bg-[#3E8C81]/15 blur-3xl" />
      <svg
        aria-hidden="true"
        className="absolute left-0 right-0 bottom-10 -z-10 w-full h-24 text-[#3E8C81] dark:text-[#8FC4BA] opacity-30 dark:opacity-25"
        viewBox="0 0 1200 100"
        preserveAspectRatio="none"
        fill="none"
      >
        <path
          d="M0 60 H260 l18 0 12-34 14 62 14-52 12 24 h30 l10-14 14 14 h420 l14-22 12 44 12-50 14 28 h340"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>

      <main className="relative w-full max-w-2xl">
        {/* Meme raison que sur les pages de connexion : cet ecran est une
            entree possible dans le site, il doit ramener a l'accueil. */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 mb-stack-lg text-body-md font-body-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          {t('common.backHome')}
        </Link>

        <div className="text-center mb-stack-lg flex flex-col items-center">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-heading)] tracking-tight mb-2">
            IMSOP
          </h1>
          <p className="font-body-md text-body-md text-[var(--color-text-secondary)]">
            {t('auth.roleSelection.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ROLES.map((role) => (
            <Link
              key={role.to}
              to={role.to}
              className="flex flex-col items-center text-center gap-3 p-6 bg-white/85 dark:bg-[#12222E]/85 backdrop-blur-sm border border-[var(--color-border)] rounded-xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-lg hover:-translate-y-0.5 transition-all group"
            >
              <div className="h-14 w-14 rounded-full bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)] transition-colors">
                <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {role.icon}
                </span>
              </div>
              <h2 className="font-headline-md text-headline-md text-[var(--color-text-primary)]">{role.title}</h2>
              <p className="font-body-md text-body-md text-[var(--color-text-secondary)]">{role.description}</p>
            </Link>
          ))}
        </div>

        <div className="mt-stack-lg text-center">
          <p className="font-body-md text-body-md text-[var(--color-text-secondary)]">
            {t('auth.roleSelection.newPatient')}{' '}
            <Link to="/inscription" className="text-[var(--color-primary)] font-label-md text-label-md hover:underline">
              {t('common.newAccount')}
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
