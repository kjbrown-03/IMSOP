import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft, Award, Building2, Leaf, Loader2, Lock, LockOpen, Mail, MapPin, MessageCircle, Navigation, Phone, Stethoscope } from 'lucide-react'
import Navbar from '../../components/layout/Navbar'
import { useAuthStore } from '../../store/useAuthStore'
import { lireSession, roleActif, definirRoleActif } from '../../lib/session'
import { api } from '../../lib/api'
import { distanceKm, libelleLieu, lirePosition, pointDe } from '../../lib/lieuCameroun'

const ATTENTE_PAIEMENT_MS = 3000
const ATTENTE_PAIEMENT_MAX_MS = 3 * 60 * 1000

// Les spécialités sont déduites des symptômes par le dictionnaire de la
// médecine conventionnelle. Sur la voie traditionnelle, afficher « Médecine
// générale » à côté d'un tradipraticien était faux et déroutant : la
// correspondance sert au classement, elle ne se montre pas.
function Specialites({ cles, t, tradi }) {
  if (tradi) return null
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
function FicheFloutee({ fiche, t, tradi, onChoisir, choixEnCours, distance }) {
  return (
    <article className="relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 overflow-hidden">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-container)] shrink-0" />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="h-4 w-40 max-w-full rounded bg-[var(--color-surface-container-high)] blur-[3px]" aria-hidden="true" />
          <Specialites cles={fiche.specialites} t={t} tradi={tradi} />
          <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> {libelleLieu(fiche) || t('annuaire.resultats.villeInconnue')}
            <span className="inline-block h-3 w-20 rounded bg-[var(--color-surface-container-high)] blur-[3px] ml-1" aria-hidden="true" />
          </p>
          <Distance distance={distance} t={t} />
          <Experience fiche={fiche} t={t} />
          <div className="flex gap-3 mt-1">
            <span className="inline-block h-3 w-28 rounded bg-[var(--color-surface-container-high)] blur-[3px]" aria-hidden="true" />
            <span className="inline-block h-3 w-36 rounded bg-[var(--color-surface-container-high)] blur-[3px]" aria-hidden="true" />
          </div>
        </div>
        <Lock className="w-4 h-4 text-[var(--color-text-secondary)] shrink-0" aria-label={t('annuaire.resultats.verrouille')} />
      </div>
      {onChoisir && (
        <button
          type="button"
          onClick={() => onChoisir(fiche.id)}
          disabled={choixEnCours}
          className="relative mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] text-white px-5 py-2.5 text-sm font-bold hover:opacity-90 disabled:opacity-50"
        >
          {choixEnCours ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockOpen className="w-4 h-4" />}
          {t(tradi ? 'annuaire.resultats.choisirTradi' : 'annuaire.resultats.choisirMedecin')}
        </button>
      )}
    </article>
  )
}

/**
 * Annees d'exercice, montrees AVANT le paiement.
 *
 * C'est un repere pour CHOISIR, pas une recompense : le cacher jusqu'apres le
 * paiement ferait choisir le patient a l'aveugle. Absent si le medecin ne l'a
 * pas renseigne — mieux vaut rien qu'un « 0 an » trompeur.
 */
function Experience({ fiche, t }) {
  if (fiche.experience === null || fiche.experience === undefined) return null
  return (
    <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
      <Award className="w-3.5 h-3.5 shrink-0" />
      {t('annuaire.resultats.experience', { count: fiche.experience })}
    </p>
  )
}

/**
 * Lien vers l'application de carte du patient.
 *
 * POURQUOI PAS UNE CARTE INTEGREE
 *
 * Afficher une carte dans la page suppose soit une cle Google facturee, soit
 * 40 Ko de bibliotheque supplementaire — sur une connexion ou chaque kilo-octet
 * compte, et pour un bouton qu'on touche une fois.
 *
 * Ce lien ouvre l'application de navigation DEJA INSTALLEE sur le telephone :
 * Google Maps sur Android, Plans ou Google Maps sur iPhone. Le patient y trouve
 * l'itineraire, la navigation vocale et ses trajets habituels. On ne paie rien
 * et on n'embarque rien.
 *
 * L'adresse est passee en toutes lettres plutot qu'en coordonnees : c'est ce
 * que le medecin a saisi, et les applications de carte savent la resoudre.
 */
