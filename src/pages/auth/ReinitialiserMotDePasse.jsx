import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'

export default function ReinitialiserMotDePasse() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const resetPassword = useAuthStore((s) => s.resetPassword)
  const error = useAuthStore((s) => s.error)
  const loading = useAuthStore((s) => s.loading)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [done, setDone] = useState(false)

  const valid = useMemo(() => password.length >= 8 && password === confirmPassword, [password, confirmPassword])

  async function onSubmit(e) {
    e.preventDefault()
    if (!valid) return
    const result = await resetPassword(token, password)
    if (result.ok) setDone(true)
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">
          {t('auth.resetPassword.invalidLink')}
          <br />
          <Link to="/mot-de-passe-oublie" className="text-primary underline">
            {t('auth.resetPassword.requestNewLink')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen flex items-center justify-center font-body-md text-on-background p-margin-mobile">
      <main className="w-full max-w-md bg-surface rounded-xl shadow-md border border-outline-variant p-6 md:p-8">
        <div className="flex flex-col items-center text-center mb-stack-lg">
          <div className="h-12 w-12 rounded-full bg-primary-container text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              password
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">{t('auth.resetPassword.title')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('auth.resetPassword.subtitle')}</p>
        </div>

        {done ? (
          <div className="space-y-stack-md text-center">
            <div className="bg-secondary-container text-on-secondary-container text-body-md font-body-md rounded-lg px-4 py-3">
              {t('auth.resetPassword.success')}
            </div>
            <button
              className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm font-label-md text-label-md text-on-primary bg-primary hover:bg-primary-container transition-colors h-12"
              type="button"
              onClick={() => navigate('/connexion')}
            >
              {t('auth.resetPassword.goToLogin')}
            </button>
          </div>
        ) : (
          <form className="space-y-stack-md" onSubmit={onSubmit}>
            {error && (
              <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="password">
                {t('auth.resetPassword.newPassword')}
              </label>
              <input
                className="block w-full px-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-colors font-body-md h-12"
                id="password"
                minLength={8}
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="confirmPassword">
                {t('common.confirmPassword')}
              </label>
              <input
                className="block w-full px-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-colors font-body-md h-12"
                id="confirmPassword"
                minLength={8}
                required
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="font-label-sm text-label-sm text-error mt-1">{t('auth.resetPassword.mismatch')}</p>
              )}
            </div>
            <button
              className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm font-label-md text-label-md text-on-primary bg-primary hover:bg-primary-container transition-colors h-12 disabled:opacity-60"
              type="submit"
              disabled={loading || !valid}
            >
              {loading ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
