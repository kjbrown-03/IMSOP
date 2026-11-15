import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Info, Loader2, MapPin, Search } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'
import EnregistreurVocal from '../../components/ui/EnregistreurVocal'
import { api } from '../../lib/api'
import ChoixLieu from '../../components/annuaire/ChoixLieu'

const CHAMP =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors'

/**
 * « Trouver un médecin » — première étape : décrire ses symptômes et dire où
 * l'on est. Ouvert sans compte : la recherche donne un nombre et des fiches
 * floutées, c'est au moment de payer qu'il faudra se connecter.
 */
/**
 * La voie choisie à l'écran précédent est passée par la route, pas déduite du
 * chemin.
 *
 * Une version précédente la lisait avec `useParams()`. Les routes
 * `/annuaire/conventionnel` et `/annuaire/traditionnel` sont littérales : elles
 * ne contiennent aucun segment dynamique, donc `useParams()` ne renvoyait rien
 * et le repli ramenait TOUJOURS au conventionnel. Les deux parcours affichaient
 * le même texte — et, plus grave, la recherche interrogeait les médecins
 * conventionnels même depuis la voie traditionnelle, sans que rien ne le
 * signale.
 *
 * Avec une propriété, la route déclare ce qu'elle ouvre et une erreur de
 * câblage se voit au lieu de se deviner.
 */
export default function AnnuaireRecherche({ typePratique = 'CONVENTIONNEL' }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const prefixe = `annuaire.recherche.${typePratique}`

  const [referentiels, setReferentiels] = useState(null)
  const [symptomes, setSymptomes] = useState('')
  const [lieu, setLieu] = useState({ pays: 'cm', ville: '', region: '', departement: '', arrondissement: '' })
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)

  useEffect(() => {
    api.get('/annuaire/referentiels').then(({ data }) => setReferentiels(data)).catch(() => setReferentiels({ pays: [] }))
  }, [])

  // Toute la zone CEMAC est proposée, mais la mise en relation ne se paie
  // aujourd'hui qu'au Cameroun. Ailleurs on le dit, et on n'affiche pas un
  // bouton de recherche qui aboutirait à un paiement impossible.
  const paysChoisi = referentiels?.pays.find((p) => p.code === lieu.pays)
  const paysFerme = Boolean(paysChoisi) && !paysChoisi.ouvert

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
    // La région suffit à classer par proximité ; sans elle, « le plus proche »
    // ne voudrait plus rien dire.
    if (lieu.pays === 'cm' && !lieu.region) {
      setErreur(t('annuaire.lieu.regionRequise'))
      return
    }
    setEnvoi(true)
    setErreur(null)
    try {
      const { data } = await api.post('/annuaire/recherches', {
        symptomes: symptomes.trim(),
        pays: lieu.pays,
        typePratique,
        ...(lieu.pays === 'cm'
          ? Object.fromEntries(['region', 'departement', 'arrondissement'].filter((k) => lieu[k]).map((k) => [k, lieu[k]]))
          : lieu.ville ? { ville: lieu.ville } : {}),
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
          <div className="max-w-[760px] mx-auto">
            <Link
              to="/annuaire"
              className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              {t('annuaire.recherche.retourAccueil')}
            </Link>
          </div>
          <div className="max-w-[760px] mx-auto text-center">
            <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
              {t(`${prefixe}.eyebrow`)}
            </span>
            <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[var(--color-primary)] mt-2">
              {t(`${prefixe}.titre`)}
            </h1>
            <p className="font-body-lg text-body-lg text-[var(--color-text-secondary)] mt-4">
              {t(`${prefixe}.intro`)}
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
                
                className={CHAMP + ' resize-y'}
              />
              {tropCourt && (
                <span className="text-xs text-amber-700 dark:text-amber-400">
                  {t('annuaire.recherche.tropCourt', { min: SYMPTOMES_MIN })}
                </span>
              )}
            </label>

            {/* Le bouton est hors du <label> : un clic dessus ne doit pas donner
                le focus au champ de texte, qui ferait remonter le clavier du
                téléphone par-dessus l'enregistrement en cours. */}
            <EnregistreurVocal
              langue={i18n.language?.startsWith('en') ? 'en' : 'fr'}
              desactive={envoi}
              onTexte={(texte) =>
                // On complète plutôt qu'on écrase : quelqu'un qui a commencé à
                // écrire puis dicte la suite ne doit pas perdre son début.
                setSymptomes((actuel) => (actuel.trim() ? `${actuel.trim()} ${texte}` : texte))
              }
            />

            <ChoixLieu referentiels={referentiels} valeur={lieu} onChange={setLieu} classeChamp={CHAMP} geolocalisation />

            {paysFerme && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm px-4 py-3">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                {t('annuaire.lieu.paysFerme', { pays: paysChoisi.nom })}
              </p>
            )}

            {erreur && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}

            {!paysFerme && (
              <button
                type="submit"
                disabled={envoi || symptomes.trim().length === 0}
                className="self-start inline-flex items-center gap-2 bg-[var(--color-primary)] text-white rounded-full px-7 py-3.5 font-bold text-sm tracking-wide hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {t(`${prefixe}.lancer`)}
              </button>
            )}

            {referentiels?.tarif && !paysFerme && (
              <p className="text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                {t('annuaire.recherche.tarifNote', {
                  montant: referentiels.tarif.amount.toLocaleString('fr-FR'),
                  base: referentiels.tarif.baseAmount.toLocaleString('fr-FR'),
                  frais: referentiels.tarif.fraisEstimes.toLocaleString('fr-FR'),
                  devise: referentiels.tarif.currency,
                })}
              </p>
            )}
          </form>
        </section>
      </main>
    </div>
  )
}
