import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Loader2, Mail, Pencil, Plus } from 'lucide-react'
import ChampMotDePasse from './ChampMotDePasse'
import { api } from '../../lib/api'

/**
 * Adresse e-mail du compte, modifiable par son titulaire.
 *
 * Des praticiens sont enrôlés sans adresse (tradipraticiens importés, médecins
 * joints par téléphone) ou avec une adresse mal saisie. L'adresse est à la fois
 * l'identifiant de connexion et le canal des codes : on la vérifie donc par un
 * code envoyé à la nouvelle boîte avant de l'enregistrer. Une faute de frappe
 * enregistrée telle quelle fermerait le compte à son titulaire.
 */
const CHAMP =
  'w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white'

export default function ChangementEmail({ user, onChange }) {
  const { t } = useTranslation()
  const sansEmail = !user?.email || user?.sansEmail

  // repos → saisie (adresse + mot de passe) → code (envoyé à la nouvelle adresse)
  const [etape, setEtape] = useState('repos')
  const [email, setEmail] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [code, setCode] = useState('')
  const [jeton, setJeton] = useState(null)
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [fait, setFait] = useState(false)

  function annuler() {
    setEtape('repos')
    setEmail('')
    setMotDePasse('')
    setCode('')
    setJeton(null)
    setErreur(null)
  }

  async function demander(e) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      const { data } = await api.post('/auth/email', { nouvelEmail: email.trim(), motDePasse })
      setJeton(data.jeton)
      setEmail(data.email)
      setMotDePasse('')
      setEtape('code')
    } catch (err) {
      setErreur(err.response?.data?.message || t('profile.emailChange.echec'))
    } finally {
      setEnvoi(false)
    }
  }

  async function confirmer(e) {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await api.post('/auth/email/confirmation', { jeton, code: code.trim() })
      await onChange()
      annuler()
      setFait(true)
    } catch (err) {
      setErreur(err.response?.data?.message || t('profile.emailChange.echec'))
    } finally {
      setEnvoi(false)
    }
  }

  if (etape === 'repos') {
    return (
      <div className="flex items-center gap-4 py-4">
        <span className="p-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400 shrink-0">
          <Mail className="w-5 h-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{t('profile.email')}</p>
          <p className={`truncate ${sansEmail ? 'text-slate-400 dark:text-slate-500 italic' : 'text-slate-900 dark:text-white font-medium'}`}>
            {sansEmail ? t('profile.emailChange.aucune') : user.email}
          </p>
          {sansEmail && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{t('profile.emailChange.aucuneAide')}</p>
          )}
          {fait && (
            <p className="text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('profile.emailChange.enregistree')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { setEtape('saisie'); setFait(false) }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline shrink-0"
        >
          {sansEmail ? <Plus className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
          {sansEmail ? t('profile.emailChange.ajouter') : t('profile.emailChange.modifier')}
        </button>
      </div>
    )
  }

  if (etape === 'saisie') {
    return (
      <form onSubmit={demander} className="flex flex-col gap-3 py-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('profile.emailChange.nouvelle')}
          </span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
            className={CHAMP}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {t('profile.emailChange.motDePasse')}
          </span>
          <ChampMotDePasse
            className={CHAMP}
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('profile.emailChange.aide')}</p>
        {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}
        <div className="flex gap-3 items-center">
          <button
            type="submit"
            disabled={envoi || !email.trim() || !motDePasse}
            className="inline-flex items-center gap-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 text-sm font-bold disabled:opacity-50"
          >
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />} {t('profile.emailChange.envoyerCode')}
          </button>
          <button type="button" onClick={annuler} className="text-sm text-slate-500 hover:underline">
            {t('common.cancel')}
          </button>
        </div>
      </form>
    )
  }

  return (
    <form onSubmit={confirmer} className="flex flex-col gap-3 py-4">
      <p className="text-sm text-slate-700 dark:text-slate-300">
        {t('profile.emailChange.codeEnvoye', { email })}
      </p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        aria-label={t('profile.emailChange.code')}
        required
        className={`${CHAMP} max-w-[10rem] tracking-[0.3em] font-mono`}
      />
      {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}
      <div className="flex gap-3 items-center">
        <button
          type="submit"
          disabled={envoi || code.length !== 6}
          className="inline-flex items-center gap-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white px-5 py-2 text-sm font-bold disabled:opacity-50"
        >
          {envoi && <Loader2 className="w-4 h-4 animate-spin" />} {t('profile.emailChange.confirmer')}
        </button>
        <button type="button" onClick={annuler} className="text-sm text-slate-500 hover:underline">
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}
