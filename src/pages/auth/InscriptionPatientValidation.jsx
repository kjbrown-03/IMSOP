import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRegistrationStore } from '../../store/useRegistrationStore'
import { useAuthStore } from '../../store/useAuthStore'

export default function InscriptionPatientValidation() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const data = useRegistrationStore()
  const register = useAuthStore((s) => s.register)
  const authError = useAuthStore((s) => s.error)
  const loading = useAuthStore((s) => s.loading)
  const [consent, setConsent] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    if (!consent) return
    const result = await register({
      fullName: data.fullName,
      email: data.email,
      dob: data.dob,
      gender: data.gender,
      phone: data.phone,
      nationality: data.nationality,
      country: data.country,
      city: data.city,
      preferredLanguage: data.preferredLanguage,
      emergencyContactName: data.emergencyContactName || undefined,
      emergencyContactPhone: data.emergencyContactPhone || undefined,
      password: data.password,
      twoFactorLater: data.twoFactorLater,
      consentDataProcessing: true,
    })
    if (result.ok) {
      data.reset()
      navigate('/verifier-email')
    }
  }

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] font-body-md min-h-screen flex flex-col transition-colors duration-300">
      <header className="bg-[var(--color-surface)] border-b border-[var(--color-border)] h-12 flex items-center px-margin-mobile flex-shrink-0">
        <button
          aria-label={t('common.back')}
          className="text-[var(--color-primary)] active:opacity-80 transition-opacity p-2 -ml-2"
          onClick={() => navigate('/inscription/securite')}
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-headline-md text-headline-md text-[var(--color-primary)] font-bold tracking-tight">IMSOP</h1>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 flex flex-col px-margin-mobile py-stack-lg max-w-[1200px] mx-auto w-full md:px-margin-desktop">
        <div className="mb-stack-lg w-full flex items-center justify-between relative px-4">
          <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-[2px] bg-[var(--color-primary)] z-0" />
          {[1, 2, 3].map((n) => (
            <div key={n} className="relative z-10 flex flex-col items-center gap-2">
              <div
                className={
                  n < 3
                    ? 'w-8 h-8 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center font-label-md text-label-md'
                    : 'w-8 h-8 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center font-label-md text-label-md border-2 border-[var(--color-primary)] shadow-[0_0_0_4px_rgba(0,63,135,0.1)]'
                }
              >
                {n < 3 ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  3
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mb-stack-lg">
          <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-[var(--color-heading)] mb-2">
            {t('auth.registerValidation.title')}
          </h2>
          <p className="text-[var(--color-text-secondary)] font-body-md text-body-md">
            {t('auth.registerValidation.subtitle')}
          </p>
        </div>

        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 md:p-6 mb-stack-lg shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-3xl icon-fill text-[var(--color-primary)]">check_circle</span>
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md text-[var(--color-text-main)]">{t('auth.registerValidation.completeTitle')}</h3>
              <p className="font-body-md text-body-md text-[var(--color-text-secondary)]">
                {t('auth.registerValidation.completeText')}
              </p>
            </div>
          </div>
          <div className="border-t border-[var(--color-border)] pt-4 mt-2">
            <h4 className="font-label-md text-label-md text-[var(--color-text-main)] mb-3 uppercase tracking-wider text-xs">
              {t('auth.registerValidation.summaryTitle')}
            </h4>
            <ul className="space-y-3">
              <li className="flex justify-between items-center">
                <span className="font-body-md text-body-md text-[var(--color-text-secondary)]">
                  {data.fullName || t('auth.registerValidation.summaryIdentity')}
                </span>
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-sm">verified</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="font-body-md text-body-md text-[var(--color-text-secondary)]">
                  {data.phone || data.email || t('auth.registerValidation.summaryContacts')}
                </span>
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-sm">verified</span>
              </li>
              <li className="flex justify-between items-center">
                <span className="font-body-md text-body-md text-[var(--color-text-secondary)]">
                  {t('auth.registerValidation.summarySecurity')}
                </span>
                <span className="material-symbols-outlined text-[var(--color-secondary)] text-sm">verified</span>
              </li>
            </ul>
          </div>
        </div>

        <form className="flex-1 flex flex-col" onSubmit={onSubmit}>
          <div className="flex-1">
            {authError && (
              <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-label-sm font-label-sm rounded-lg px-3 py-2 mb-4">
                {authError}
              </div>
            )}
            <div className="bg-[var(--color-bg)] rounded-lg p-4 border border-[var(--color-border)] mb-6">
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="relative flex items-center pt-1">
                  <input
                    className="peer h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] focus:ring-offset-[var(--color-bg)] transition-all"
                    required
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                </div>
                <div className="flex-1">
                  <span className="block font-label-md text-label-md text-[var(--color-text-main)] mb-1 group-hover:text-[var(--color-primary)] transition-colors">
                    {t('auth.registerValidation.consentTitle')}
                  </span>
                  <span className="block font-body-md text-body-md text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    {t('auth.registerValidation.consentText')}
                  </span>
                </div>
              </label>
            </div>
          </div>
          <div className="mt-auto pt-stack-lg pb-margin-mobile">
            <button
              className="w-full bg-[var(--color-primary)] hover:bg-opacity-90 text-[var(--color-on-primary)] font-label-md text-label-md py-4 px-6 rounded-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all min-h-[48px] shadow-sm disabled:opacity-60"
              type="submit"
              disabled={!consent || loading}
            >
              {loading ? t('auth.registerValidation.submitting') : t('auth.registerValidation.submit')}
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