function LienCarte({ fiche, t }) {
  // L'adresse du cabinet quand le praticien l'a saisie ; sinon sa localité, son
  // arrondissement et son département — c'est tout ce que la cartographie des
  // tradipraticiens donne, et c'est assez pour que l'application de carte
  // trace un itinéraire et en dise la longueur.
  const pays = fiche.pays ? t(`annuaire.pays.${fiche.pays}`, { defaultValue: fiche.pays }) : null
  const morceaux = fiche.adresse
    ? [fiche.adresse, fiche.etablissement, fiche.quartier, fiche.ville || fiche.arrondissement, pays]
    : [fiche.quartier, fiche.arrondissement || fiche.ville, fiche.departement, pays]
  const utiles = morceaux.filter(Boolean)
  // Le pays seul enverrait le patient au centre du pays : pas de lien.
  if (utiles.length < 2) return null

  // `dir` plutôt que `search` : la carte s'ouvre directement sur l'itinéraire
  // depuis la position du téléphone, avec la distance et la durée du trajet.
  const destination = encodeURIComponent(utiles.join(', '))
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${destination}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-surface-container-low)]"
    >
      <Navigation className="w-4 h-4" /> {t('annuaire.resultats.itineraire')}
    </a>
  )
}

function Distance({ distance, t }) {
  if (!distance) return null
  return (
    <p className="text-sm font-semibold text-[var(--color-primary)] flex items-center gap-1.5">
      <Navigation className="w-3.5 h-3.5 shrink-0" />
      {distance.memeArrondissement
        ? t('annuaire.resultats.distanceMemeArrondissement')
        : t(distance.depuisPosition ? 'annuaire.resultats.distanceVous' : 'annuaire.resultats.distanceLieu', { km: distance.km, lieu: distance.lieu })}
    </p>
  )
}

/**
 * Ouvre une discussion WhatsApp avec le medecin.
 *
 * POURQUOI WHATSAPP A COTE DU TELEPHONE
 *
 * Au Cameroun, beaucoup de gens ecrivent sur WhatsApp plutot que d'appeler :
 * c'est moins intrusif pour le medecin, ca laisse une trace ecrite des deux
 * cotes, et ca ne coute pas de communication. Un patient intimide par l'idee
 * d'appeler un specialiste osera plus facilement ecrire.
 *
 * LE FORMAT DU NUMERO EST LA SEULE DIFFICULTE
 *
 * wa.me n'accepte QUE des chiffres, sans « + », sans espace, sans tiret, et avec
 * l'indicatif pays. Les numeros sont stockes en « +237693904197 » : on retire
 * donc tout ce qui n'est pas un chiffre.
 *
 * Un numero SANS indicatif donnerait un lien qui echoue en silence — WhatsApp
 * ouvre une page « numero invalide » sans expliquer. On n'affiche donc le bouton
 * que si le numero commence par « + » : c'est le seul cas ou l'on est sur de
 * l'indicatif. Mieux vaut pas de bouton qu'un bouton qui mene dans le vide.
 */
function urlWhatsApp(fiche, t) {
  const brut = (fiche.telephone || '').trim()
  if (!brut.startsWith('+')) return null

  const numero = brut.replace(/\D/g, '')
  if (numero.length < 8) return null

  // Un premier message deja ecrit : le patient n'a pas a se presenter dans le
  // vide, et le medecin sait d'ou vient le contact.
  const texte = encodeURIComponent(t('annuaire.resultats.whatsappMessage'))
  return `https://wa.me/${numero}?text=${texte}`
}

