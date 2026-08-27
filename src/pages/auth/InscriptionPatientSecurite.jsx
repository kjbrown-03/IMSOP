import { useMemo } from 'react'
import ChampMotDePasse from '../../components/ui/ChampMotDePasse'
import { useNavigate } from 'react-router-dom'
import { Trans, useTranslation } from 'react-i18next'
import RegistrationStepper from '../../components/auth/RegistrationStepper'
import { useRegistrationStore } from '../../store/useRegistrationStore'

export default function InscriptionPatientSecurite() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { password, confirmPassword, twoFactorLater, setField } = useRegistrationStore()

  const checks = useMemo(
    () => ({
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      digitOrSpecial: /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  )

  function onNext(e) {
    e.preventDefault()
    if (password !== confirmPassword) return
    navigate('/inscription/validation')
  }

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] min-h-screen flex flex-col md:flex-row font-body-md transition-colors duration-300">
      <div className="hidden md:flex md:w-1/2 bg-[var(--color-surface)] relative flex-col justify-between p-12 border-r border-[var(--color-border)]">
        <div className="z-10">
          <h1 className="font-headline-lg text-headline-lg text-[var(--color-primary)] mb-4">IMSOP</h1>
          <p className="font-body-lg text-body-lg text-[var(--color-text-secondary)] max-w-md">
            {t('auth.registerSecurity.sideTagline')}
          </p>
        </div>
        <div className="z-10 absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-tr from-[var(--color-primary)]/10 to-transparent dark:from-[var(--color-primary)]/5" />
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary-fixed rounded-full mix-blend-multiply filter blur-3xl opacity-50 dark:opacity-20" />
          <div className="absolute top-1/3 right-1/4 w-72 h-72 bg-tertiary-fixed rounded-full mix-blend-multiply filter blur-3xl opacity-50 dark:opacity-20" />
        </div>
        <div className="z-10 mt-auto">
          <div className="flex items-center gap-4 bg-[var(--color-bg)] p-6 rounded-xl border border-[var(--color-border)] shadow-sm max-w-sm">
            <span className="material-symbols-outlined text-[var(--color-secondary)] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified_user
            </span>
            <div>
              <h3 className="font-label-md text-label-md text-[var(--color-text-main)]">{t('auth.registerSecurity.sideCardTitle')}</h3>
              <p className="font-label-sm text-label-sm text-[var(--color-text-secondary)] mt-1">
                {t('auth.registerSecurity.sideCardText')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex flex-col min-h-screen overflow-y-auto">
        <header className="md:hidden flex justify-between items-center px-margin-mobile h-12 w-full bg-[var(--color-surface)] z-50 border-b border-[var(--color-border)]">
          <div className="font-headline-md text-headline-md font-bold text-[var(--color-primary)]">IMSOP</div>
        </header>
        <main className="flex-grow flex flex-col items-center justify-center p-margin-mobile md:p-12">
          <div className="w-full max-w-md">
            <RegistrationStepper current={2} />

            <div className="mt-8 mb-stack-md text-center md:text-left">
              <h2 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-heading)] mb-2">
                {t('auth.registerSecurity.title')}
              </h2>
              <p className="font-body-md text-body-md text-[var(--color-text-secondary)]">
                {t('auth.registerSecurity.subtitle')}
              </p>
            </div>

            <form className="space-y-stack-md w-full mt-8" onSubmit={onNext}>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="password">
                  {t('auth.registerSecurity.password')}
                </label>
                <ChampMotDePasse
                  className="w-full h-12 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg font-body-md text-body-md text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setField('password', e.target.value)}
                />
                <ul className="mt-2 space-y-1">
                  <li
                    className={`flex items-center gap-2 font-label-sm text-label-sm ${
                      checks.length ? 'text-[var(--color-secondary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={checks.length ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {checks.length ? 'check_circle' : 'radio_button_unchecked'}
                    </span>{' '}
                    {t('auth.registerSecurity.checkLength')}
                  </li>
                  <li
                    className={`flex items-center gap-2 font-label-sm text-label-sm ${
                      checks.upper ? 'text-[var(--color-secondary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={checks.upper ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {checks.upper ? 'check_circle' : 'radio_button_unchecked'}
                    </span>{' '}
                    {t('auth.registerSecurity.checkUpper')}
                  </li>
                  <li
                    className={`flex items-center gap-2 font-label-sm text-label-sm ${
                      checks.digitOrSpecial ? 'text-[var(--color-secondary)]' : 'text-[var(--color-text-secondary)]'
                    }`}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={checks.digitOrSpecial ? { fontVariationSettings: "'FILL' 1" } : undefined}
                    >
                      {checks.digitOrSpecial ? 'check_circle' : 'radio_button_unchecked'}
                    </span>{' '}
                    {t('auth.registerSecurity.checkDigit')}
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <label className="font-label-md text-label-md text-[var(--color-text-main)]" htmlFor="confirm_password">
                  {t('auth.registerSecurity.confirmPassword')}
                </label>
                <ChampMotDePasse
                  className="w-full h-12 px-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg font-body-md text-body-md text-[var(--color-text-main)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent transition-colors placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  id="confirm_password"
                  name="confirm_password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                />
                {confirmPassword && confirmPassword !== password && (
                  <p className="font-label-sm text-label-sm text-rose-500">{t('auth.registerSecurity.mismatch')}</p>
                )}
              </div>

              <div className="mt-stack-lg p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl flex items-start gap-4">
                <div className="mt-1">
                  <span className="material-symbols-outlined text-[var(--color-primary)] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    shield_person
                  </span>
                </div>
                <div className="flex-grow">
                  <h4 className="font-label-md text-label-md text-[var(--color-text-main)]">
                    {t('auth.registerSecurity.twoFaTitle')}
                  </h4>
                  <p className="font-body-md text-label-sm text-[var(--color-text-secondary)] mt-1 mb-3">
                    {t('auth.registerSecurity.twoFaText')}
                  </p>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      className="w-5 h-5 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] bg-[var(--color-bg)]"
                      type="checkbox"
                      checked={twoFactorLater}
                      onChange={(e) => setField('twoFactorLater', e.target.checked)}
                    />
                    <span className="font-body-md text-body-md text-[var(--color-text-main)]">{t('auth.registerSecurity.twoFaLater')}</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-4 pt-stack-lg">
                <button
                  className="group relative overflow-hidden w-1/3 h-12 flex items-center justify-center bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full z-[1] transition-all duration-300 active:scale-[0.98]"
                  type="button"
                  onClick={() => navigate('/inscription')}
                >
                  <div className="absolute inset-0 w-full h-full bg-[var(--color-bg)] scale-y-0 origin-bottom transition-transform duration-500 ease-in-out group-hover:scale-y-100 z-[-1]" />
                  <span className="relative z-10 flex items-center justify-center font-label-md text-label-md text-[var(--color-text-main)] transition-colors duration-500 ease-in-out">
                    {t('auth.registerSecurity.back')}
                  </span>
                </button>
                <button
                  className="group relative overflow-hidden w-2/3 h-12 flex items-center justify-center bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-full shadow-sm z-[1] transition-all duration-300 active:scale-[0.98]"
                  type="submit"
                >
                  <div className="absolute inset-0 w-full h-full bg-[var(--color-primary)] scale-y-0 origin-bottom transition-transform duration-500 ease-in-out group-hover:scale-y-100 z-[-1]" />
                  <span className="relative z-10 flex items-center justify-center font-label-md text-label-md text-[var(--color-primary)] transition-colors duration-500 ease-in-out group-hover:text-[var(--color-on-primary)]">
                    {t('auth.registerSecurity.next')} <span className="material-symbols-outlined ml-2 text-sm">arrow_forward</span>
                  </span>
                </button>
              </div>

              <p className="text-center font-label-sm text-label-sm text-[var(--color-text-secondary)] mt-stack-md">
                <Trans
                  i18nKey="auth.registerSecurity.legal"
                  components={{
                    cgu: <a className="text-[var(--color-primary)] underline" href="#" />,
                    privacy: <a className="text-[var(--color-primary)] underline" href="#" />,
                  }}
                />
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
