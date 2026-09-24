import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building2, Loader2, Lock, LockOpen, Mail, MapPin, Phone, Search, Stethoscope } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'
import { useAuthStore } from '../../store/useAuthStore'
import { api } from '../../lib/api'

const ATTENTE_PAIEMENT_MS = 3000
const ATTENTE_PAIEMENT_MAX_MS = 3 * 60 * 1000

function Specialites({ cles, t }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {cles.map((s) => (
        <span key={s} className="rounded-full bg-[var(--color-primary-container)]/15 text-[var(--color-primary)] px-2.5 py-0.5 text-xs font-semibold">
          {t(`annuaire.specialites.${s}`)}
        </span>
      ))}
    </div>
  )
}

// Avant paiement : ce que l'API rend est déjà sans nom ni contact. Le flou ici
// n'est qu'une mise en scène de cette absence - il ne cache rien qui soit
// réellement transmis au navigateur.
function FicheFloutee({ fiche, t }) {
  return (
    <article className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-container)] shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="h-4 w-40 max-w-full rounded bg-[var(--color-surface-container-high)] blur-[3px]" aria-hidden="true" />
          <Specialites cles={fiche.specialites} t={t} />
          <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {fiche.ville || t('annuaire.resultats.villeInconnue')}
            <span className="inline-block h-3 w-20 rounded bg-[var(--color-surface-container-high)] blur-[3px] ml-1" aria-hidden="true" />
          </p>
          <div className="flex gap-3 mt-1">
            <span className="inline-block h-3 w-28 rounded bg-[var(--color-surface-container-high)] blur-[3px]" aria-hidden="true" />
            <span className="inline-block h-3 w-36 rounded bg-[var(--color-surface-container-high)] blur-[3px]" aria-hidden="true" />
          </div>
        </div>
        <Lock className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" aria-label={t('annuaire.resultats.verrouille')} />
      </div>
    </article>
  )
}

