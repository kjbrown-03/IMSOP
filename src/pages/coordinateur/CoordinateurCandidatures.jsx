import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, FileText, Hospital, Loader2, Mail, MapPin, Building2, Phone, Send, UserPlus, X, Languages, BadgeCheck } from 'lucide-react'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { api } from '../../lib/api'

// Le comité décide hors de la plateforme : il n'y a pas d'étape d'examen à
// refaire ici. Restent deux files — ce qu'il faut créer, ce qui est créé — et
// l'archive de ce qui a été écarté.
const ONGLETS = ['A_CREER', 'COMPTE_CREE', 'REFUSEE']

// « À créer » rassemble tout ce qui n'a ni compte ni mise à l'écart, y compris
// les candidatures acceptées avant que l'étape d'acceptation ne disparaisse.
const STATUTS_PAR_ONGLET = {
  A_CREER: ['EN_ATTENTE', 'ACCEPTEE'],
  COMPTE_CREE: ['COMPTE_CREE'],
  REFUSEE: ['REFUSEE'],
}

/**
 * Examen des candidatures (comité scientifique) et création des comptes
 * (coordination). Les deux étapes vivent sur le même écran, séparées par le
 * statut : « à examiner » pour le comité, « acceptées » pour la coordination.
 */
export default function CoordinateurCandidatures() {
  const { t, i18n } = useTranslation()

  const [onglet, setOnglet] = useState('A_CREER')
  const [liste, setListe] = useState([])
  const [compte, setCompte] = useState({})
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [ouverte, setOuverte] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [info, setInfo] = useState(null)

  async function charger({ silencieux = false } = {}) {
    if (!silencieux) setChargement(true)
    try {
      const { data } = await api.get('/candidatures')
      setListe(data)
      const parOnglet = {}
      for (const [cle, statuts] of Object.entries(STATUTS_PAR_ONGLET)) {
        parOnglet[cle] = data.filter((c) => statuts.includes(c.statut)).length
      }
      setCompte(parOnglet)
      setErreur(null)
    } catch (err) {
      setErreur(err.response?.data?.message || t('candidatures.chargementEchoue'))
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function agir(id, action, corps) {
    setEnCours(id)
    setInfo(null)
    try {
      const { data } = await api.post(`/candidatures/${id}/${action}`, corps)
      if (action === 'creer-compte') {
        // Le serveur attend l'envoi avant de répondre : on ne promet un
        // courriel que s'il est parti.
        setInfo(
          data.identifiantsEnvoyes
            ? t('candidatures.compteCreeInfo', { email: data.user.email })
            : t('candidatures.compteCreeSansMail', { email: data.user.email }),
        )
      }
      if (action === 'renvoyer-identifiants') setInfo(t('candidatures.identifiantsRenvoyes', { email: data.email }))
      setOuverte(null)
      await charger({ silencieux: true })
    } catch (err) {
      setErreur(err.response?.data?.message || t('candidatures.actionEchouee'))
    } finally {
      setEnCours(null)
    }
  }

  const visibles = liste.filter((c) => STATUTS_PAR_ONGLET[onglet].includes(c.statut))
  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <CoordinatorLayout>
      <div className="mb-8 animate-fade-in-up">
        <h2 className="text-3xl font-display font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-3">
          <ClipboardList className="w-7 h-7 text-primary-600" /> {t('candidatures.titre')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400">{t('candidatures.sousTitre')}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {ONGLETS.map((s) => (
          <button
            key={s}
            onClick={() => { setOnglet(s); setOuverte(null) }}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              onglet === s
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700'
            }`}
          >
            {t(`candidatures.statuts.${s}`)} ({compte[s] || 0})
          </button>
        ))}
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

      {chargement && (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-12 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {!chargement && visibles.length === 0 && (
        <div className="glass-card rounded-3xl p-10 text-center text-slate-500 dark:text-slate-400">
          {t(`candidatures.vide.${onglet}`)}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {visibles.map((c, idx) => {
          const estOuverte = ouverte === c.id
          return (
            <div
              key={c.id}
              className="glass-card dark:bg-neutral-900 rounded-2xl p-5 animate-fade-in-up"
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <PhotoCandidature id={c.id} nom={c.fullName} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{c.fullName}</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-slate-300">
                      {t(`candidatures.types.${c.type}`)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-primary-700 dark:text-primary-400">{c.specialite}</p>
                  <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {c.email}</span>
                    {c.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {c.phone}</span>}
                    {c.etablissement && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {c.etablissement}</span>}
                    {(c.ville || c.pays) && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {[c.ville, c.pays].filter(Boolean).join(', ')}</span>}
                    {c.langues && <span className="flex items-center gap-1"><Languages className="w-3.5 h-3.5" /> {c.langues}</span>}
                    {c.numeroOrdre && <span className="flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5" /> {c.numeroOrdre}</span>}
                  </div>
                  <LieuExercice candidature={c} />

                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">{t('candidatures.deposeeLe', { date: formatDate(c.createdAt) })}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                    <button
                      onClick={() => setOuverte(estOuverte ? null : c.id)}
                      className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {estOuverte ? t('candidatures.masquerPresentation') : t('candidatures.lirePresentation')}
                    </button>
                    <LienCv id={c.id} aUnCv={Boolean(c.cvKey)} />
                  </div>
                  {estOuverte && (
                    <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line bg-slate-50 dark:bg-neutral-800/60 rounded-xl p-4">
                      {c.presentation}
                    </p>
                  )}

                  {c.statut === 'REFUSEE' && c.motifRefus && (
                    <p className="mt-3 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 rounded-xl p-3">
                      <span className="font-semibold">{t('candidatures.motifRefus')} :</span> {c.motifRefus}
                    </p>
                  )}
                </div>
              </div>

              {/* Le comité a déjà décidé : il ne reste qu'à ouvrir le compte,
                  ou à écarter le candidat qu'il n'a pas retenu. */}
              {STATUTS_PAR_ONGLET.A_CREER.includes(c.statut) && (
                <div className="mt-5 pt-4 border-t border-slate-100/60 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex-1">{t('candidatures.creerAide')}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => agir(c.id, 'ecarter')}
                      disabled={enCours === c.id}
                      className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
                    >
                      <X className="w-4 h-4" /> {t('candidatures.ecarter')}
                    </button>
                    <button
                      onClick={() => agir(c.id, 'creer-compte')}
                      disabled={enCours === c.id}
                      className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      {enCours === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                      {t('candidatures.creerCompte')}
                    </button>
                  </div>
                </div>
              )}

              {c.statut === 'COMPTE_CREE' && (
                <div className="mt-5 pt-4 border-t border-slate-100/60 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center gap-3">
                  <p className="text-sm text-slate-500 dark:text-slate-400 flex-1">{t('candidatures.renvoyerAide')}</p>
                  <button
                    onClick={() => agir(c.id, 'renvoyer-identifiants')}
                    disabled={enCours === c.id}
                    className="text-sm font-semibold px-5 py-2.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {enCours === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t('candidatures.renvoyerIdentifiants')}
                  </button>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </CoordinatorLayout>
  )
}

/**
 * La photo est derrière l'authentification, qu'une balise <img> ne sait pas
 * porter : on la charge avec le client HTTP (qui ajoute le jeton) et on
 * affiche le blob. Un jeton dans l'URL de l'image finirait dans les journaux
 * et les en-têtes Referer.
 */
/**
 * Le lieu d'exercice d'un médecin traitant, avec de quoi joindre la structure.
 * C'est ce que le comité appelle pour vérifier l'exercice, et ce que la
 * coordination relit avant de créer le compte. Absent chez un spécialiste
 * international, qui n'exerce pas dans une structure locale.
 */
function LieuExercice({ candidature: c }) {
  const { t } = useTranslation()
  if (!c.typeStructure) return null

  const structures = []
  if (c.typeStructure !== 'HOPITAL') {
    structures.push({ cle: 'clinique', nom: c.nomClinique, tel: c.telClinique, email: c.emailClinique })
  }
  if (c.typeStructure !== 'CLINIQUE') {
    structures.push({ cle: 'hopital', nom: c.nomHopital, tel: c.telHopital, email: c.emailHopital })
  }

  return (
    <div className="mt-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
        {t('candidatures.lieuExercice')} · {t(`candidatures.structure.${c.typeStructure}`)}
      </p>
      <div className="flex flex-col gap-1.5">
        {structures.map((s) => (
          <div key={s.cle} className="text-sm text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-semibold">
              <Hospital className="w-3.5 h-3.5 text-slate-400" /> {s.nom}
            </span>
            {s.tel && <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Phone className="w-3.5 h-3.5" /> {s.tel}</span>}
            {s.email && <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400"><Mail className="w-3.5 h-3.5" /> {s.email}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Le CV est servi par une URL signée de courte durée, pas par un flux : le PDF
 * s'ouvre dans la visionneuse du navigateur, comme les autres justificatifs.
 * L'URL est demandée au clic — la pré-charger pour toute la liste la ferait
 * expirer avant qu'on s'en serve.
 */
function LienCv({ id, aUnCv }) {
  const { t } = useTranslation()
  const [enCours, setEnCours] = useState(false)

  if (!aUnCv) {
    return <span className="text-sm text-slate-400 dark:text-slate-500">{t('candidatures.cvAucun')}</span>
  }

  async function ouvrir() {
    setEnCours(true)
    try {
      const { data } = await api.get(`/candidatures/${id}/cv`)
      window.open(data.url, '_blank', 'noopener,noreferrer')
    } catch {
      /* le message d'erreur global couvrirait mal un clic isolé */
    } finally {
      setEnCours(false)
    }
  }

  return (
    <button
      onClick={ouvrir}
      disabled={enCours}
      className="text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1.5 disabled:opacity-60"
    >
      {enCours ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
      {t('candidatures.cvVoir')}
    </button>
  )
}

function PhotoCandidature({ id, nom }) {
  const [src, setSrc] = useState(null)

  useEffect(() => {
    let url = null
    let annule = false
    api
      .get(`/candidatures/${id}/photo`, { responseType: 'blob' })
      .then(({ data }) => {
        if (annule) return
        url = URL.createObjectURL(data)
        setSrc(url)
      })
      .catch(() => {})
    return () => {
      annule = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])

  if (!src) {
    return (
      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-neutral-800 shrink-0 flex items-center justify-center text-2xl font-bold text-slate-400 dark:text-neutral-500">
        {nom?.[0] || '?'}
      </div>
    )
  }
  return <img src={src} alt={nom} className="w-20 h-20 rounded-2xl object-cover shrink-0" />
}
