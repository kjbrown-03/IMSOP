import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Hospital, Leaf, Loader2, Pencil, Plus, Search, Send, Trash2, Undo2, X } from 'lucide-react'
import TradipraticienShell from '../../components/layout/TradipraticienShell'
import { api } from '../../lib/api'

const CHAMP =
  'w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white'
const ETIQUETTE = 'text-sm font-medium text-slate-700 dark:text-neutral-300'

// Suggestions seulement : un patient peut venir de n'importe où, le champ
// reste libre.
const PAYS_SUGGERES = [
  'Cameroun', 'Centrafrique', 'Congo', 'Gabon', 'Guinée équatoriale', 'Tchad',
  'Nigeria', 'République démocratique du Congo', 'France',
]

const VIDE = { nom: '', age: '', sexe: '', paysOrigine: '', diagnostic: '', therapeutique: '', dureeTraitement: '' }

const messageErreur = (err, repli) => {
  const d = err.response?.data
  return d?.errors?.[0]?.message || d?.message || repli
}

/**
 * Registre des patients du tradipraticien : son carnet de consultation. Rien
 * de ce qui s'écrit ici ne quitte son espace — ni la coordination ni le
 * confrère vers qui il oriente un patient n'y ont accès.
 */
export default function RegistrePatients() {
  const { t } = useTranslation()

  const [items, setItems] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [recherche, setRecherche] = useState('')

  // null : formulaire fermé ; { id: null } : création ; { id } : modification.
  const [edition, setEdition] = useState(null)
  const [form, setForm] = useState(VIDE)
  const [envoi, setEnvoi] = useState(false)
  const [erreurForm, setErreurForm] = useState(null)

  const [referant, setReferant] = useState(null)

  const charger = useCallback(async (q) => {
    setChargement(true)
    setErreur(null)
    try {
      const { data } = await api.get('/registre', { params: { pageSize: 100, ...(q ? { q } : {}) } })
      setItems(data.items)
    } catch (err) {
      setErreur(messageErreur(err, t('tradipraticien.registre.erreurChargement')))
    } finally {
      setChargement(false)
    }
  }, [t])

  useEffect(() => {
    const minuteur = setTimeout(() => charger(recherche.trim()), 300)
    return () => clearTimeout(minuteur)
  }, [recherche, charger])

  const ouvrirCreation = () => {
    setForm(VIDE)
    setErreurForm(null)
    setEdition({ id: null })
  }
  const ouvrirModification = (p) => {
    setForm({
      nom: p.nom, age: String(p.age), sexe: p.sexe, paysOrigine: p.paysOrigine,
      diagnostic: p.diagnostic, therapeutique: p.therapeutique, dureeTraitement: p.dureeTraitement,
    })
    setErreurForm(null)
    setEdition({ id: p.id })
  }

  const enregistrer = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    setErreurForm(null)
    try {
      const corps = { ...form, age: Number(form.age) }
      if (edition.id) {
        const { data } = await api.patch(`/registre/${edition.id}`, corps)
        setItems((l) => l.map((p) => (p.id === data.id ? data : p)))
      } else {
        const { data } = await api.post('/registre', corps)
        setItems((l) => [data, ...l])
      }
      setEdition(null)
    } catch (err) {
      setErreurForm(messageErreur(err, t('tradipraticien.registre.erreurEnregistrement')))
    } finally {
      setEnvoi(false)
    }
  }

  const supprimer = async (p) => {
    if (!window.confirm(t('tradipraticien.registre.confirmerSuppression', { nom: p.nom }))) return
    try {
      await api.delete(`/registre/${p.id}`)
      setItems((l) => l.filter((x) => x.id !== p.id))
    } catch (err) {
      setErreur(messageErreur(err, t('tradipraticien.registre.erreurEnregistrement')))
    }
  }

  const annulerReference = async (p) => {
    try {
      const { data } = await api.delete(`/registre/${p.id}/reference`)
      setItems((l) => l.map((x) => (x.id === data.id ? data : x)))
    } catch (err) {
      setErreur(messageErreur(err, t('tradipraticien.registre.erreurEnregistrement')))
    }
  }

  const champ = (nom) => ({
    value: form[nom],
    onChange: (e) => setForm((f) => ({ ...f, [nom]: e.target.value })),
  })

  return (
    <TradipraticienShell>
      <section className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('tradipraticien.registre.titre')}
          </h1>
          <p className="text-slate-500 dark:text-neutral-400 text-sm max-w-xl">{t('tradipraticien.registre.sousTitre')}</p>
        </div>
        <button
          type="button"
          onClick={ouvrirCreation}
          className="shrink-0 flex items-center gap-2 rounded-full bg-[var(--color-primary)] text-white px-5 py-2.5 text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          {t('tradipraticien.registre.nouveau')}
        </button>
      </section>

      {edition && (
        <form onSubmit={enregistrer} className="glass-card rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {edition.id ? t('tradipraticien.registre.modifier') : t('tradipraticien.registre.nouveau')}
            </h2>
            <button type="button" onClick={() => setEdition(null)} aria-label={t('tradipraticien.registre.fermer')}>
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={ETIQUETTE}>{t('tradipraticien.registre.champs.nom')}</span>
              <input className={CHAMP} required minLength={2} maxLength={120} {...champ('nom')} />
            </label>
            <label className="flex flex-col gap-1">
              <span className={ETIQUETTE}>{t('tradipraticien.registre.champs.age')}</span>
              <input className={CHAMP} type="number" min={0} max={130} required {...champ('age')} />
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className={ETIQUETTE}>{t('tradipraticien.registre.champs.sexe')}</legend>
              <div className="flex gap-4 pt-2">
                {['MASCULIN', 'FEMININ'].map((s) => (
                  <label key={s} className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-300">
                    <input type="radio" name="sexe" value={s} required checked={form.sexe === s}
                      onChange={() => setForm((f) => ({ ...f, sexe: s }))} />
                    {t(`tradipraticien.registre.sexe.${s}`)}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={ETIQUETTE}>{t('tradipraticien.registre.champs.paysOrigine')}</span>
              <input className={CHAMP} list="registre-pays" required maxLength={80} {...champ('paysOrigine')} />
              <datalist id="registre-pays">
                {PAYS_SUGGERES.map((p) => <option key={p} value={p} />)}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={ETIQUETTE}>{t('tradipraticien.registre.champs.diagnostic')}</span>
              <textarea className={CHAMP} rows={2} required maxLength={2000} {...champ('diagnostic')} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={ETIQUETTE}>{t('tradipraticien.registre.champs.therapeutique')}</span>
              <textarea className={CHAMP} rows={3} required maxLength={2000} {...champ('therapeutique')} />
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className={ETIQUETTE}>{t('tradipraticien.registre.champs.dureeTraitement')}</span>
              <input className={CHAMP} required maxLength={100} placeholder={t('tradipraticien.registre.dureeExemple')}
                {...champ('dureeTraitement')} />
            </label>
          </div>

          {erreurForm && (
            <p className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">
              {erreurForm}
            </p>
          )}

          <button type="submit" disabled={envoi}
            className="self-end flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl px-5 py-2.5">
            {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
            {t('tradipraticien.registre.enregistrer')}
          </button>
        </form>
      )}

      <label className="relative block">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input className={`${CHAMP} pl-9`} placeholder={t('tradipraticien.registre.rechercher')}
          value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      </label>

      {erreur && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">{erreur}</div>
      )}

      {chargement && items.length === 0 && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400">
          {t('tradipraticien.registre.chargement')}
        </div>
      )}

      {!chargement && !erreur && items.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center text-slate-500 dark:text-neutral-400 text-sm">
          {recherche ? t('tradipraticien.registre.aucunResultat') : t('tradipraticien.registre.vide')}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {items.map((p) => (
          <article key={p.id} className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900 dark:text-white truncate">{p.nom}</h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">
                  {t('tradipraticien.registre.ans', { count: p.age })} · {t(`tradipraticien.registre.sexe.${p.sexe}`)} · {p.paysOrigine}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => ouvrirModification(p)} aria-label={t('tradipraticien.registre.modifier')}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800">
                  <Pencil className="w-4 h-4 text-slate-500" />
                </button>
                <button type="button" onClick={() => supprimer(p)} aria-label={t('tradipraticien.registre.supprimer')}
                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30">
                  <Trash2 className="w-4 h-4 text-rose-500" />
                </button>
              </div>
            </div>

            <dl className="text-sm flex flex-col gap-1.5">
              {['diagnostic', 'therapeutique', 'dureeTraitement'].map((c) => (
                <div key={c}>
                  <dt className="text-xs text-slate-500 dark:text-neutral-400">{t(`tradipraticien.registre.champs.${c}`)}</dt>
                  <dd className="text-slate-700 dark:text-neutral-200 whitespace-pre-line">{p[c]}</dd>
                </div>
              ))}
            </dl>

            {p.referenceVers ? (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-900 dark:text-amber-100 flex flex-col gap-1">
                <p className="font-medium flex items-center gap-2">
                  {p.referenceVers === 'HOPITAL_CONVENTIONNEL' ? <Hospital className="w-4 h-4" /> : <Leaf className="w-4 h-4" />}
                  {t(`tradipraticien.registre.refereVers.${p.referenceVers}`)} : {p.referenceDestinataire}
                </p>
                {p.referenceMotif && <p className="text-xs whitespace-pre-line">{p.referenceMotif}</p>}
                <div className="flex items-center justify-between text-xs">
                  <span>{new Date(p.referenceLe).toLocaleDateString()}</span>
                  <button type="button" onClick={() => annulerReference(p)} className="flex items-center gap-1 underline">
                    <Undo2 className="w-3 h-3" /> {t('tradipraticien.registre.annulerReference')}
                  </button>
                </div>
              </div>
            ) : referant === p.id ? (
              <FormulaireReference
                patient={p}
                onFermer={() => setReferant(null)}
                onRefere={(maj) => {
                  setItems((l) => l.map((x) => (x.id === maj.id ? maj : x)))
                  setReferant(null)
                }}
              />
            ) : (
              <button type="button" onClick={() => setReferant(p.id)}
                className="flex items-center justify-center gap-2 border border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-sm font-medium rounded-xl py-2 hover:bg-slate-50 dark:hover:bg-neutral-800">
                <Send className="w-4 h-4" />
                {t('tradipraticien.registre.referer')}
              </button>
            )}
          </article>
        ))}
      </div>
    </TradipraticienShell>
  )
}

