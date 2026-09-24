import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Banknote, CheckCircle2, Loader2, Smartphone, Landmark, AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../../lib/api'

const STATUTS = ['A_REVERSER', 'ECHOUE', 'REVERSE']

const STYLE_STATUT = {
  A_REVERSER: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  EN_COURS: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  REVERSE: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
  ECHOUE: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
}

const formater = (n, devise) =>
  `${Number(n).toLocaleString('fr-FR', { maximumFractionDigits: devise === 'XAF' || devise === 'XOF' ? 0 : 2 })} ${devise}`

/**
 * Relevé d'honoraires et reversements aux spécialistes.
 *
 * Deux façons de payer, selon le pays : la plateforme décaisse elle-même en
 * Mobile Money (Fapshi) pour le Cameroun ; pour l'Europe, le virement se fait
 * à la banque et n'est qu'enregistré ici, avec sa référence. Le relevé est le
 * même dans les deux cas.
 */
export default function Reversements() {
  const { t, i18n } = useTranslation()
  const [statut, setStatut] = useState('A_REVERSER')
  const [synthese, setSynthese] = useState([])
  const [lignes, setLignes] = useState([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [enCours, setEnCours] = useState(null)
  const [references, setReferences] = useState({})
  const [messages, setMessages] = useState({})

  async function charger() {
    setChargement(true)
    try {
      const [{ data: s }, { data: l }] = await Promise.all([
        api.get('/honoraires/synthese'),
        api.get('/honoraires', { params: { statut } }),
      ])
      setSynthese(s)
      setLignes(l)
      setErreur(null)
    } catch (err) {
      setErreur(err.response?.data?.message || t('coordinateur.reversements.chargementEchoue'))
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    charger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statut])

  async function reverser(ligne) {
    setEnCours(ligne.id)
    setMessages((m) => ({ ...m, [ligne.id]: null }))
    try {
      const corps = ligne.canal === 'FAPSHI' ? {} : { reference: (references[ligne.id] || '').trim() }
      await api.post(`/honoraires/${ligne.id}/reverser`, corps)
      setMessages((m) => ({ ...m, [ligne.id]: { ok: true } }))
      await charger()
    } catch (err) {
      setMessages((m) => ({ ...m, [ligne.id]: { ok: false, texte: err.response?.data?.message || t('coordinateur.reversements.echec') } }))
    } finally {
      setEnCours(null)
    }
  }

  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const date = (iso) => (iso ? new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—')

  return (
    <>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary-600" /> {t('coordinateur.reversements.titre')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('coordinateur.reversements.sousTitre')}</p>
        </div>
        <button
          onClick={charger}
          className="self-start inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-700 hover:bg-slate-50 dark:hover:bg-neutral-700"
        >
          <RefreshCw className={`w-4 h-4 ${chargement ? 'animate-spin' : ''}`} /> {t('common.refresh')}
        </button>
      </div>

      {erreur && (
        <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-sm font-medium rounded-2xl px-5 py-4 mb-6">
          {erreur}
        </div>
      )}

      {/* ---------- Synthèse : ce qui est dû, par spécialiste ---------- */}
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
        {t('coordinateur.reversements.syntheseTitre')}
      </h3>
      {synthese.length === 0 && !chargement ? (
        <div className="glass-card rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400 mb-10">
          {t('coordinateur.reversements.rienADevoir')}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {synthese.map((s) => (
            <div key={s.specialiste.id} className="glass-card dark:bg-neutral-900 rounded-3xl p-5 flex flex-col gap-2 animate-fade-in-up">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-900 dark:text-white truncate">Dr. {s.specialiste.user.fullName}</span>
                {s.canal === 'FAPSHI' ? (
                  <Smartphone className="w-4 h-4 text-primary-600 shrink-0" title={t('coordinateur.reversements.canalFapshi')} />
                ) : (
                  <Landmark className="w-4 h-4 text-slate-400 shrink-0" title={t('coordinateur.reversements.canalVirement')} />
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{s.specialiste.specialite} · {s.specialiste.pays}</div>
              <div className="text-2xl font-display font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                {formater(s.total, s.devise)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('coordinateur.reversements.dossiers', { count: s.dossiers })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Détail : une ligne par avis ---------- */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('coordinateur.reversements.detailTitre')}
        </h3>
        <div className="flex gap-1">
          {STATUTS.map((s) => (
            <button
              key={s}
              onClick={() => setStatut(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statut === s
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-white dark:bg-neutral-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-neutral-700'
              }`}
            >
              {t(`coordinateur.reversements.statuts.${s}`)}
            </button>
          ))}
        </div>
      </div>

      {chargement && lignes.length === 0 && (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 py-8 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {!chargement && lignes.length === 0 && (
        <div className="glass-card rounded-3xl p-8 text-center text-slate-500 dark:text-slate-400">
          {t('coordinateur.reversements.aucuneLigne')}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {lignes.map((h) => {
          const message = messages[h.id]
          return (
            <div key={h.id} className="glass-card dark:bg-neutral-900 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center gap-4 animate-fade-in-up">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md">#{h.dossier.reference}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${STYLE_STATUT[h.statut]}`}>
                    {t(`coordinateur.reversements.statuts.${h.statut}`)}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white truncate">Dr. {h.specialiste.user.fullName}</div>
                {/* La ventilation complète : ce que le patient a payé, ce que la
                    plateforme garde, ce qui part au spécialiste. */}
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
                  {t('coordinateur.reversements.ventilation', {
                    brut: formater(h.montantBrut, h.deviseBrut),
                    commission: formater(h.commission, h.deviseBrut),
                    taux: Number(h.tauxCommission),
                  })}
                </div>
                {h.motifEchec && (
                  <div className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {h.motifEchec}
                  </div>
                )}
              </div>

              <div className="text-right lg:w-40 shrink-0">
                <div className="text-xl font-display font-bold text-slate-900 dark:text-white tabular-nums">
                  {formater(h.montantNetDevise, h.deviseNet)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {h.statut === 'REVERSE' ? `${t('coordinateur.reversements.reverseLe')} ${date(h.reverseLe)}` : t('coordinateur.reversements.net')}
                </div>
              </div>

              {h.statut !== 'REVERSE' && h.statut !== 'EN_COURS' && (
                <div className="flex flex-col sm:flex-row gap-2 lg:w-80 shrink-0">
                  {h.canal === 'FAPSHI' ? (
                    <button
                      onClick={() => reverser(h)}
                      disabled={enCours === h.id}
                      className="flex-1 inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-50 transition-colors disabled:opacity-60"
                    >
                      {enCours === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                      {t('coordinateur.reversements.reverserFapshi')}
                    </button>
                  ) : (
                    <>
                      <input
                        value={references[h.id] || ''}
                        onChange={(e) => setReferences((r) => ({ ...r, [h.id]: e.target.value }))}
                        placeholder={t('coordinateur.reversements.referencePlaceholder')}
                        className="flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                      />
                      <button
                        onClick={() => reverser(h)}
                        disabled={enCours === h.id || (references[h.id] || '').trim().length < 3}
                        className="inline-flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-600 dark:hover:bg-primary-50 transition-colors disabled:opacity-60"
                      >
                        {enCours === h.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Landmark className="w-4 h-4" />}
                        {t('coordinateur.reversements.enregistrerVirement')}
                      </button>
                    </>
                  )}
                </div>
              )}

              {message && (
                <div className={`text-xs font-semibold flex items-center gap-1 ${message.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {message.ok ? t('coordinateur.reversements.fait') : message.texte}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
