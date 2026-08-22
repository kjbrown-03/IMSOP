import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { api } from '../../lib/api'

export default function PaiementSecurise() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const dossierId = location.state?.dossierId
  const [method, setMethod] = useState('carte')
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState(null)

  const METHODS = [
    { id: 'carte', label: t('patient.payment.methodCard'), icon: 'credit_card' },
    { id: 'mobile_money', label: t('patient.payment.methodMobileMoney'), icon: 'smartphone' },
    { id: 'assurance', label: t('patient.payment.methodInsurance'), icon: 'shield' },
  ]

  async function pay() {
    if (!dossierId) {
      setError(t('errors.caseNotFoundRestart'))
      return
    }
    setError(null)
    setPaying(true)
    try {
      await api.post(`/dossiers/${dossierId}/paiement/init`)
      // En développement, CinetPay n'est pas configuré : on simule la confirmation
      // du webhook pour permettre de tester le parcours de bout en bout.
      await api.post(`/dossiers/${dossierId}/paiement/simulate`)
      navigate('/patient/matching', { state: { dossierId } })
    } catch (err) {
      setError(err.response?.data?.message || t('errors.paymentFailed'))
      setPaying(false)
    }
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <header className="bg-surface text-primary font-headline-md font-bold flex justify-between items-center px-margin-mobile w-full h-14 sticky top-0 z-50 border-b border-outline-variant">
        <button className="p-2 rounded-full hover:bg-surface-container-low text-primary" onClick={() => navigate('/patient/nouvelle-demande')}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <span className="truncate flex-1 text-center">IMSOP</span>
        <div className="w-10" />
      </header>

      <main className="max-w-[1200px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg flex-1 w-full">
        <div className="mb-stack-lg">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">
            {t('patient.payment.title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            {t('patient.payment.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-stack-md bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
          <div className="lg:col-span-8 space-y-stack-md">
            <section className="bg-surface-container-lowest p-stack-md rounded-xl border border-outline-variant shadow-sm">
              <h2 className="font-headline-md text-headline-md mb-stack-md">{t('patient.payment.methodTitle')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-4">
                {METHODS.map((m) => (
                  <label
                    key={m.id}
                    className={`relative flex flex-col gap-2 p-4 cursor-pointer rounded-lg border-2 transition-colors ${
                      method === m.id ? 'border-primary bg-primary-fixed/20' : 'border-outline-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <input
                      type="radio"
                      name="method"
                      value={m.id}
                      checked={method === m.id}
                      onChange={() => setMethod(m.id)}
                      className="sr-only"
                    />
                    <span className={`material-symbols-outlined text-2xl ${method === m.id ? 'text-primary' : 'text-on-surface-variant'}`}>
                      {m.icon}
                    </span>
                    <span className={`font-label-md text-label-md ${method === m.id ? 'text-primary' : 'text-on-surface'}`}>{m.label}</span>
                  </label>
                ))}
              </div>

              {method === 'carte' && (
                <div className="flex flex-col gap-stack-sm mt-2">
                  <input
                    className="h-12 px-4 rounded-lg border border-outline-variant bg-surface font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('patient.payment.cardNumber')}
                    type="text"
                  />
                  <div className="grid grid-cols-2 gap-stack-sm">
                    <input
                      className="h-12 px-4 rounded-lg border border-outline-variant bg-surface font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t('patient.payment.cardExpiry')}
                      type="text"
                    />
                    <input
                      className="h-12 px-4 rounded-lg border border-outline-variant bg-surface font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder={t('patient.payment.cardCvc')}
                      type="text"
                    />
                  </div>
                </div>
              )}
              {method === 'mobile_money' && (
                <input
                  className="h-12 px-4 rounded-lg border border-outline-variant bg-surface font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary w-full"
                  placeholder={t('patient.payment.mobileMoneyPlaceholder')}
                  type="tel"
                />
              )}
              {method === 'assurance' && (
                <p className="font-body-md text-body-md text-on-surface-variant">
                  {t('patient.payment.insuranceNote')}
                </p>
              )}
            </section>

            <div className="p-4 bg-surface-container-low border border-outline-variant rounded-lg flex items-start gap-3">
              <span className="material-symbols-outlined text-secondary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                lock
              </span>
              <p className="font-label-sm text-label-sm text-on-surface-variant leading-relaxed">
                {t('patient.payment.securityNote')}
              </p>
            </div>
          </div>

          <div className="lg:col-span-4">
            <aside className="bg-surface-container-lowest p-stack-md rounded-xl border border-outline-variant shadow-sm">
              <h2 className="font-headline-md text-headline-md mb-stack-md">{t('patient.payment.summaryTitle')}</h2>
              <ul className="space-y-2 mb-stack-md">
                <li className="flex justify-between font-body-md text-body-md text-on-surface-variant">
                  <span>{t('patient.payment.standardOpinion')}</span>
                  <span>150,00 €</span>
                </li>
                <li className="flex justify-between font-body-md text-body-md text-on-surface-variant">
                  <span>{t('patient.payment.caseFee')}</span>
                  <span>25,00 €</span>
                </li>
              </ul>
              <div className="flex justify-between items-center mb-stack-lg bg-surface-container-low p-4 rounded-lg">
                <span className="font-headline-md text-headline-md text-primary">{t('patient.payment.totalDue')}</span>
                <span className="font-headline-md text-headline-md text-primary">175,00 €</span>
              </div>
              <button
                onClick={pay}
                disabled={paying}
                className="w-full h-12 bg-primary text-on-primary font-label-md text-label-md rounded-full shadow-sm flex items-center justify-center gap-2 hover:bg-primary-container transition-colors disabled:opacity-60"
              >
                <span className="material-symbols-outlined">lock</span>
                {paying ? t('patient.payment.processing') : t('patient.payment.payAndSend')}
              </button>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