function FormulaireReference({ patient, onFermer, onRefere }) {
  const { t } = useTranslation()
  const [vers, setVers] = useState('HOPITAL_CONVENTIONNEL')
  const [destinataire, setDestinataire] = useState('')
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  const envoyer = async (e) => {
    e.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      const { data } = await api.post(`/registre/${patient.id}/reference`, {
        referenceVers: vers,
        referenceDestinataire: destinataire,
        ...(motif.trim() ? { referenceMotif: motif } : {}),
      })
      onRefere(data)
    } catch (err) {
      setErreur(messageErreur(err, t('tradipraticien.registre.erreurEnregistrement')))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form onSubmit={envoyer} className="rounded-xl border border-slate-200 dark:border-neutral-700 p-3 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {['HOPITAL_CONVENTIONNEL', 'AUTRE_TRADIPRATICIEN'].map((v) => (
          <button key={v} type="button" onClick={() => setVers(v)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium border ${
              vers === v
                ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-200'
                : 'border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'
            }`}>
            {v === 'HOPITAL_CONVENTIONNEL' ? <Hospital className="w-4 h-4" /> : <Leaf className="w-4 h-4" />}
            {t(`tradipraticien.registre.versChoix.${v}`)}
          </button>
        ))}
      </div>
      <input className={CHAMP} required minLength={2} maxLength={200} value={destinataire}
        onChange={(e) => setDestinataire(e.target.value)}
        placeholder={t(`tradipraticien.registre.destinataire.${vers}`)} />
      <textarea className={CHAMP} rows={2} maxLength={2000} value={motif}
        onChange={(e) => setMotif(e.target.value)} placeholder={t('tradipraticien.registre.motif')} />
      {erreur && <p className="text-rose-600 text-xs">{erreur}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFermer} className="text-sm text-slate-500 px-3 py-1.5">
          {t('tradipraticien.registre.annuler')}
        </button>
        <button type="submit" disabled={envoi}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-1.5">
          {envoi && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('tradipraticien.registre.confirmerReference')}
        </button>
      </div>
    </form>
  )
}
