import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

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
      to: '/connexion/coordinateur',
      icon: 'health_and_safety',
      title: t('auth.roleSelection.coordinatorTitle'),
      description: t('auth.roleSelection.coordinatorDesc'),
    },
  ]

  return (
    <div className="bg-[var(--color-bg)] min-h-screen flex items-center justify-center font-body-md text-[var(--color-text-main)] p-margin-mobile transition-colors duration-300">
      <main className="w-full max-w-2xl">
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
              className="flex flex-col items-center text-center gap-3 p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-md transition-all group"
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
