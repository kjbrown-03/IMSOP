import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'

export default function MotDePasseOublie() {
  const { t } = useTranslation()
  const forgotPassword = useAuthStore((s) => s.forgotPassword)
  const loading = useAuthStore((s) => s.loading)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    const result = await forgotPassword(email)
    if (result.ok) setSent(true)
  }

  return (
    <div className="bg-background min-h-screen flex items-center justify-center font-body-md text-on-background p-margin-mobile">
      <main className="w-full max-w-md bg-surface rounded-xl shadow-md border border-outline-variant p-6 md:p-8">
        <div className="flex flex-col items-center text-center mb-stack-lg">
          <div className="h-12 w-12 rounded-full bg-primary-container text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              lock_reset
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">{t('auth.forgotPassword.title')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('auth.forgotPassword.subtitle')}</p>
        </div>

        {sent ? (
          <div className="bg-secondary-container text-on-secondary-container text-body-md font-body-md rounded-lg px-4 py-3 text-center">
            {t('auth.forgotPassword.sent')}
          </div>
        ) : (
          <form className="space-y-stack-md" onSubmit={onSubmit}>
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="email">
                {t('common.email')}
              </label>
              <input
                className="block w-full px-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-colors font-body-md h-12"
                id="email"
                name="email"
                placeholder="votre.email@exemple.com"
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button
              className="group relative overflow-hidden w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm border border-[var(--color-primary)] bg-[var(--color-surface)] h-12 disabled:opacity-60 z-[1] transition-all duration-300 active:scale-[0.98]"
              type="submit"
              disabled={loading}
            >
              <div className="absolute inset-0 w-full h-full bg-[var(--color-primary)] scale-y-0 origin-bottom transition-transform duration-500 ease-in-out group-hover:scale-y-100 z-[-1]" />
              <span className="relative z-10 flex items-center justify-center font-label-md text-label-md text-[var(--color-primary)] transition-colors duration-500 ease-in-out group-hover:text-[var(--color-on-primary)]">
                {loading ? t('common.sending') : t('auth.forgotPassword.submit')}
              </span>
            </button>
          </form>
        )}

        <div className="mt-stack-lg text-center">
          <Link to="/connexion" className="font-label-sm text-label-sm text-primary hover:underline">
            {t('auth.forgotPassword.backToLogin')}
          </Link>
        </div>
      </main>
    </div>
  )
}
