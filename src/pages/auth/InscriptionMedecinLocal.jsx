import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Stethoscope, ShieldCheck } from 'lucide-react'
import AuthLayout from '../../components/layout/AuthLayout'
import ChampMotDePasse from '../../components/ui/ChampMotDePasse'
import { useAuthStore } from '../../store/useAuthStore'

const FIELDS = [
  { name: 'fullName', type: 'text', required: true, autoComplete: 'name' },
  { name: 'email', type: 'email', required: true, autoComplete: 'email' },
  { name: 'password', type: 'password', required: true, autoComplete: 'new-password', minLength: 8 },
  { name: 'phone', type: 'tel', autoComplete: 'tel' },
  { name: 'specialite', type: 'text' },
  { name: 'etablissement', type: 'text' },
  { name: 'pays', type: 'text' },
  { name: 'numeroOrdre', type: 'text' },
]

export default function InscriptionMedecinLocal() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const registerMedecinLocal = useAuthStore((s) => s.registerMedecinLocal)
  const loading = useAuthStore((s) => s.loading)
  const error = useAuthStore((s) => s.error)
  const [form, setForm] = useState(
    Object.fromEntries(FIELDS.map((f) => [f.name, ''])),
  )

  function update(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    // The API rejects unknown *and* empty optional strings, so blanks are dropped
    // rather than sent as "".
    const payload = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== ''),
    )
    const result = await registerMedecinLocal(payload)
    // 2FA is mandatory for this role: the session only exists once the code is
    // validated, so the account passes through the code screen before e-mail
    // verification, which needs to be authenticated.
    if (result.twoFactorRequired) {
      navigate('/verification-2fa', { state: { challengeToken: result.challengeToken, role: 'MEDECIN_LOCAL' } })
      return
    }
    if (result.ok) navigate('/verifier-email')
  }

  return (
    <AuthLayout
      heading={t('medecin.register.title')}
      tagline={t('medecin.register.subtitle')}
      bgImage="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80"
      badges={
        <>
          <span className="flex flex-col items-center gap-1 text-on-surface-variant">
            <Stethoscope className="w-6 h-6 text-primary" />
          </span>
          <span className="flex flex-col items-center gap-1 text-on-surface-variant">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </span>
        </>
      }
    >
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-primary mb-2">
        {t('medecin.register.title')}
      </h1>
      <p className="font-body-md text-body-md text-on-surface-variant mb-6">
        {t('medecin.register.subtitle')}
      </p>

      {error && (
        <div className="bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-3 py-2 mb-4">
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {FIELDS.map((field) => (
          <label key={field.name} className="flex flex-col gap-1.5">
            <span className="font-label-md text-label-md text-on-surface">
              {t(`medecin.register.${field.name}`)}
              {field.required && <span className="text-error"> *</span>}
            </span>
            {/* Le composant impose lui-même type="password" et porte la bascule. */}
            {field.type === 'password' ? (
              <ChampMotDePasse
                required={field.required}
                minLength={field.minLength}
                autoComplete={field.autoComplete}
                value={form[field.name]}
                onChange={(e) => update(field.name, e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            ) : (
              <input
                type={field.type}
                required={field.required}
                minLength={field.minLength}
                autoComplete={field.autoComplete}
                value={form[field.name]}
                onChange={(e) => update(field.name, e.target.value)}
                className="bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body-md text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
              />
            )}
          </label>
        ))}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 bg-primary text-on-primary font-label-md text-label-md rounded-xl py-3.5 hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-60"
        >
          {t('medecin.register.submit')}
        </button>
      </form>

      <p className="mt-6 text-center font-body-md text-body-md text-on-surface-variant">
        {t('medecin.register.hasAccount')}{' '}
        <Link to="/connexion/medecin" className="text-primary font-label-md">
          {t('medecin.register.login')}
        </Link>
      </p>
    </AuthLayout>
  )
}
