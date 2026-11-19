import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, FileText, Loader2, MapPin, Phone, XCircle } from 'lucide-react'
import CoordinatorLayout from '../../components/layout/CoordinatorLayout'
import { api } from '../../lib/api'
import { ouvrirFichier } from '../../lib/fichiers'

const STATUTS = ['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE']

/**
 * Demandes d'ajout de maladies prises en charge par les tradipraticiens.
 * Accepter écrit les maladies sur la fiche d'annuaire : à partir de là, des
 * patients qui ne connaissent pas ce praticien lui seront adressés pour elles.
 */
export default function CoordinateurPrisesEnCharge() {
  const { t, i18n } = useTranslation()
  const [statut, setStatut] = useState('EN_ATTENTE')
  const [items, setItems] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [refusEnCours, setRefusEnCours] = useState(null)
  const [motifRefus, setMotifRefus] = useState('')
  const [occupe, setOccupe] = useState(null)

  const charger = useCallback(async () => {
    setChargement(true)
    setErreur(null)
    try {
      const { data } = await api.get('/prises-en-charge', { params: { statut } })
      setItems(data)
    } catch (err) {
      setErreur(err.response?.data?.message || t('coordinateur.prisesEnCharge.erreurChargement'))
    } finally {
      setChargement(false)
    }
  }, [statut, t])

  useEffect(() => { charger() }, [charger])

  async function decider(id, decision) {
    setOccupe(id)
    setErreur(null)
    try {
      await api.post(`/prises-en-charge/${id}/decision`, {
        decision,
        ...(decision === 'REFUSEE' ? { motifRefus: motifRefus.trim() } : {}),
      })
      setRefusEnCours(null)
      setMotifRefus('')
      await charger()
    } catch (err) {
      setErreur(err.response?.data?.message || t('coordinateur.prisesEnCharge.erreurDecision'))
    } finally {
      setOccupe(null)
    }
  }

  const date = (iso) => new Date(iso).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'fr-FR')
  const nomsDe = (liste) => liste.map((s) => t(`annuaire.specialites.${s}`)).join(', ')

  return (
    <CoordinatorLayout>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          {t('coordinateur.prisesEnCharge.titre')}
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm leading-relaxed max-w-2xl">
          {t('coordinateur.prisesEnCharge.sousTitre')}
        </p>
      </section>

      <div className="flex gap-2 flex-wrap">
        {STATUTS.map((s) => (
          <button
            key={s}
            onClick={() => setStatut(s)}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl border transition-colors ${
              statut === s
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700'
            }`}
          >
            {t(`annuaire.priseEnCharge.statuts.${s}`)}
          </button>
        ))}
      </div>

      {erreur && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">{erreur}</div>
      )}

      {chargement && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {!chargement && items.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center text-slate-500 dark:text-neutral-400 text-sm">
          {t('coordinateur.prisesEnCharge.vide')}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!chargement && items.map((d) => {
          const praticien = d.medecinLocal.user
          const lieu = [d.medecinLocal.quartier, d.medecinLocal.arrondissement, d.medecinLocal.departement, d.medecinLocal.region, d.medecinLocal.ville]
            .filter(Boolean).join(', ')
          return (
            <article key={d.id} className="glass-card rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-slate-900 dark:text-white">{praticien.fullName}</h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 flex flex-wrap gap-x-3 gap-y-1">
                  <span>{praticien.email}</span>
                  {praticien.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{praticien.phone}</span>}
                  {lieu && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{lieu}</span>}
                  <span>{t('coordinateur.prisesEnCharge.deposeeLe', { date: date(d.createdAt) })}</span>
                </p>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500">{t('coordinateur.prisesEnCharge.actuelles')}</dt>
                  <dd className="text-slate-700 dark:text-neutral-200">{d.medecinLocal.annuaireSpecialites.length ? nomsDe(d.medecinLocal.annuaireSpecialites) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500">{t('coordinateur.prisesEnCharge.demandees')}</dt>
                  <dd className="font-semibold text-primary-700 dark:text-primary-300">{nomsDe(d.specialites)}</dd>
                </div>
              </dl>

              <div>
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 dark:text-neutral-500">{t('coordinateur.prisesEnCharge.motif')}</span>
                <p className="text-sm text-slate-700 dark:text-neutral-200 whitespace-pre-line">{d.motif}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {d.pieces.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => ouvrirFichier(`/prises-en-charge/pieces/${p.id}`).catch(() => setErreur(t('coordinateur.prisesEnCharge.erreurPiece')))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 px-3 py-1.5 text-xs text-slate-700 dark:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-800"
                  >
                    <FileText className="w-3.5 h-3.5" /> {p.filename}
                  </button>
                ))}
              </div>

              {d.statut === 'REFUSEE' && d.motifRefus && (
                <p className="text-sm text-rose-700 dark:text-rose-300">{t('coordinateur.prisesEnCharge.refuseeCar')} {d.motifRefus}</p>
              )}
              {d.statut !== 'EN_ATTENTE' && d.traiteLe && (
                <p className="text-xs text-slate-500 dark:text-neutral-400">{t('coordinateur.prisesEnCharge.traiteeLe', { date: date(d.traiteLe) })}</p>
              )}

              {d.statut === 'EN_ATTENTE' && (
                refusEnCours === d.id ? (
                  <div className="flex flex-col gap-2 border-t border-slate-200/70 dark:border-neutral-700/70 pt-4">
                    <label className="text-xs font-semibold text-slate-600 dark:text-neutral-300" htmlFor={`refus-${d.id}`}>
                      {t('coordinateur.prisesEnCharge.motifRefus')}
                    </label>
                    <textarea
                      id={`refus-${d.id}`}
                      value={motifRefus}
                      onChange={(e) => setMotifRefus(e.target.value)}
                      rows={2}
                      maxLength={1000}
                      className="w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm text-slate-900 dark:text-white"
                    />
                    <div className="flex gap-3 items-center">
                      <button
                        type="button"
                        disabled={occupe === d.id || motifRefus.trim().length < 5}
                        onClick={() => decider(d.id, 'REFUSEE')}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
                      >
                        {occupe === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        {t('coordinateur.prisesEnCharge.confirmerRefus')}
                      </button>
                      <button type="button" onClick={() => setRefusEnCours(null)} className="text-sm text-slate-500 hover:underline">
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 flex-wrap border-t border-slate-200/70 dark:border-neutral-700/70 pt-4">
                    <button
                      type="button"
                      disabled={occupe === d.id}
                      onClick={() => decider(d.id, 'ACCEPTEE')}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
                    >
                      {occupe === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {t('coordinateur.prisesEnCharge.accepter')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRefusEnCours(d.id); setMotifRefus('') }}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-300 text-rose-700 dark:text-rose-300 px-4 py-2 text-sm font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <XCircle className="w-4 h-4" /> {t('coordinateur.prisesEnCharge.refuser')}
                    </button>
                  </div>
                )
              )}
            </article>
          )
        })}
      </div>
    </CoordinatorLayout>
  )
}
