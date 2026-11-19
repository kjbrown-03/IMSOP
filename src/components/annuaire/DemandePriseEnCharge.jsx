import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock, FileText, Loader2, Paperclip, Send, XCircle } from 'lucide-react'
import { api } from '../../lib/api'
import { ouvrirFichier } from '../../lib/fichiers'

const MAX_PIECES = 5
const MAX_OCTETS = 10 * 1024 * 1024
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const PASTILLE = {
  EN_ATTENTE: { icone: Clock, classe: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300' },
  ACCEPTEE: { icone: CheckCircle2, classe: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300' },
  REFUSEE: { icone: XCircle, classe: 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300' },
}

/**
 * Ce que soigne le tradipraticien, en lecture seule, et la demande d'ajout à la
 * coordination. Il ne coche plus ses maladies lui-même : l'annuaire le propose
 * à des inconnus sur la foi de cette liste, c'est la coordination qui en
 * répond.
 */
export default function DemandePriseEnCharge({ specialitesActuelles, toutesSpecialites }) {
  const { t, i18n } = useTranslation()
  const [demandes, setDemandes] = useState(null)
  const [choix, setChoix] = useState([])
  const [motif, setMotif] = useState('')
  const [pieces, setPieces] = useState([])
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [ouvert, setOuvert] = useState(false)

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get('/prises-en-charge/moi')
      setDemandes(data)
    } catch {
      setDemandes([])
    }
  }, [])

  useEffect(() => { charger() }, [charger])

  const enAttente = demandes?.find((d) => d.statut === 'EN_ATTENTE')
  const disponibles = toutesSpecialites.filter((s) => !specialitesActuelles.includes(s))
  const date = (iso) => new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')

  function ajouterPieces(e) {
    setErreur(null)
    const nouveaux = [...e.target.files]
    e.target.value = ''
    // Contrôlé avant l'envoi : un fichier refusé par le serveur ferait perdre
    // tout le formulaire sur une connexion lente.
    for (const f of nouveaux) {
      if (!TYPES.includes(f.type)) return setErreur(t('annuaire.priseEnCharge.erreurFormat'))
      if (f.size > MAX_OCTETS) return setErreur(t('annuaire.priseEnCharge.erreurTaille'))
    }
    setPieces((p) => [...p, ...nouveaux].slice(0, MAX_PIECES))
  }

  async function envoyer(e) {
    e.preventDefault()
    setErreur(null)
    if (choix.length === 0) return setErreur(t('annuaire.priseEnCharge.erreurChoix'))
    if (motif.trim().length < 10) return setErreur(t('annuaire.priseEnCharge.erreurMotif'))
    if (pieces.length === 0) return setErreur(t('annuaire.priseEnCharge.erreurPieces'))
    const corps = new FormData()
    choix.forEach((s) => corps.append('specialites', s))
    corps.append('motif', motif.trim())
    pieces.forEach((f) => corps.append('pieces', f))
    setEnvoi(true)
    try {
      await api.post('/prises-en-charge', corps)
      setChoix([])
      setMotif('')
      setPieces([])
      setOuvert(false)
      await charger()
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.priseEnCharge.erreurEnvoi'))
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <section className="glass-card rounded-2xl p-5 flex flex-col gap-4">
      <h2 className="font-semibold text-slate-900 dark:text-white">{t('annuaire.priseEnCharge.titre')}</h2>
      <p className="text-sm text-slate-500 dark:text-neutral-400">{t('annuaire.priseEnCharge.aide')}</p>

      {specialitesActuelles.length === 0 ? (
        <p className="text-sm italic text-slate-500 dark:text-neutral-400">{t('annuaire.priseEnCharge.aucune')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {specialitesActuelles.map((cle) => (
            <span key={cle} className="rounded-full px-3.5 py-1.5 text-sm font-medium bg-primary-600 text-white">
              {t(`annuaire.specialites.${cle}`)}
            </span>
          ))}
        </div>
      )}

      {enAttente ? (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm px-4 py-3 flex gap-2 items-start">
          <Clock className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {t('annuaire.priseEnCharge.enCours', {
              date: date(enAttente.createdAt),
              liste: enAttente.specialites.map((s) => t(`annuaire.specialites.${s}`)).join(', '),
            })}
          </span>
        </div>
      ) : disponibles.length > 0 && !ouvert ? (
        <button
          type="button"
          onClick={() => setOuvert(true)}
          className="self-start inline-flex items-center gap-2 rounded-full border border-primary-600 text-primary-700 dark:text-primary-300 px-4 py-2 text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-950/30"
        >
          <Send className="w-4 h-4" /> {t('annuaire.priseEnCharge.demander')}
        </button>
      ) : null}

      {/* Pas de <form> ici : ce bloc vit dans le formulaire de la fiche, et un
          formulaire ne peut pas en contenir un autre. Les boutons sont donc de
          type « button » : envoyer la demande ne doit pas enregistrer la fiche,
          ni l'inverse. */}
      {ouvert && !enAttente && (
        <div className="border-t border-slate-200/70 dark:border-neutral-700/70 pt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{t('annuaire.priseEnCharge.choix')}</span>
            <div className="flex flex-wrap gap-2">
              {disponibles.map((cle) => {
                const actif = choix.includes(cle)
                return (
                  <button
                    key={cle}
                    type="button"
                    aria-pressed={actif}
                    onClick={() => setChoix((c) => (actif ? c.filter((s) => s !== cle) : [...c, cle].slice(0, 6)))}
                    className={`rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors ${
                      actif
                        ? 'bg-primary-600 border-primary-600 text-white'
                        : 'bg-white dark:bg-neutral-800 border-slate-300 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:border-primary-400'
                    }`}
                  >
                    {t(`annuaire.specialites.${cle}`)}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{t('annuaire.priseEnCharge.motif')}</span>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t('annuaire.priseEnCharge.motifExemple')}
              className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white resize-y"
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{t('annuaire.priseEnCharge.pieces')}</span>
            <span className="text-xs text-slate-500 dark:text-neutral-400">{t('annuaire.priseEnCharge.piecesAide')}</span>
            {pieces.length > 0 && (
              <ul className="flex flex-col gap-1">
                {pieces.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-slate-700 dark:text-neutral-200">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setPieces((p) => p.filter((_, j) => j !== i))}
                      className="ml-auto text-xs text-rose-600 hover:underline"
                    >
                      {t('annuaire.priseEnCharge.retirer')}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pieces.length < MAX_PIECES && (
              <label className="self-start inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-slate-300 dark:border-neutral-600 px-3 py-2 text-sm text-slate-600 dark:text-neutral-300 hover:border-primary-400">
                <Paperclip className="w-4 h-4" /> {t('annuaire.priseEnCharge.ajouterPiece')}
                <input type="file" accept={TYPES.join(',')} multiple onChange={ajouterPieces} className="sr-only" />
              </label>
            )}
          </div>

          {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={envoyer}
              disabled={envoi}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-60"
            >
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('annuaire.priseEnCharge.envoyer')}
            </button>
            <button type="button" onClick={() => { setOuvert(false); setErreur(null) }} className="text-sm text-slate-500 hover:underline">
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {demandes?.some((d) => d.statut !== 'EN_ATTENTE') && (
        <div className="border-t border-slate-200/70 dark:border-neutral-700/70 pt-4 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
            {t('annuaire.priseEnCharge.historique')}
          </span>
          {demandes.filter((d) => d.statut !== 'EN_ATTENTE').map((d) => {
            const { icone: Icone, classe } = PASTILLE[d.statut]
            return (
              <div key={d.id} className={`rounded-xl px-4 py-3 text-sm flex flex-col gap-1 ${classe}`}>
                <span className="flex items-center gap-2 font-semibold">
                  <Icone className="w-4 h-4" />
                  {t(`annuaire.priseEnCharge.statuts.${d.statut}`)} · {date(d.traiteLe || d.createdAt)}
                </span>
                <span>{d.specialites.map((s) => t(`annuaire.specialites.${s}`)).join(', ')}</span>
                {d.motifRefus && <span className="italic">{d.motifRefus}</span>}
                {d.pieces.length > 0 && (
                  <span className="flex flex-wrap gap-2 text-xs">
                    {d.pieces.map((p) => (
                      <button key={p.id} type="button" onClick={() => ouvrirFichier(`/prises-en-charge/pieces/${p.id}`)} className="underline">
                        {p.filename}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
