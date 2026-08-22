import { useTranslation } from 'react-i18next'

export default function RegistrationStepper({ current }) {
  const { t } = useTranslation()
  const STEPS = [
    { n: 1, label: t('auth.registrationStepper.infos') },
    { n: 2, label: t('auth.registrationStepper.security') },
    { n: 3, label: t('auth.registrationStepper.validation') },
  ]
  const progressPct = current === 1 ? 0 : current === 2 ? 50 : 100
  return (
    <div className="w-full flex items-center justify-between relative px-4 mb-stack-lg">
      <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[2px] bg-[var(--color-surface-container-high)] z-0" />
      <div
        className="absolute left-4 top-1/2 -translate-y-1/2 h-[2px] bg-[var(--color-primary)] z-0 transition-all duration-300"
        style={{ width: `calc(${progressPct}% - ${progressPct > 0 ? '2rem' : '0px'})` }}
      />
      {STEPS.map((step) => {
        const done = step.n < current
        const active = step.n === current
        return (
          <div key={step.n} className="relative z-10 flex flex-col items-center gap-2">
            <div
              className={
                done || active
                  ? 'w-8 h-8 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center font-label-md text-label-md shadow-sm'
                  : 'w-8 h-8 rounded-full bg-[var(--color-surface-container-highest)] text-[var(--color-outline)] flex items-center justify-center font-label-md text-label-md border border-[var(--color-outline-variant)]'
              }
            >
              {done ? (
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  check
                </span>
              ) : (
                step.n
              )}
            </div>
            <span
              className={`font-label-sm text-label-sm whitespace-nowrap ${
                active ? 'text-[var(--color-primary)] font-semibold' : done ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-secondary)]'
              }`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
