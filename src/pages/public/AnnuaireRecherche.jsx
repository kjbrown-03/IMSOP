import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, MapPin, Search, ShieldCheck } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'
import { api } from '../../lib/api'

const CHAMP =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors'

/**
 * « Trouver un médecin » — première étape : décrire ses symptômes et dire où
 * l'on est. Ouvert sans compte : la recherche donne un nombre et des fiches
 * floutées, c'est au moment de payer qu'il faudra se connecter.
 */
export default function AnnuaireRecherche() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [referentiels, setReferentiels] = useState(null)
  const [symptomes, setSymptomes] = useState('')
  const [pays, setPays] = useState('cm')
  const [ville, setVille] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    api.get('/annuaire/referentiels').then(({ data }) => setReferentiels(data)).catch(() => setReferentiels({ pays: [] }))
  }, [])

  const villes = useMemo(() => referentiels?.pays.find((p) => p.code === pays)?.villes ?? [], [referentiels, pays])

  // Changer de pays invalide la ville : « Douala » n'est pas au Gabon.
  useEffect(() => { setVille('') }, [pays])

  const SYMPTOMES_MIN = 10
  const tropCourt = symptomes.trim().length > 0 && symptomes.trim().length < SYMPTOMES_MIN

  async function rechercher(e) {
    e.preventDefault()
    if (envoi) return
    // On ne grise pas le bouton pour ça : on explique. Un bouton inerte sans
    // raison visible laisse la personne chercher ce qui bloque.
    if (symptomes.trim().length < SYMPTOMES_MIN) {
      setErreur(t('annuaire.recherche.tropCourt', { min: SYMPTOMES_MIN }))
      return
    }
    setEnvoi(true)
    setErreur(null)
    try {
      const { data } = await api.post('/annuaire/recherches', {
        symptomes: symptomes.trim(),
        pays,
        ...(ville ? { ville } : {}),
      })
      // Retenue localement : la personne n'a peut-être pas de compte, et doit
      // pouvoir retrouver sa recherche après s'être connectée pour payer.
      try { localStorage.setItem('imsop.annuaire.derniereRecherche', data.id) } catch { /* stockage indisponible : on continue */ }
      navigate(`/annuaire/${data.id}`)
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.recherche.erreur'))
      setEnvoi(false)
    }
  }

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-body-md min-h-screen transition-colors duration-300">
      <Navbar />
      <main className="pt-16 pb-28 md:pb-16">
        <section className="w-full py-14 px-margin-mobile md:px-margin-desktop bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <div className="max-w-[760px] mx-auto text-center">
            <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
              {t('annuaire.recherche.eyebrow')}
            </span>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-primary)] mt-2">
              {t('annuaire.recherche.titre')}
            </h1>
            <p className="font-body-lg text-body-lg text-[var(--color-text-secondary)] mt-4">
              {t('annuaire.recherche.intro')}
            </p>
          </div>
        </section>

        <section className="max-w-[760px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
          <form onSubmit={rechercher} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t('annuaire.recherche.symptomes')}</span>
              <textarea
                value={symptomes}
                onChange={(e) => setSymptomes(e.target.value)}
                rows={5}
                maxLength={2000}
                required
                placeholder={t('annuaire.recherche.symptomesPlaceholder')}
                className={CHAMP + ' resize-y'}
              />
              <span className={`text-xs ${tropCourt ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--color-text-secondary)]'}`}>
                {tropCourt ? t('annuaire.recherche.tropCourt', { min: SYMPTOMES_MIN }) : t('annuaire.recherche.symptomesAide')}
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">{t('annuaire.recherche.pays')}</span>
                <select value={pays} onChange={(e) => setPays(e.target.value)} className={CHAMP} disabled={!referentiels}>
                  {(referentiels?.pays ?? []).map((p) => (
                    <option key={p.code} value={p.code}>{p.nom}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold">
                  {t('annuaire.recherche.ville')}{' '}
                  <span className="font-normal text-[var(--color-text-secondary)]">({t('annuaire.recherche.optionnel')})</span>
                </span>
                <select value={ville} onChange={(e) => setVille(e.target.value)} className={CHAMP} disabled={!referentiels}>
                  <option value="">{t('annuaire.recherche.villeToutes')}</option>
                  {villes.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </label>
            </div>

            <div className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-container-low)] border border-[var(--color-border)] p-4 text-sm text-[var(--color-text-secondary)]">
              <ShieldCheck className="w-5 h-5 shrink-0 text-[var(--color-secondary)] mt-0.5" />
              <p>{t('annuaire.recherche.noteUrgence')}</p>
            </div>

            {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}

            <button
              type="submit"
              disabled={envoi || symptomes.trim().length === 0}
              className="self-start inline-flex items-center gap-2 bg-[var(--color-primary)] text-white rounded-full px-7 py-3.5 font-bold text-sm tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {t('annuaire.recherche.lancer')}
            </button>

            {referentiels?.tarif && (
              <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {t('annuaire.recherche.tarifNote', { montant: referentiels.tarif.amount.toLocaleString('fr-FR'), devise: referentiels.tarif.currency })}
              </p>
            )}
          </form>
        </section>
      </main>
    </div>
  )
}
