import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../store/useAuthStore'
import { ArrowLeft, CreditCard, Smartphone, ShieldCheck, Lock, Loader2, ExternalLink } from 'lucide-react'
import CartePaiement from '../../components/ui/CartePaiement'
import { api } from '../../lib/api'

// Le prix vient du serveur, jamais de constantes locales : l'écran affichait
// 175 € pendant que le serveur facturait 175 XAF. Une seule source de vérité.

export default function PaiementSecurise() {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const dossierId = location.state?.dossierId
  const reference = location.state?.reference

  const [methode, setMethode] = useState('carte')
  const [telephone, setTelephone] = useState('')
  const [paiementEnCours, setPaiementEnCours] = useState(false)
  const [error, setError] = useState(null)

  const [tarif, setTarif] = useState(null)

  useEffect(() => {
    if (!dossierId) return undefined
    let annule = false
    api
      .get(`/dossiers/${dossierId}/paiement/tarif`)
      .then(({ data }) => { if (!annule) setTarif(data) })
      .catch((err) => { if (!annule) setError(err.response?.data?.message || t('patient.payment.tarifIndisponible')) })
    return () => { annule = true }
  }, [dossierId, t])

  const total = tarif?.amount ?? 0
  const devise = tarif?.currency ?? ''

  const METHODES = [
    { id: 'carte', label: t('patient.payment.methodCard'), icon: CreditCard, note: t('patient.payment.cardRedirectNote') },
    { id: 'mobile_money', label: t('patient.payment.methodMobileMoney'), icon: Smartphone, note: t('patient.payment.mobileRedirectNote') },
    { id: 'assurance', label: t('patient.payment.methodInsurance'), icon: ShieldCheck, note: t('patient.payment.insuranceNote') },
  ]

  const methodeActive = METHODES.find((m) => m.id === methode)

  async function payer() {
    if (!dossierId) {
      setError(t('errors.caseNotFoundRestart'))
      return
    }
    setError(null)
    setPaiementEnCours(true)
    try {
      const { data } = await api.post(`/dossiers/${dossierId}/paiement/init`)

      // Parcours réel : CinetPay renvoie l'adresse de sa page hébergée, c'est
      // là — et seulement là — que les coordonnées bancaires sont saisies.
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl
        return
      }

      // Développement : CinetPay n'est pas configuré, on simule la confirmation
      // du webhook pour pouvoir dérouler le parcours de bout en bout.
      await api.post(`/dossiers/${dossierId}/paiement/simulate`)
      navigate('/patient/matching', { state: { dossierId } })
    } catch (err) {
      setError(err.response?.data?.message || t('errors.paymentFailed'))
      setPaiementEnCours(false)
    }
  }

  // Développement uniquement : confirme le paiement sans passer par le
  // fournisseur ni attendre son webhook. Le bouton n'existe pas en production
  // et l'API refuse l'appel hors développement - double verrou.
  async function simulerDev() {
    if (!dossierId) return
    setError(null)
    setPaiementEnCours(true)
    try {
      await api.post(`/dossiers/${dossierId}/paiement/init`)
      await api.post(`/dossiers/${dossierId}/paiement/simulate`)
      navigate('/patient/matching', { state: { dossierId } })
    } catch (err) {
      setError(err.response?.data?.message || t('errors.paymentFailed'))
      setPaiementEnCours(false)
    }
  }

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex flex-col">
      <header className="bg-surface text-primary font-headline-md font-bold flex justify-between items-center px-margin-mobile w-full h-14 sticky top-0 z-50 border-b border-outline-variant">
        <button
          className="p-2 rounded-full hover:bg-surface-container-low text-primary"
          onClick={() => navigate('/patient/nouvelle-demande')}
          aria-label={t('common.back')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="truncate flex-1 text-center">IMSOP</span>
        <div className="w-10" />
      </header>

      <main className="max-w-[1100px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg flex-1 w-full">
        <div className="mb-stack-lg">
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">
            {t('patient.payment.title')}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
            {t('patient.payment.subtitle')}
          </p>
        </div>

        {error && (
          <div className="mb-stack-md bg-error-container text-on-error-container text-label-sm font-label-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="grid gap-stack-lg lg:grid-cols-2 items-start">
          {/* ---------- Colonne gauche : la carte ---------- */}
          <div className="lg:sticky lg:top-24">
            <CartePaiement
              montantTotal={total}
              devise={devise}
              reference={reference}
              titulaire={user?.fullName}
              methode={methodeActive?.label}
              lignes={
                tarif
                  ? [{ libelle: t(`patient.payment.avis.${tarif.urgence}`), montant: tarif.amount }]
                  : []
              }
            />
          </div>

          {/* ---------- Colonne droite : le choix et l'action ---------- */}
          <div className="flex flex-col gap-stack-md">
            <section className="bg-surface-container-lowest p-stack-md rounded-2xl border border-outline-variant shadow-sm">
              <h2 className="font-headline-md text-headline-md mb-stack-md">{t('patient.payment.methodTitle')}</h2>

              <div className="flex flex-col gap-2.5">
                {METHODES.map((m) => {
                  const actif = methode === m.id
                  return (
                    <label
                      key={m.id}
                      className={`flex items-start gap-3 p-4 cursor-pointer rounded-xl border-2 transition-colors ${
                        actif
                          ? 'border-primary bg-primary-fixed/20'
                          : 'border-outline-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <input
                        type="radio"
                        name="methode"
                        value={m.id}
                        checked={actif}
                        onChange={() => setMethode(m.id)}
                        className="sr-only"
                      />
                      <m.icon className={`w-5 h-5 shrink-0 mt-0.5 ${actif ? 'text-primary' : 'text-on-surface-variant'}`} />
                      <span className="flex-1 min-w-0">
                        <span className={`block font-label-md text-label-md ${actif ? 'text-primary' : 'text-on-surface'}`}>
                          {m.label}
                        </span>
                        <span className="block font-label-sm text-label-sm text-on-surface-variant leading-relaxed mt-0.5">
                          {m.note}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>

              {methode === 'mobile_money' && (
                <input
                  className="mt-stack-sm h-12 px-4 rounded-xl border border-outline-variant bg-surface font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary w-full"
                  placeholder={t('patient.payment.mobileMoneyPlaceholder')}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                />
              )}
            </section>

            <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl flex items-start gap-3">
              <Lock className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <p className="font-label-sm text-label-sm text-on-surface-variant leading-relaxed">
                {t('patient.payment.securityNote')}
              </p>
            </div>

            <button
              onClick={payer}
              disabled={paiementEnCours}
              className="w-full h-13 min-h-[52px] bg-primary text-on-primary font-label-md text-label-md rounded-full shadow-sm flex items-center justify-center gap-2 hover:bg-primary-container hover:text-on-primary-container transition-colors disabled:opacity-60"
            >
              {paiementEnCours ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('patient.payment.processing')}
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5" />
                  {t('patient.payment.payAndSend')}
                </>
              )}
            </button>

            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={simulerDev}
                disabled={paiementEnCours}
                className="w-full min-h-[44px] rounded-full border border-dashed border-amber-500 text-amber-700 dark:text-amber-400 font-label-sm text-label-sm hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-60"
              >
                {t('common.simulerPaiementDev')}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