function FicheComplete({ fiche, t, onContacter, tradi, distance }) {
  const whatsappUrl = urlWhatsApp(fiche, t)

  function contactAuClic(event, lien) {
    if (!onContacter) return
    event.preventDefault()
    onContacter(fiche.id, lien)
  }

  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
          {tradi ? <Leaf className="w-5 h-5" /> : <Stethoscope className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h3 className="font-semibold text-[var(--color-text-main)]">{fiche.nom}</h3>
          <Specialites cles={fiche.toutesSpecialites || fiche.specialites} t={t} tradi={tradi} />
          <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {[t(`annuaire.pays.${fiche.pays}`, { defaultValue: fiche.pays }), libelleLieu(fiche), fiche.quartier].filter(Boolean).join(' · ')}
          </p>
          <Distance distance={distance} t={t} />
          {fiche.etablissement && (
            <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 shrink-0" /> {fiche.etablissement}
            </p>
          )}
          {fiche.adresse && (
            <p className="text-sm text-[var(--color-text-secondary)] flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {fiche.adresse}
            </p>
          )}
          <Experience fiche={fiche} t={t} />
          {fiche.presentation && <p className="text-sm text-[var(--color-text-main)] mt-1">{fiche.presentation}</p>}
          <div className="flex flex-wrap gap-2 mt-2">
            {fiche.telephone && (
              <a
                href={whatsappUrl || `tel:${fiche.telephone.replace(/\s+/g, '')}`}
                target={whatsappUrl ? '_blank' : undefined}
                rel={whatsappUrl ? 'noreferrer' : undefined}
                onClick={(event) => contactAuClic(event, whatsappUrl || `tel:${fiche.telephone.replace(/\s+/g, '')}`)}
                className={`inline-flex items-center gap-1.5 rounded-full ${whatsappUrl ? 'bg-[#25D366] text-white' : 'bg-[var(--color-primary)] text-white'} px-4 py-2 text-sm font-semibold hover:opacity-90`}
                aria-label={whatsappUrl ? `${t('annuaire.resultats.whatsapp')} ${fiche.telephone}` : fiche.telephone}
              >
                {whatsappUrl ? <MessageCircle className="w-4 h-4" /> : <Phone className="w-4 h-4" />} {fiche.telephone}
              </a>
            )}
            {fiche.telephone && whatsappUrl && (
              <a href={`tel:${fiche.telephone.replace(/\s+/g, '')}`} onClick={(event) => contactAuClic(event, `tel:${fiche.telephone.replace(/\s+/g, '')}`)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-surface-container-low)]">
                <Phone className="w-4 h-4" /> {t('annuaire.resultats.appeler')}
              </a>
            )}
            <LienCarte fiche={fiche} t={t} />
            {fiche.email && (
              <a href={`mailto:${fiche.email}`} onClick={(event) => contactAuClic(event, `mailto:${fiche.email}`)} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--color-surface-container-low)]">
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
/**
 * Execute un appel en faisant passer `api` pour l'espace indique, puis retablit.
 *
 * POURQUOI PAS UN SIMPLE EN-TETE
 *
 * Poser `Authorization` a la main contourne tout l'appareillage d'`api` — et
 * notamment le RENOUVELLEMENT du jeton. Or un jeton d'acces expire vite.
 *
 * Et il expire silencieusement ici : la route de simulation accepte les
 * visiteurs anonymes, donc son authentification est « optionnelle » et avale un
 * jeton perime sans broncher. Le serveur repondait alors 404 — pas 401 — et
 * l'intercepteur de renouvellement, qui ne guette que les 401, ne se declenchait
 * jamais. Le bouton etait visible, le clic echouait indefiniment, et le message
 * « Introuvable » ne disait rien de la cause.
 *
 * En designant le role actif le temps de l'appel, on laisse `api` faire son
 * travail habituel : il attache le bon jeton, le renouvelle s'il le faut, et
 * reessaie. Le role precedent est retabli dans tous les cas.
 */
async function appelerAvecRole(role, appel) {
  if (!role) return appel()
  const precedent = roleActif()
  definirRoleActif(role)
  try {
    return await appel()
  } finally {
    definirRoleActif(precedent)
  }
}

export default function AnnuaireResultats() {
  const { id } = useParams()
  const { t } = useTranslation()
  // Aucun compte n'est requis pour être mis en relation. Si la personne est
  // connectée, son e-mail est proposé d'office ; sinon elle le saisit.
  const emailCompte = useAuthStore((s) => s.user?.email)

  /*
   * La coordination et l'administration peuvent derouler le parcours sans payer,
   * pour le verifier sur les vraies donnees.
   *
   * On ne se fie PAS a la session « active ». L'application tient une session par
   * role, et la page d'annuaire n'appartient a aucun espace : le role actif y est
   * celui du dernier espace visite — typiquement le medecin dont on vient de
   * renseigner la fiche. L'appel partait alors avec SON jeton, et le serveur
   * repondait « Introuvable » a juste titre.
   *
   * On cherche donc une session COORDINATEUR ou ADMIN parmi celles ouvertes, et
   * on envoie son jeton explicitement. Le serveur revalide de toute facon : ceci
   * evite seulement d'afficher un bouton qui echouerait.
   */
  const roleSimulation = useMemo(
    () => ['COORDINATEUR', 'ADMIN'].find((r) => lireSession(r)?.accessToken) ?? null,
    [],
  )
  const peutSimuler = import.meta.env.DEV || Boolean(roleSimulation)

  const [recherche, setRecherche] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState(null)
  const [email, setEmail] = useState('')
  const [paiementEnCours, setPaiementEnCours] = useState(false)
  const [attenteConfirmation, setAttenteConfirmation] = useState(false)
  const [contactEnCours, setContactEnCours] = useState(false)
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
      if (data?.contactsDisponibles > 0 || Date.now() - debutAttente.current > ATTENTE_PAIEMENT_MAX_MS) {
        setAttenteConfirmation(false)
        debutAttente.current = null
      }
    }, ATTENTE_PAIEMENT_MS)
    return () => clearInterval(timer)
  }, [attenteConfirmation, charger])

  // Retour du fournisseur : si un paiement est en attente, on commence à
  // guetter la confirmation sans attendre un clic.
  useEffect(() => {
    if (recherche && recherche.contactsDisponibles === 0 && !recherche.urgence && recherche.nombre > 0) {
      try {
        if (sessionStorage.getItem(`imsop.annuaire.paiement.${id}`) === '1') setAttenteConfirmation(true)
      } catch { /* stockage indisponible */ }
    }
    if (recherche?.contactsDisponibles > 0) {
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
      const { data: apres } = await appelerAvecRole(roleSimulation, () =>
        api.post(`/annuaire/recherches/${id}/paiement/simulate`),
      )
      annulerAttente()
      setRecherche(apres)
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.resultats.erreurPaiement'))
    } finally {
      setPaiementEnCours(false)
    }
  }

  // Un paiement = un contact : on confirme avant de consommer le paiement sur
  // une fiche, un clic malheureux coûterait une nouvelle mise en relation.
  async function choisir(resultatId) {
    if (!window.confirm(t('annuaire.resultats.choixConfirmer'))) return
    setContactEnCours(true)
    setErreur(null)
    try {
      const { data } = await api.post(`/annuaire/recherches/${id}/choisir/${resultatId}`)
      setRecherche(data)
    } catch (err) {
      setErreur(err.response?.data?.message || t('annuaire.resultats.erreurPaiement'))
      await charger()
    } finally {
      setContactEnCours(false)
    }
  }

  const tarif = recherche?.tarif

  // Distance indicative à chaque praticien. Depuis la position du téléphone si
  // le patient l'a partagée (gardée dans ce navigateur seulement), sinon depuis
  // le lieu choisi dans le formulaire. Calculée entre centres d'arrondissement :
  // le trajet réel, c'est le bouton « Itinéraire » qui le donne.
  const [regions, setRegions] = useState([])
  useEffect(() => {
    api.get('/annuaire/referentiels').then(({ data }) => setRegions(data.decoupage?.cm ?? [])).catch(() => {})
  }, [])
  const origine = useMemo(() => {
    if (recherche?.pays !== 'cm') return null
    const position = lirePosition()
    if (position) return { ...position, depuisPosition: true }
    const point = pointDe(regions, recherche)
    return point ? { ...point, depuisPosition: false, lieu: libelleLieu(recherche) } : null
  }, [regions, recherche])
  function distanceVers(fiche) {
    if (!origine) return null
    if (!origine.depuisPosition && recherche.arrondissement && fiche.arrondissement === recherche.arrondissement) {
      return { memeArrondissement: true }
    }
    const point = pointDe(regions, fiche)
    if (!point) return null
    return { km: Math.max(1, Math.round(distanceKm(origine, point))), depuisPosition: origine.depuisPosition, lieu: origine.lieu }
  }

  return (
    <div className="bg-[var(--color-bg)] text-[var(--color-text-main)] antialiased font-body-md min-h-screen transition-colors duration-300">
      <Navbar />
      <main className="pt-16 pb-28 md:pb-16">
        <section className="max-w-[860px] mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg flex flex-col gap-6">
          {/* Retour au formulaire de la même voie : un patient qui cherchait un
              tradipraticien ne doit pas retomber sur le choix, ni sur l'autre voie. */}
          <Link
            to={recherche?.typePratique === 'TRADITIONNEL' ? '/annuaire/traditionnel' : recherche ? '/annuaire/conventionnel' : '/annuaire'}
            className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors self-start"
          >
            <ArrowLeft className="w-4 h-4" /> {t('annuaire.resultats.nouvelleRecherche')}
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
                    ? t(recherche.typePratique === 'TRADITIONNEL' ? 'annuaire.resultats.aucunTradi' : 'annuaire.resultats.aucun')
                    : t(recherche.typePratique === 'TRADITIONNEL' ? 'annuaire.resultats.titreTradi' : 'annuaire.resultats.titre', { count: recherche.nombre })}
                </h1>
                <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {[t(`annuaire.pays.${recherche.pays}`, { defaultValue: recherche.pays }), libelleLieu(recherche)].filter(Boolean).join(' · ')}
                  {recherche.typePratique !== 'TRADITIONNEL' && recherche.specialites.length > 0 && (
                    <>{' — '}{recherche.specialites.map((s) => t(`annuaire.specialites.${s}`)).join(', ')}</>
                  )}
                </p>
              </header>

              {recherche.nombre === 0 && (
                <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-secondary)]">
                  {t('annuaire.resultats.aucunAide')}
                </p>
              )}

              {recherche.contactsDisponibles > 0 && (
                <p className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 p-4 text-sm font-semibold">
                  {t('annuaire.resultats.choixDisponible')}
                </p>
              )}

              {recherche.contactsDisponibles === 0 && recherche.nombre > recherche.contactsChoisis.length && (
                <div className="rounded-2xl border-2 border-[var(--color-primary)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
                  <div>
                    <p className="font-semibold text-[var(--color-text-main)]">
                      {t(recherche.contactsChoisis.length ? 'annuaire.resultats.autreContactTitre' : 'annuaire.resultats.deblocageTitre')}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {t(recherche.contactsChoisis.length ? 'annuaire.resultats.autreContactTexte' : 'annuaire.resultats.deblocageTexte')}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t('annuaire.resultats.tarifDetail', {
                        base: tarif.baseAmount.toLocaleString('fr-FR'),
                        frais: tarif.fraisEstimes.toLocaleString('fr-FR'),
                        total: tarif.amount.toLocaleString('fr-FR'),
                        devise: tarif.currency,
                      })}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <label className="flex-1 flex flex-col gap-1.5">
                      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{t('annuaire.resultats.emailLabel')}</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setErreur(null) }}
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
                    {(peutSimuler || recherche.simulationPubliqueActive) && (
                      <button
                        type="button"
                        onClick={simulerDev}
                        disabled={paiementEnCours || attenteConfirmation}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-dashed border-amber-500 px-5 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      >
                        <LockOpen className="w-4 h-4" /> {t('common.simulerPaiementDev')}
                      </button>
                    )}
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

              {erreur && recherche && <p className="text-sm font-semibold text-rose-600">{erreur}</p>}

              <div className="grid grid-cols-1 gap-4">
                {recherche.resultats.map((fiche) =>
                  recherche.contactsChoisis.includes(fiche.id)
                    ? <FicheComplete key={fiche.id} fiche={fiche} t={t} tradi={recherche.typePratique === 'TRADITIONNEL'} distance={distanceVers(fiche)} />
                    : (
                      <FicheFloutee
                        key={fiche.id}
                        fiche={fiche}
                        t={t}
                        tradi={recherche.typePratique === 'TRADITIONNEL'}
                        onChoisir={recherche.contactsDisponibles > 0 ? choisir : null}
                        choixEnCours={contactEnCours}
                        distance={distanceVers(fiche)}
                      />
                    ),
                )}
              </div>

              {recherche.contactsChoisis.length > 0 && (
                <p className="text-xs text-[var(--color-text-secondary)]">{t('annuaire.resultats.rappelDebloque')}</p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  )
}