function FicheComplete({ fiche, t }) {
  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
          <Stethoscope className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h3 className="font-semibold text-[var(--color-text-main)]">{fiche.nom}</h3>
          <Specialites cles={fiche.toutesSpecialites || fiche.specialites} t={t} />
          <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {[t(`annuaire.pays.${fiche.pays}`, { defaultValue: fiche.pays }), fiche.ville, fiche.quartier].filter(Boolean).join(' · ')}
          </p>
          {fiche.etablissement && (
            <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" /> {fiche.etablissement}
            </p>
          )}
          {fiche.presentation && <p className="text-sm text-[var(--color-text-main)] mt-1">{fiche.presentation}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {fiche.telephone && (
              <a href={`tel:${fiche.telephone.replace(/\s+/g, '')}`} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-semibold hover:opacity-90">
                <Phone className="w-4 h-4" /> {fiche.telephone}
              </a>
            )}
            {fiche.email && (
              <a href={`mailto:${fiche.email}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-surface-container-low)]">
                <Mail className="w-4 h-4" /> {fiche.email}
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * Résultats d'une recherche d'annuaire : compteur + fiches floutées, puis,
 * après paiement, les coordonnées. En revenant du fournisseur de paiement,
 * la page interroge l'API jusqu'à voir le déblocage arriver par le webhook.
 */
export default function AnnuaireResultats() {
  const { id } = useParams()
  const { t } = useTranslation()
  // Aucun compte n'est requis pour être mis en relation. Si la personne est
  // connectée, son e-mail est proposé d'office ; sinon elle le saisit.
  const emailCompte = useAuthStore((s) => s.user?.email)

  const [recherche, setRecherche] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [email, setEmail] = useState('')
  const [paiementEnCours, setPaiementEnCours] = useState(false)
  const [attenteConfirmation, setAttenteConfirmation] = useState(false)
  const debutAttente = useRef(null)

  useEffect(() => {
    if (emailCompte && !email) setEmail(emailCompte)
  }, [emailCompte]) // eslint-disable-line react-hooks/exhaustive-deps

  const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const charger = useCallback(async () => {
    try {
      const { data } = await api.get(`/annuaire/recherches/${id}`)
      setRecherche(data)
      setErreur(null)
      return data
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.resultats.introuvable'))
      return null
    } finally {
      setChargement(false)
    }
  }, [id, t])

  useEffect(() => { charger() }, [charger])

  // Après un paiement en attente de confirmation, on revient interroger l'API
  // à intervalle régulier, avec une limite : le webhook peut tarder, pas
  // éternellement.
  useEffect(() => {
    if (!attenteConfirmation) return undefined
    if (!debutAttente.current) debutAttente.current = Date.now()
    const timer = setInterval(async () => {
      const data = await charger()
      if (data?.statut === 'DEBLOQUEE' || Date.now() - debutAttente.current > ATTENTE_PAIEMENT_MAX_MS) {
        setAttenteConfirmation(false)
        debutAttente.current = null
      }
    }, ATTENTE_PAIEMENT_MS)
    return () => clearInterval(timer)
  }, [attenteConfirmation, charger])

  // Retour du fournisseur : si un paiement est en attente, on commence à
  // guetter la confirmation sans attendre un clic.
  useEffect(() => {
    if (recherche && recherche.statut === 'FLOUTEE' && !recherche.urgence && recherche.nombre > 0) {
      try {
        if (sessionStorage.getItem(`imsop.annuaire.paiement.${id}`) === '1') setAttenteConfirmation(true)
      } catch { /* stockage indisponible */ }
    }
    if (recherche?.statut === 'DEBLOQUEE') {
      try { sessionStorage.removeItem(`imsop.annuaire.paiement.${id}`) } catch { /* idem */ }
    }
  }, [recherche, id])

  // Revenu du fournisseur sans payer (ou paiement abandonné) : on arrête de
  // guetter et on rend le bouton, plutôt que de le laisser grisé trois minutes.
  function annulerAttente() {
    setAttenteConfirmation(false)
    debutAttente.current = null
    try { sessionStorage.removeItem(`imsop.annuaire.paiement.${id}`) } catch { /* stockage indisponible */ }
  }

  async function payer() {
    if (!emailValide) {
      setErreur(t('annuaire.resultats.emailRequis'))
      return
    }
    setPaiementEnCours(true)
    setErreur(null)
    try {
      const { data } = await api.post(`/annuaire/recherches/${id}/paiement`, { email: email.trim() })
      if (data.paymentUrl) {
        // On ne note « paiement en cours » qu au moment de partir chez le
        // fournisseur : c est au retour qu il faudra guetter la confirmation.
        try { sessionStorage.setItem(`imsop.annuaire.paiement.${id}`, '1') } catch { /* stockage indisponible */ }
        window.location.href = data.paymentUrl
        return
      }
      // Développement sans fournisseur : on simule la confirmation pour
      // dérouler le parcours de bout en bout.
      const { data: apres } = await api.post(`/annuaire/recherches/${id}/paiement/simulate`)
      setRecherche(apres)
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.resultats.erreurPaiement'))
    } finally {
      setPaiementEnCours(false)
    }
  }

  // Développement uniquement : confirme sans fournisseur ni webhook. Bouton
  // absent en production, et l'API refuse l'appel hors développement.
  async function simulerDev() {
    setPaiementEnCours(true)
    setErreur(null)
    try {
      const { data: apres } = await api.post(`/annuaire/recherches/${id}/paiement/simulate`)
      annulerAttente()
      setRecherche(apres)
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.resultats.erreurPaiement'))
    } finally {
      setPaiementEnCours(false)
    }
  }

  const tarif = recherche?.tarif

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-body-md min-h-screen transition-colors duration-300">
      <Navbar />
      <main className="pt-16 pb-28 md:pb-16">
        <section className="max-w-[860px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg flex flex-col gap-6">
          <Link to="/annuaire" className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] self-start">
            <Search className="w-4 h-4" /> {t('annuaire.resultats.nouvelleRecherche')}
          </Link>

          {chargement && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-10 text-center text-[var(--color-text-secondary)] flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> {t('annuaire.resultats.chargement')}
            </div>
          )}

          {erreur && !chargement && !recherche && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 px-5 py-4 text-sm">{erreur}</div>
          )}

          {recherche?.urgence && (
            <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/30 p-6 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-7 h-7 text-rose-600 shrink-0" />
                <h1 className="font-headline-md text-headline-md text-rose-700 dark:text-rose-300">{t('annuaire.urgence.titre')}</h1>
              </div>
              <p className="text-[var(--color-text-main)]">{t('annuaire.urgence.texte')}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('annuaire.urgence.rappel')}</p>
            </div>
          )}

          {recherche && !recherche.urgence && (
            <>
              <header className="flex flex-col gap-2">
                <span className="font-label-sm text-label-sm text-[var(--color-primary)] uppercase tracking-wider">
                  {t('annuaire.resultats.eyebrow')}
                </span>
                <h1 className="font-headline-md text-headline-md text-[var(--color-text-main)]">
                  {recherche.nombre === 0
                    ? t('annuaire.resultats.aucun')
                    : t('annuaire.resultats.titre', { count: recherche.nombre })}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {[t(`annuaire.pays.${recherche.pays}`, { defaultValue: recherche.pays }), recherche.ville].filter(Boolean).join(' · ')}
                  {' — '}
                  {recherche.specialites.map((s) => t(`annuaire.specialites.${s}`)).join(', ')}
                </p>
              </header>

              {recherche.nombre === 0 && (
                <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-secondary)]">
                  {t('annuaire.resultats.aucunAide')}
                </p>
              )}

              {recherche.statut === 'FLOUTEE' && recherche.nombre > 0 && (
                <div className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
                  <div>
                    <p className="font-semibold text-[var(--color-text-main)]">{t('annuaire.resultats.deblocageTitre')}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{t('annuaire.resultats.deblocageTexte')}</p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <label className="flex-1 flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{t('annuaire.resultats.emailLabel')}</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErreur(null) }}
                        placeholder={t('annuaire.resultats.emailPlaceholder')}
                        autoComplete="email"
                        inputMode="email"
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text-main)] outline-none focus:border-[var(--color-primary)] transition-colors"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={payer}
                      disabled={paiementEnCours || attenteConfirmation}
                      className="inline-flex items-center justify-center gap-2 bg-[var(--color-primary)] text-white rounded-full px-6 py-3 font-bold text-sm whitespace-nowrap hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {paiementEnCours || attenteConfirmation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockOpen className="w-4 h-4" />}
                      {attenteConfirmation
                        ? t('annuaire.resultats.attenteConfirmation')
                        : t('annuaire.resultats.debloquer', { montant: tarif.amount.toLocaleString('fr-FR'), devise: tarif.currency })}
                    </button>
                  </div>
                  {attenteConfirmation ? (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t('annuaire.resultats.attenteAide')}{' '}
                      <button type="button" onClick={annulerAttente} className="font-semibold text-[var(--color-primary)] underline underline-offset-2">
                        {t('annuaire.resultats.attenteAnnuler')}
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--color-text-secondary)]">{t('annuaire.resultats.emailAide')}</p>
                  )}
                </div>
              )}

              {import.meta.env.DEV && recherche.statut === 'FLOUTEE' && recherche.nombre > 0 && (
                <button
                  type="button"
                  onClick={simulerDev}
                  disabled={paiementEnCours}
                  className="self-start rounded-full border border-dashed border-amber-500 text-amber-700 dark:text-amber-400 px-4 py-2 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors disabled:opacity-50"
                >
                  {t('common.simulerPaiementDev')}
                </button>
              )}

              {erreur && recherche && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}

              <div className="grid grid-cols-1 gap-4">
                {recherche.resultats.map((fiche) =>
                  recherche.statut === 'DEBLOQUEE'
                    ? <FicheComplete key={fiche.id} fiche={fiche} t={t} />
                    : <FicheFloutee key={fiche.id} fiche={fiche} t={t} />,
                )}
              </div>

              {recherche.statut === 'DEBLOQUEE' && (
                <p className="text-xs text-[var(--color-text-secondary)]">{t('annuaire.resultats.rappelDebloque')}</p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
