import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { ROLE_REDIRECTS } from '../../constants/roleRedirects'

export default function VerificationDeuxFacteurs() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const verifyTwoFactor = useAuthStore((s) => s.verifyTwoFactor)
  const error = useAuthStore((s) => s.error)
  const loading = useAuthStore((s) => s.loading)
  const [code, setCode] = useState('')

  const { challengeToken, role } = location.state || {}

  async function onSubmit(e) {
    e.preventDefault()
    if (!challengeToken) return
    const result = await verifyTwoFactor(challengeToken, code)
    if (result.ok) navigate(ROLE_REDIRECTS[role] || '/')
  }

  if (!challengeToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6 text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">{t('auth.twoFactor.expired')}</p>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen flex items-center justify-center font-body-md text-on-background p-margin-mobile">
      <main className="w-full max-w-md bg-surface rounded-xl shadow-md border border-outline-variant p-6 md:p-8">
        <div className="flex flex-col items-center text-center mb-stack-lg">
          <div className="h-12 w-12 rounded-full bg-primary-container text-primary flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              shield_person
            </span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">{t('auth.twoFactor.title')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('auth.twoFactor.subtitle')}</p>
        </div>

        <form className="space-y-stack-md" onSubmit={onSubmit}>
          {error && (
            <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2" htmlFor="code">
              {t('auth.twoFactor.codeLabel')}
            </label>
            <input
              className="block w-full text-center tracking-[0.5em] text-xl px-3 py-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-colors font-body-md h-14"
              id="code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </div>
          <button
            className="w-full flex justify-center items-center py-3 px-4 rounded-lg shadow-sm font-label-md text-label-md text-on-primary bg-primary hover:bg-primary-container transition-colors h-12 disabled:opacity-60"
            type="submit"
            disabled={loading || code.length !== 6}
          >
            {loading ? t('auth.twoFactor.submitting') : t('auth.twoFactor.submit')}
          </button>
        </form>
      </main>
    </div>
  )
}
