import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Eye, EyeOff, Loader2, Plus, Search, Stethoscope, X } from 'lucide-react'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { api } from '../../lib/api'

const FILTRES = ['toutes', 'SPECIALISTE', 'MEDECIN_LOCAL']

const sansAccent = (s) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Gestion de la liste des spécialités proposées dans les formulaires de
 * candidature.
 *
 * Une spécialité n'est jamais supprimée, seulement retirée : des praticiens la
 * portent déjà, et effacer le libellé rendrait leur fiche illisible. Retirée,
 * elle disparaît des formulaires et reste consultable ici.
 */
export default function CoordinateurSpecialites() {
  const { t } = useTranslation()

  const [liste, setListe] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [info, setInfo] = useState(null)
  const [enCours, setEnCours] = useState(null)

  const [filtre, setFiltre] = useState('toutes')
  const [recherche, setRecherche] = useState('')

  const [ajout, setAjout] = useState(false)
  const [nom, setNom] = useState('')
  const [cibles, setCibles] = useState({ pourSpecialiste: true, pourMedecin: true })

  async function charger({ silencieux = false } = {}) {
    if (!silencieux) setChargement(true)
    try {
      // `toutes` : la coordination voit aussi les spécialités retirées, c'est
      // d'ici qu'on les remet en circulation.
      const { data } = await api.get('/specialites', { params: { toutes: true } })
      setListe(data)
      setErreur(null)
    } catch (err) {
      setErreur(err.response?.data?.message || t('specialites.chargementEchoue'))
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function ajouter(e) {
    e.preventDefault()
    const propre = nom.trim()
    if (!propre || (!cibles.pourSpecialiste && !cibles.pourMedecin)) return

    setEnCours('ajout')
    setInfo(null)
    setErreur(null)
    try {
      await api.post('/specialites', { nom: propre, ...cibles })
      setInfo(t('specialites.ajoutee', { nom: propre }))
      setNom('')
      setAjout(false)
      await charger({ silencieux: true })
    } catch (err) {
      const statut = err.response?.status
      setErreur(statut === 409 ? t('specialites.existe') : err.response?.data?.message || t('specialites.actionEchouee'))
    } finally {
      setEnCours(null)
    }
  }

  async function modifier(specialite, champs) {
    setEnCours(specialite.id)
    setInfo(null)
    try {
      await api.patch(`/specialites/${specialite.id}`, champs)
      await charger({ silencieux: true })
      setErreur(null)
    } catch (err) {
      setErreur(err.response?.data?.message || t('specialites.actionEchouee'))
    } finally {
      setEnCours(null)
    }
  }

  const visibles = useMemo(() => {
    const q = sansAccent(recherche)
    return liste.filter((s) => {
      if (filtre === 'SPECIALISTE' && !s.pourSpecialiste) return false
      if (filtre === 'MEDECIN_LOCAL' && !s.pourMedecin) return false
      return !q || sansAccent(s.nom).includes(q)
    })
  }, [liste, filtre, recherche])

  const cibleManquante = !cibles.pourSpecialiste && !cibles.pourMedecin

  return (
    <CoordinatorLayout>
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
          <Stethoscope className="w-7 h-7 text-primary-600" /> {t('specialites.titre')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400">{t('specialites.sousTitre')}</p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t('specialites.rechercher')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTRES.map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                filtre === f
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700'
              }`}
            >
              {t(`specialites.filtre.${f}`)}
            </button>
          ))}
        </div>

        {!ajout && (
          <button
            onClick={() => { setAjout(true); setErreur(null); setInfo(null) }}
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" /> {t('specialites.ajouter')}
          </button>
        )}
      </div>

      {info && (
        <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm font-medium rounded-2xl px-5 py-4 mb-4">
          {info}
        </div>
      )}
      {erreur && (
        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4 mb-4">
          {erreur}
        </div>
      )}

      {ajout && (
        <form onSubmit={ajouter} className="glass-card dark:bg-neutral-900 rounded-2xl p-5 mb-6 flex flex-col gap-4 animate-fade-in-up">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('specialites.nom')}</span>
            <input
              autoFocus
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder={t('specialites.nomPlaceholder')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{t('specialites.cibles')}</legend>
            <div className="flex flex-wrap gap-2">
              <CaseCible
                actif={cibles.pourSpecialiste}
                onChange={(v) => setCibles((c) => ({ ...c, pourSpecialiste: v }))}
                label={t('specialites.pourSpecialiste')}
              />
              <CaseCible
                actif={cibles.pourMedecin}
                onChange={(v) => setCibles((c) => ({ ...c, pourMedecin: v }))}
                label={t('specialites.pourMedecin')}
              />
            </div>
            {cibleManquante && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{t('specialites.cibleObligatoire')}</p>
            )}
          </fieldset>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setAjout(false); setNom('') }}
              className="flex-1 sm:flex-none text-sm font-semibold text-slate-500 dark:text-slate-400 px-5 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800"
            >
              {t('specialites.annuler')}
            </button>
            <button
              type="submit"
              disabled={enCours === 'ajout' || cibleManquante}
              className="flex-1 sm:flex-none bg-primary-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {enCours === 'ajout' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t('specialites.valider')}
            </button>
          </div>
        </form>
      )}

      {chargement && (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {!chargement && visibles.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400">
          {t('specialites.aucune')}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((s, idx) => (
          <div
            key={s.id}
            className={`glass-card dark:bg-neutral-900 rounded-2xl p-4 flex flex-col gap-3 animate-fade-in-up ${s.actif ? '' : 'opacity-70'}`}
            style={{ animationDelay: `${Math.min(idx, 12) * 0.03}s` }}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white leading-snug">{s.nom}</h3>
              <span
                className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ${
                  s.actif
                    ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {s.actif ? t('specialites.active') : t('specialites.retiree')}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <BasculeCible
                actif={s.pourSpecialiste}
                occupe={enCours === s.id}
                onChange={() => modifier(s, { pourSpecialiste: !s.pourSpecialiste })}
                label={t('specialites.pourSpecialiste')}
              />
              <BasculeCible
                actif={s.pourMedecin}
                occupe={enCours === s.id}
                onChange={() => modifier(s, { pourMedecin: !s.pourMedecin })}
                label={t('specialites.pourMedecin')}
              />
            </div>

            {!s.actif && <p className="text-xs text-slate-400 dark:text-slate-500">{t('specialites.retireeAide')}</p>}

            <button
              onClick={() => modifier(s, { actif: !s.actif })}
              disabled={enCours === s.id}
              className={`mt-auto text-sm font-semibold px-4 py-2 rounded-xl border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                s.actif
                  ? 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800'
                  : 'border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
              }`}
            >
              {enCours === s.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : s.actif ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {s.actif ? t('specialites.retirer') : t('specialites.reactiver')}
            </button>
          </div>
        ))}
      </div>
    </CoordinatorLayout>
  )
}

function CaseCible({ actif, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!actif)}
      aria-pressed={actif}
      className={`text-sm font-semibold px-4 py-2 rounded-xl border transition-colors flex items-center gap-1.5 ${
        actif
          ? 'bg-primary-600 border-primary-600 text-white'
          : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-700'
      }`}
    >
      {actif ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
      {label}
    </button>
  )
}

function BasculeCible({ actif, occupe, onChange, label }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={occupe}
      aria-pressed={actif}
      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-60 ${
        actif
          ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-400'
          : 'bg-transparent border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-slate-500 line-through'
      }`}
    >
      {label}
    </button>
  )
}
