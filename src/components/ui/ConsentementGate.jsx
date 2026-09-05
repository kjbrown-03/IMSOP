import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../store/useAuthStore'
import { correspondAuTitulaire } from '../../lib/nomSignataire'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Download, Loader2, Mail, ShieldCheck } from 'lucide-react'
import { api } from '../../lib/api'

/**
 * Étape obligatoire avant l'envoi d'une demande (patient ou médecin traitant) :
 * télécharger le formulaire de consentement, cocher l'acceptation, taper son
 * nom comme signature électronique, puis confirmer par un code envoyé à
 * l'adresse du compte.
 *
 * Le nom tapé ne prouve rien à lui seul - une session laissée ouverte suffirait
 * à signer à la place du titulaire. Le code rattache la signature au porteur de
 * l'adresse, juste avant l'engagement financier. Le jeton renvoyé par la
 * vérification remonte au parent, qui l'envoie avec le consentement ; le
 * serveur le revérifie (voir consentements.controller.js), la vérification
 * côté écran ne protégeant rien à elle seule.
 */
export default function ConsentementGate({
  accepted,
  onAcceptedChange,
  nomSignataire,
  onNomChange,
  otpToken,
  onOtpTokenChange,
  disabled,
}) {
  const { t } = useTranslation()
  const titulaire = useAuthStore((s) => s.user?.fullName)
  const [telechargement, setTelechargement] = useState(false)
  const [erreurTelechargement, setErreurTelechargement] = useState(null)

  const [envoiCode, setEnvoiCode] = useState(false)
  const [codeEnvoye, setCodeEnvoye] = useState(false)
  const [emailIndice, setEmailIndice] = useState(null)
  const [code, setCode] = useState('')
  const [verification, setVerification] = useState(false)
  const [erreurOtp, setErreurOtp] = useState(null)

  // Signature à laquelle le jeton se rapporte : modifier le nom après coup
  // reviendrait sinon à faire valider une signature par un code obtenu pour
  // une autre.
  const signatureVerifiee = useRef(null)

  const nomSaisi = nomSignataire.trim()
  const nomCorrespond = correspondAuTitulaire(nomSaisi, titulaire)
  // On n'affiche l'erreur qu'une fois la saisie engagée : la signaler dès le
  // premier caractère ferait clignoter un reproche pendant que l'on tape.
  const nomIncorrect = nomSaisi.length >= 2 && !nomCorrespond
  const signatureComplete = accepted && nomCorrespond

  useEffect(() => {
    if (!otpToken) return
    if (!accepted || signatureVerifiee.current !== nomSignataire.trim()) {
      onOtpTokenChange(null)
      setCodeEnvoye(false)
      setCode('')
    }
  }, [accepted, nomSignataire, otpToken, onOtpTokenChange])

  async function telecharger() {
    setTelechargement(true)
    setErreurTelechargement(null)
    try {
      const { data } = await api.get('/consentement-pdf', { responseType: 'blob' })
      const url = window.URL.createObjectURL(data)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => window.URL.revokeObjectURL(url), 60_000)
    } catch {
      setErreurTelechargement(t('consentement.downloadError'))
    } finally {
      setTelechargement(false)
    }
  }

  async function demanderCode() {
    setEnvoiCode(true)
    setErreurOtp(null)
    try {
      const { data } = await api.post('/auth/consentement/code')
      setEmailIndice(data.email)
      setCodeEnvoye(true)
      setCode('')
    } catch (err) {
      setErreurOtp(err.response?.data?.message || t('consentement.otpSendError'))
    } finally {
      setEnvoiCode(false)
    }
  }

  async function verifierCode() {
    if (code.length !== 6) return
    setVerification(true)
    setErreurOtp(null)
    try {
      const { data } = await api.post('/auth/consentement/code/verify', { code })
      signatureVerifiee.current = nomSignataire.trim()
      onOtpTokenChange(data.consentToken)
    } catch (err) {
      setErreurOtp(err.response?.data?.message || t('consentement.otpVerifyError'))
    } finally {
      setVerification(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[var(--color-primary,theme(colors.primary.600))] bg-white dark:bg-neutral-900 p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary-600 shrink-0" />
        <h2 className="text-sm font-bold uppercase tracking-wide text-primary-700 dark:text-primary-400">
          {t('consentement.title')}
        </h2>
      </div>
      <p className="text-xs text-slate-500 dark:text-neutral-400">{t('consentement.help')}</p>

      <button
        type="button"
        onClick={telecharger}
        disabled={telechargement}
        className="self-start flex items-center gap-2 rounded-lg border border-slate-300 dark:border-neutral-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-60"
      >
        {telechargement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {t('consentement.download')}
      </button>
      {erreurTelechargement && <p className="text-xs font-semibold text-rose-600">{erreurTelechargement}</p>}

      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
        />
        <span className="text-sm text-slate-700 dark:text-neutral-200">{t('consentement.checkboxLabel')}</span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">
          {t('consentement.signatureLabel')}
        </span>
        <input
          type="text"
          value={nomSignataire}
          onChange={(e) => onNomChange(e.target.value)}
          disabled={disabled || !accepted}
          placeholder={t('consentement.signaturePlaceholder')}
          aria-invalid={nomIncorrect}
          autoComplete="name"
          className={`w-full rounded-lg border bg-transparent px-3 py-2 text-slate-900 dark:text-white disabled:opacity-50 ${
            nomIncorrect
              ? 'border-rose-400 dark:border-rose-500'
              : 'border-slate-300 dark:border-neutral-700'
          }`}
        />
        {nomIncorrect ? (
          <span className="text-xs text-rose-600 dark:text-rose-400">
            {t('consentement.signatureMismatch', { nom: titulaire || '—' })}
          </span>
        ) : (
          <span className="text-xs text-slate-500 dark:text-neutral-400">
            {t('consentement.signatureHint', { nom: titulaire || '—' })}
          </span>
        )}
      </label>

      {signatureComplete && (
        <div className="rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800/60 p-4 flex flex-col gap-3">
          {otpToken ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {t('consentement.otpConfirmed')}
            </p>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 mt-0.5 shrink-0 text-slate-500 dark:text-neutral-400" />
                <p className="text-xs text-slate-600 dark:text-neutral-300">
                  {codeEnvoye ? t('consentement.otpSent', { email: emailIndice }) : t('consentement.otpIntro')}
                </p>
              </div>

              {codeEnvoye && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    disabled={disabled || verification}
                    placeholder={t('consentement.otpPlaceholder')}
                    className="w-full sm:w-40 rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 tracking-[0.4em] text-center font-mono text-slate-900 dark:text-white disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={verifierCode}
                    disabled={disabled || verification || code.length !== 6}
                    className="rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {verification && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('consentement.otpVerify')}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={demanderCode}
                disabled={disabled || envoiCode}
                className="self-start text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-60 flex items-center gap-2"
              >
                {envoiCode && <Loader2 className="w-4 h-4 animate-spin" />}
                {codeEnvoye ? t('consentement.otpResend') : t('consentement.otpSend')}
              </button>
            </>
          )}

          {erreurOtp && <p className="text-xs font-semibold text-rose-600">{erreurOtp}</p>}
        </div>
      )}
    </section>
  )
}
