import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Eye, EyeOff, Loader2, MapPin, ShieldAlert } from 'lucide-react'
import MedecinShell from '../../components/layout/MedecinShell'
import { api } from '../../lib/api'

const CHAMP =
  'w-full rounded-lg border border-slate-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white'

/**
 * Réglages du médecin pour l'annuaire « Trouver un médecin ». Apparaître y est
 * un choix : la case est décochée par défaut, et un médecin non habilité peut
 * préparer sa fiche mais pas se rendre visible.
 */
export default function AnnuaireMedecin() {
  const { t } = useTranslation()

  const [referentiels, setReferentiels] = useState(null)
  const [reglages, setReglages] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState(null)
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    let annule = false
    Promise.all([api.get('/annuaire/referentiels'), api.get('/annuaire/medecin/moi')])
      .then(([r, m]) => {
        if (annule) return
        setReferentiels(r.data)
        // Le pays de l'inscription est en texte libre : on ne le garde que s'il
        // correspond à un code de la liste, sinon le médecin devra choisir.
        const codes = r.data.pays.map((p) => p.code)
        const paysBrut = (m.data.pays || '').toLowerCase()
        setReglages({
          annuaireVisible: m.data.annuaireVisible,
          annuaireSpecialites: m.data.annuaireSpecialites || [],
          pays: codes.includes(paysBrut) ? paysBrut : '',
          ville: m.data.ville || '',
          quartier: m.data.quartier || '',
          annuairePresentation: m.data.annuairePresentation || '',
          verificationStatus: m.data.verificationStatus,
        })
      })
      .catch((err) => { if (!annule) setErreur(err.response?.data?.message || t('annuaire.medecin.erreurChargement')) })
      .finally(() => { if (!annule) setChargement(false) })
    return () => { annule = true }
  }, [t])

  const villes = useMemo(
    () => referentiels?.pays.find((p) => p.code === reglages?.pays)?.villes ?? [],
    [referentiels, reglages?.pays],
  )

  const habilite = reglages?.verificationStatus === 'VALIDE'

  function modifier(champ, valeur) {
    setEnregistre(false)
    setReglages((r) => {
      const suivant = { ...r, [champ]: valeur }
      // Changer de pays invalide la ville.
      if (champ === 'pays' && valeur !== r.pays) suivant.ville = ''
      return suivant
    })
  }

  function basculerSpecialite(cle) {
    setEnregistre(false)
    setReglages((r) => ({
      ...r,
      annuaireSpecialites: r.annuaireSpecialites.includes(cle)
        ? r.annuaireSpecialites.filter((s) => s !== cle)
        : [...r.annuaireSpecialites, cle],
    }))
  }

  async function enregistrer(e) {
    e.preventDefault()
    setEnregistrement(true)
    setErreur(null)
    try {
      const { data } = await api.put('/annuaire/medecin/moi', {
        annuaireVisible: reglages.annuaireVisible,
        annuaireSpecialites: reglages.annuaireSpecialites,
        ...(reglages.pays ? { pays: reglages.pays } : {}),
        ville: reglages.ville || null,
        quartier: reglages.quartier || null,
        annuairePresentation: reglages.annuairePresentation || null,
      })
      setReglages((r) => ({ ...r, ...data, pays: data.pays || r.pays, ville: data.ville || '', quartier: data.quartier || '', annuairePresentation: data.annuairePresentation || '' }))
      setEnregistre(true)
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.medecin.erreurEnregistrement'))
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <MedecinShell>
      <section className="flex flex-col gap-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <MapPin className="w-7 h-7 text-primary-600" /> {t('annuaire.medecin.titre')}
        </h1>
        <p className="text-slate-500 dark:text-neutral-400 text-sm">{t('annuaire.medecin.sousTitre')}</p>
      </section>

      {chargement && (
        <div className="glass-card rounded-2xl p-8 text-center text-slate-500 dark:text-neutral-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> {t('common.loading')}
        </div>
      )}

      {erreur && !reglages && (
        <div className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-sm rounded-xl px-4 py-3">{erreur}</div>
      )}

      {reglages && referentiels && (
        <form onSubmit={enregistrer} className="flex flex-col gap-5 max-w-3xl">
          {!habilite && (
            <div className="glass-card bg-amber-50/80 dark:bg-amber-950/30 border-amber-200/60 rounded-2xl p-4 flex gap-3 items-start">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">{t('annuaire.medecin.nonHabilite')}</p>
            </div>
          )}

          <label className={`glass-card rounded-2xl p-5 flex items-start gap-4 cursor-pointer ${!habilite ? 'opacity-60' : ''}`}>
            <input
              type="checkbox"
              checked={reglages.annuaireVisible}
              disabled={!habilite}
              onChange={(e) => modifier('annuaireVisible', e.target.checked)}
              className="mt-1 h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="flex flex-col gap-1">
              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                {reglages.annuaireVisible ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                {t('annuaire.medecin.visibleLabel')}
              </span>
              <span className="text-sm text-slate-500 dark:text-neutral-400">{t('annuaire.medecin.visibleAide')}</span>
            </span>
          </label>

          <section className="glass-card rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t('annuaire.medecin.specialitesTitre')}</h2>
            <p className="text-sm text-slate-500 dark:text-neutral-400">{t('annuaire.medecin.specialitesAide')}</p>
            <div className="flex flex-wrap gap-2">
              {referentiels.specialites.map((cle) => {
                const actif = reglages.annuaireSpecialites.includes(cle)
                return (
                  <button
                    key={cle}
                    type="button"
                    onClick={() => basculerSpecialite(cle)}
                    aria-pressed={actif}
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
          </section>

          <section className="glass-card rounded-2xl p-5 flex flex-col gap-4">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t('annuaire.medecin.localisationTitre')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{t('annuaire.recherche.pays')}</span>
                <select value={reglages.pays} onChange={(e) => modifier('pays', e.target.value)} className={CHAMP}>
                  <option value="">{t('annuaire.medecin.choisir')}</option>
                  {referentiels.pays.map((p) => <option key={p.code} value={p.code}>{p.nom}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{t('annuaire.recherche.ville')}</span>
                <select value={reglages.ville} onChange={(e) => modifier('ville', e.target.value)} className={CHAMP} disabled={!reglages.pays}>
                  <option value="">{t('annuaire.medecin.choisir')}</option>
                  {villes.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-slate-600 dark:text-neutral-300">{t('annuaire.medecin.quartier')}</span>
                <input
                  type="text"
                  value={reglages.quartier}
                  onChange={(e) => modifier('quartier', e.target.value)}
                  maxLength={120}
                  placeholder={t('annuaire.medecin.quartierPlaceholder')}
                  className={CHAMP}
                />
              </label>
            </div>
          </section>

          <section className="glass-card rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="font-semibold text-slate-900 dark:text-white">{t('annuaire.medecin.presentationTitre')}</h2>
            <textarea
              value={reglages.annuairePresentation}
              onChange={(e) => modifier('annuairePresentation', e.target.value)}
              rows={3}
              maxLength={600}
              placeholder={t('annuaire.medecin.presentationPlaceholder')}
              className={CHAMP + ' resize-y'}
            />
          </section>

          {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={enregistrement}
              className="inline-flex items-center gap-2 rounded-full bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 text-sm font-bold disabled:opacity-60"
            >
              {enregistrement && <Loader2 className="w-4 h-4 animate-spin" />}
              {t('common.save')}
            </button>
            {enregistre && (
              <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> {t('annuaire.medecin.enregistre')}
              </span>
            )}
          </div>
        </form>
      )}
    </MedecinShell>
  )
}
