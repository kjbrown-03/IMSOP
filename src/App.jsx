import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import SplashScreen from './components/Splashscreen'
import { useThemeStore } from './store/useThemeStore'
import { useAuthStore } from './store/useAuthStore'
import { getCallSocket } from './lib/socket'

/*
 * Les pages sont chargees a la demande, pas toutes au demarrage.
 *
 * Elles etaient toutes importees directement : un visiteur qui ouvrait
 * l'accueil telechargeait AUSSI les ecrans d'administration, le tableau de bord
 * du coordinateur, la redaction de rapport et le dossier medical — soit la
 * quasi-totalite du site, pour voir une page. Sur un telephone, le temps perdu
 * n'est pas que le telechargement : c'est aussi l'analyse de tout ce code avant
 * que quoi que ce soit ne s'affiche.
 *
 * Chaque page devient donc un fichier separe, demande au moment ou l'on y va.
 * Seules la racine et l'ossature restent chargees d'emblee.
 */
const Placeholder = lazy(() => import('./pages/Placeholder'))
const NotFound = lazy(() => import('./pages/NotFound'))
const SelectionRole = lazy(() => import('./pages/auth/SelectionRole'))
const ConnexionPatient = lazy(() => import('./pages/auth/ConnexionPatient'))
const ConnexionCoordinateur = lazy(() => import('./pages/auth/ConnexionCoordinateur'))
const ConnexionSpecialiste = lazy(() => import('./pages/auth/ConnexionSpecialiste'))
const ConnexionAdmin = lazy(() => import('./pages/auth/ConnexionAdmin'))
const ConnexionMedecinLocal = lazy(() => import('./pages/auth/ConnexionMedecinLocal'))
const InscriptionMedecinLocal = lazy(() => import('./pages/auth/InscriptionMedecinLocal'))
const VerificationDeuxFacteurs = lazy(() => import('./pages/auth/VerificationDeuxFacteurs'))
const OAuthCallback = lazy(() => import('./pages/auth/OAuthCallback'))
const VerificationEmail = lazy(() => import('./pages/auth/VerificationEmail'))
const MotDePasseOublie = lazy(() => import('./pages/auth/MotDePasseOublie'))
const ReinitialiserMotDePasse = lazy(() => import('./pages/auth/ReinitialiserMotDePasse'))
const InscriptionPatientInfos = lazy(() => import('./pages/auth/InscriptionPatientInfos'))
const InscriptionPatientSecurite = lazy(() => import('./pages/auth/InscriptionPatientSecurite'))
const InscriptionPatientValidation = lazy(() => import('./pages/auth/InscriptionPatientValidation'))
const DashboardPatient = lazy(() => import('./pages/patient/DashboardPatient'))
const QuestionnaireMedical = lazy(() => import('./pages/patient/QuestionnaireMedical'))
const DocumentsUpload = lazy(() => import('./pages/patient/DocumentsUpload'))
const MatchingEnCours = lazy(() => import('./pages/patient/MatchingEnCours'))
const ProfilPatient = lazy(() => import('./pages/patient/ProfilPatient'))
const MonProfil = lazy(() => import('./pages/MonProfil'))
const RapportExpertFinal = lazy(() => import('./pages/patient/RapportExpertFinal'))
const DashboardMedecinLocal = lazy(() => import('./pages/medecin/DashboardMedecinLocal'))
const NouvelleDemandeMedecin = lazy(() => import('./pages/medecin/NouvelleDemandeMedecin'))
const DossierMedecinLocal = lazy(() => import('./pages/medecin/DossierMedecinLocal'))
const MesJustificatifs = lazy(() => import('./pages/professionnel/MesJustificatifs'))
const RevueHabilitations = lazy(() => import('./pages/coordinateur/RevueHabilitations'))
const CoordinateurSpecialistes = lazy(() => import('./pages/coordinateur/CoordinateurSpecialistes'))
const CoordinateurStatistiques = lazy(() => import('./pages/coordinateur/CoordinateurStatistiques'))
const CoordinateurCandidatures = lazy(() => import('./pages/coordinateur/CoordinateurCandidatures'))
const CoordinateurSpecialites = lazy(() => import('./pages/coordinateur/CoordinateurSpecialites'))
const CoordinateurMedecins = lazy(() => import('./pages/coordinateur/CoordinateurMedecins'))
const Candidature = lazy(() => import('./pages/public/Candidature'))
const CandidatureRedirection = lazy(() => import('./pages/public/Candidature').then((m) => ({ default: m.CandidatureRedirection })))
const Confidentialite = lazy(() => import('./pages/public/Confidentialite'))
const Conditions = lazy(() => import('./pages/public/Conditions'))
const MentionsLegales = lazy(() => import('./pages/public/MentionsLegales'))
const CoordinateurReversements = lazy(() => import('./pages/coordinateur/CoordinateurReversements'))
const DashboardCoordinateur = lazy(() => import('./pages/coordinateur/DashboardCoordinateur'))
const AffectationExpert = lazy(() => import('./pages/coordinateur/AffectationExpert'))
const RechercheExpertCoordinateur = lazy(() => import('./pages/coordinateur/RechercheExpertCoordinateur'))
const GestionExceptions = lazy(() => import('./pages/coordinateur/GestionExceptions'))
const ConsultationRapport = lazy(() => import('./pages/coordinateur/ConsultationRapport'))
const DashboardSpecialiste = lazy(() => import('./pages/specialiste/DashboardSpecialiste'))
const RedactionRapportExpert = lazy(() => import('./pages/specialiste/RedactionRapportExpert'))
const PaiementSecurise = lazy(() => import('./pages/patient/PaiementSecurise'))
const AccueilV2 = lazy(() => import('./pages/public/AccueilV2'))
const PourMedecins = lazy(() => import('./pages/public/PourMedecins'))
const AnnuaireRecherche = lazy(() => import('./pages/public/AnnuaireRecherche'))
const AnnuaireChoix = lazy(() => import('./pages/public/AnnuaireChoix'))
const AnnuaireResultats = lazy(() => import('./pages/public/AnnuaireResultats'))
const AnnuaireMedecin = lazy(() => import('./pages/medecin/AnnuaireMedecin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminSpecialistes = lazy(() => import('./pages/admin/AdminSpecialistes'))
const AdminCoordinateurs = lazy(() => import('./pages/admin/AdminCoordinateurs'))
const AdminJournal = lazy(() => import('./pages/admin/AdminJournal'))
const AdminStatistiques = lazy(() => import('./pages/admin/AdminStatistiques'))
const MessagerieSpecialiste = lazy(() => import('./pages/specialiste/MessagerieSpecialiste'))
const MessagerieCoordinateur = lazy(() => import('./pages/coordinateur/MessagerieCoordinateur'))
const CoordinateurTemoignages = lazy(() => import('./pages/coordinateur/CoordinateurTemoignages'))

import Accueil from './pages/public/Accueil'

export default function App() {
  // Passe à true une fois les vérifications initiales faites. Aujourd'hui
  // rien de vraiment asynchrone à attendre : useAuthStore lit la session
  // depuis le localStorage de façon synchrone (voir useAuthStore.js), donc
  // ça bascule quasi immédiatement. Le SplashScreen reste affiché son délai
  // minimum quoi qu'il arrive (voir sa propre logique interne) - mais le
  // jour où un vrai contrôle serveur (ex. validation du token via
  // /api/auth/me) s'ajoutera ici, il suffira de retarder ce `setIsAppReady`.
  const [isAppReady, setIsAppReady] = useState(false)
  const initTheme = useThemeStore((state) => state.initTheme)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const userId = useAuthStore((s) => s.user?.id)

  useEffect(() => {
    initTheme()
    setIsAppReady(true)
  }, [initTheme])

  // The call-signaling connection tracks whether this person is reachable
  // for a video call, so it has to live for the whole session — not just
  // while the Messagerie page happens to be mounted, or navigating to
  // Dossiers/Profil would make a still-logged-in user look "unavailable" to
  // a caller. `userId` is in the deps so switching accounts on the same tab
  // (no full reload) drops the old connection and opens a fresh one under
  // the new identity instead of keeping the previous user's socket alive.
  useEffect(() => {
    if (!isAuthenticated) return
    const socket = getCallSocket()
    socket.connect()
    return () => {
      socket.disconnect()
    }
  }, [isAuthenticated, userId])

  return (
    <>
      {/* Toujours monté au-dessus des routes : il gère lui-même son délai
          minimum d'affichage et son fondu de sortie, puis se démonte. Les
          routes restent montées en dessous pendant ce temps, pas de
          re-montage brutal une fois le splash retiré. */}
      <SplashScreen isLoading={!isAppReady} />

      {/* Une page chargee a la demande arrive avec un leger delai la premiere
          fois qu'on s'y rend. Suspense est ce qui s'affiche pendant ce delai :
          sans lui, React leve une erreur au lieu d'attendre.
          Volontairement discret — un ecran plein ferait clignoter l'interface a
          chaque navigation, alors que le fichier arrive en general en moins
          d'une seconde et qu'il est ensuite garde par le navigateur. */}
      <Suspense fallback={<ChargementPage />}>
      <Routes>
      {/* Public */}
      <Route path="/" element={<Accueil />} />
      <Route path="/accueil-v2" element={<AccueilV2 />} />
      <Route path="/pour-medecins" element={<PourMedecins />} />
      {/* Formulaire de candidature envoyé par le comité scientifique : public,
          aucun compte n'existe encore. Deux variantes : specialiste | medecin. */}
      <Route path="/candidature/medecin" element={<Candidature type="MEDECIN_LOCAL" />} />
      <Route path="/candidature/specialiste" element={<Candidature type="SPECIALISTE" />} />
      {/* Absorbe les variantes d'écriture du lien (majuscule, accent, pluriel).
          Une valeur inconnue n'ouvre plus un formulaire au hasard : elle affiche
          la page d'erreur. */}
      <Route path="/candidature/:type" element={<CandidatureRedirection />} />
      {/* Pages legales : publiques et sans compte. Google exige les deux
          premieres pour publier l'application OAuth, et une plateforme qui
          traite des donnees de sante les doit a ses utilisateurs. */}
      <Route path="/confidentialite" element={<Confidentialite />} />
      <Route path="/conditions" element={<Conditions />} />
      <Route path="/mentions-legales" element={<MentionsLegales />} />
      {/* Annuaire « Trouver un médecin » : recherche et résultats sont
          publics (les résultats restent floutés tant que rien n'est payé). */}
      {/* L'annuaire commence par un choix : conventionnel ou traditionnel. Les
          deux pratiques ne se mélangent pas dans une liste de résultats. */}
      <Route path="/annuaire" element={<AnnuaireChoix />} />
      <Route path="/annuaire/conventionnel" element={<AnnuaireRecherche typePratique="CONVENTIONNEL" />} />
      <Route path="/annuaire/traditionnel" element={<AnnuaireRecherche typePratique="TRADITIONNEL" />} />
      <Route path="/annuaire/:id" element={<AnnuaireResultats />} />

      {/* Auth */}
      <Route path="/connexion" element={<SelectionRole />} />
      <Route path="/connexion/patient" element={<ConnexionPatient />} />
      <Route path="/connexion/coordinateur" element={<ConnexionCoordinateur />} />
      <Route path="/connexion/specialiste" element={<ConnexionSpecialiste />} />
      <Route path="/connexion/medecin" element={<ConnexionMedecinLocal />} />
      <Route path="/inscription/medecin" element={<InscriptionMedecinLocal />} />
      <Route path="/connexion/admin" element={<ConnexionAdmin />} />
      <Route path="/verification-2fa" element={<VerificationDeuxFacteurs />} />
      <Route path="/oauth/callback" element={<OAuthCallback />} />
      <Route path="/verifier-email" element={<VerificationEmail />} />
      <Route path="/mot-de-passe-oublie" element={<MotDePasseOublie />} />
      <Route path="/reinitialiser-mot-de-passe" element={<ReinitialiserMotDePasse />} />
      <Route path="/inscription" element={<InscriptionPatientInfos />} />
      <Route path="/inscription/securite" element={<InscriptionPatientSecurite />} />
      <Route path="/inscription/validation" element={<InscriptionPatientValidation />} />

      {/* Patient */}
      <Route
        path="/patient/dossiers"
        element={
          <ProtectedRoute role="PATIENT">
            <DashboardPatient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/nouvelle-demande"
        element={
          <ProtectedRoute role="PATIENT">
            <QuestionnaireMedical />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/nouvelle-demande/documents"
        element={
          <ProtectedRoute role="PATIENT">
            <DocumentsUpload />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/matching"
        element={
          <ProtectedRoute role="PATIENT">
            <MatchingEnCours />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/paiement"
        element={
          <ProtectedRoute role="PATIENT">
            <PaiementSecurise />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profil"
        element={
          <ProtectedRoute>
            <MonProfil />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/profil"
        element={
          <ProtectedRoute role="PATIENT">
            <ProfilPatient />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medecin/nouvelle-demande"
        element={
          <ProtectedRoute role="MEDECIN_LOCAL">
            <NouvelleDemandeMedecin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medecin/dossiers"
        element={
          <ProtectedRoute role="MEDECIN_LOCAL">
            <DashboardMedecinLocal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medecin/dossiers/:id"
        element={
          <ProtectedRoute role="MEDECIN_LOCAL">
            <DossierMedecinLocal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professionnel/justificatifs"
        element={
          <ProtectedRoute role={['SPECIALISTE', 'MEDECIN_LOCAL']}>
            <MesJustificatifs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/candidatures"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <CoordinateurCandidatures />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/specialites"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <CoordinateurSpecialites />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/statistiques"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <CoordinateurStatistiques />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/statistiques/:cle"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <CoordinateurStatistiques />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/reversements"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <CoordinateurReversements />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/medecins"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <CoordinateurMedecins />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/specialistes"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <CoordinateurSpecialistes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/habilitations"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <RevueHabilitations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medecin/annuaire"
        element={
          <ProtectedRoute role="MEDECIN_LOCAL">
            <AnnuaireMedecin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medecin/profil"
        element={
          <ProtectedRoute role="MEDECIN_LOCAL">
            <MonProfil />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/dossiers/:id"
        element={
          <ProtectedRoute role="PATIENT">
            <RapportExpertFinal />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/rapport/:id"
        element={
          <ProtectedRoute role="PATIENT">
            <RapportExpertFinal />
          </ProtectedRoute>
        }
      />

      {/* Coordinateur */}
      <Route
        path="/coordinateur/tableau-de-bord"
        element={
          <ProtectedRoute role="COORDINATEUR">
            <DashboardCoordinateur />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/affectation/:id"
        element={
          <ProtectedRoute role="COORDINATEUR">
            <AffectationExpert />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/recherche-expert"
        element={
          <ProtectedRoute role="COORDINATEUR">
            <RechercheExpertCoordinateur />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/exceptions"
        element={
          <ProtectedRoute role="COORDINATEUR">
            <GestionExceptions />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/rapport/:id"
        element={
          <ProtectedRoute role="COORDINATEUR">
            <ConsultationRapport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/messages"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <MessagerieCoordinateur />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/messages/:id"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <MessagerieCoordinateur />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coordinateur/temoignages"
        element={
          <ProtectedRoute role="COORDINATEUR">
            <CoordinateurTemoignages />
          </ProtectedRoute>
        }
      />

      {/* Spécialiste */}
      <Route
        path="/specialiste/tableau-de-bord"
        element={
          <ProtectedRoute role="SPECIALISTE">
            <DashboardSpecialiste />
          </ProtectedRoute>
        }
      />
      <Route
        path="/specialiste/redaction/:id"
        element={
          <ProtectedRoute role="SPECIALISTE">
            <RedactionRapportExpert />
          </ProtectedRoute>
        }
      />
      <Route
        path="/specialiste/messagerie"
        element={
          <ProtectedRoute role="SPECIALISTE">
            <MessagerieSpecialiste />
          </ProtectedRoute>
        }
      />
      <Route
        path="/specialiste/messagerie/:id"
        element={
          <ProtectedRoute role="SPECIALISTE">
            <MessagerieSpecialiste />
          </ProtectedRoute>
        }
      />
      <Route
        path="/specialiste/disponibilites"
        element={
          <ProtectedRoute role="SPECIALISTE">
            <DashboardSpecialiste showAvailabilityToggle />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/tableau-de-bord"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/specialistes"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminSpecialistes />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/coordinateurs"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminCoordinateurs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/statistiques"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminStatistiques />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/journal"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminJournal />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  )
}

/** Attente discrete pendant qu'une page chargee a la demande arrive. */
function ChargementPage() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-live="polite">
      <span className="w-6 h-6 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin" />
      <span className="sr-only">Chargement</span>
    </div>
  )
}
