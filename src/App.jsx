import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Placeholder from './pages/Placeholder'
import NotFound from './pages/NotFound'
import SplashScreen from './components/Splashscreen'
import TransitionDamier from './components/ui/TransitionDamier'
import { useThemeStore } from './store/useThemeStore'
import { useAuthStore } from './store/useAuthStore'
import { getCallSocket } from './lib/socket'

import Accueil from './pages/public/Accueil'
import SelectionRole from './pages/auth/SelectionRole'
import ConnexionPatient from './pages/auth/ConnexionPatient'
import ConnexionCoordinateur from './pages/auth/ConnexionCoordinateur'
import ConnexionSpecialiste from './pages/auth/ConnexionSpecialiste'
import ConnexionAdmin from './pages/auth/ConnexionAdmin'
import ConnexionMedecinLocal from './pages/auth/ConnexionMedecinLocal'
import InscriptionMedecinLocal from './pages/auth/InscriptionMedecinLocal'
import VerificationDeuxFacteurs from './pages/auth/VerificationDeuxFacteurs'
import OAuthCallback from './pages/auth/OAuthCallback'
import VerificationEmail from './pages/auth/VerificationEmail'
import MotDePasseOublie from './pages/auth/MotDePasseOublie'
import ReinitialiserMotDePasse from './pages/auth/ReinitialiserMotDePasse'
import InscriptionPatientInfos from './pages/auth/InscriptionPatientInfos'
import InscriptionPatientSecurite from './pages/auth/InscriptionPatientSecurite'
import InscriptionPatientValidation from './pages/auth/InscriptionPatientValidation'
import DashboardPatient from './pages/patient/DashboardPatient'
import QuestionnaireMedical from './pages/patient/QuestionnaireMedical'
import DocumentsUpload from './pages/patient/DocumentsUpload'
import MatchingEnCours from './pages/patient/MatchingEnCours'
import ProfilPatient from './pages/patient/ProfilPatient'
import MonProfil from './pages/MonProfil'
import RapportExpertFinal from './pages/patient/RapportExpertFinal'
import DashboardMedecinLocal from './pages/medecin/DashboardMedecinLocal'
import NouvelleDemandeMedecin from './pages/medecin/NouvelleDemandeMedecin'
import DossierMedecinLocal from './pages/medecin/DossierMedecinLocal'
import MesJustificatifs from './pages/professionnel/MesJustificatifs'
import RevueHabilitations from './pages/coordinateur/RevueHabilitations'
import CoordinateurSpecialistes from './pages/coordinateur/CoordinateurSpecialistes'
import CoordinateurStatistiques from './pages/coordinateur/CoordinateurStatistiques'
import CoordinateurCandidatures from './pages/coordinateur/CoordinateurCandidatures'
import CoordinateurSpecialites from './pages/coordinateur/CoordinateurSpecialites'
import CoordinateurMedecins from './pages/coordinateur/CoordinateurMedecins'
import Candidature from './pages/public/Candidature'
import CoordinateurReversements from './pages/coordinateur/CoordinateurReversements'
import DashboardCoordinateur from './pages/coordinateur/DashboardCoordinateur'
import AffectationExpert from './pages/coordinateur/AffectationExpert'
import RechercheExpertCoordinateur from './pages/coordinateur/RechercheExpertCoordinateur'
import GestionExceptions from './pages/coordinateur/GestionExceptions'
import RevueIdentites from './pages/coordinateur/RevueIdentites'
import ConsultationRapport from './pages/coordinateur/ConsultationRapport'
import DashboardSpecialiste from './pages/specialiste/DashboardSpecialiste'
import RedactionRapportExpert from './pages/specialiste/RedactionRapportExpert'
import PaiementSecurise from './pages/patient/PaiementSecurise'
import AccueilV2 from './pages/public/AccueilV2'
import PourMedecins from './pages/public/PourMedecins'
import AnnuaireRecherche from './pages/public/AnnuaireRecherche'
import AnnuaireResultats from './pages/public/AnnuaireResultats'
import AnnuaireMedecin from './pages/medecin/AnnuaireMedecin'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSpecialistes from './pages/admin/AdminSpecialistes'
import AdminCoordinateurs from './pages/admin/AdminCoordinateurs'
import AdminJournal from './pages/admin/AdminJournal'
import AdminStatistiques from './pages/admin/AdminStatistiques'
import MessagerieSpecialiste from './pages/specialiste/MessagerieSpecialiste'
import MessagerieCoordinateur from './pages/coordinateur/MessagerieCoordinateur'
import CoordinateurTemoignages from './pages/coordinateur/CoordinateurTemoignages'

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

      {/* Monté une seule fois pour toute l'application : l'écran d'arrivée n'a
          rien à déclencher, le damier se retire par-dessus lui. */}
      <TransitionDamier />
      <Routes>
      {/* Public */}
      <Route path="/" element={<Accueil />} />
      <Route path="/accueil-v2" element={<AccueilV2 />} />
      <Route path="/pour-medecins" element={<PourMedecins />} />
      {/* Formulaire de candidature envoyé par le comité scientifique : public,
          aucun compte n'existe encore. Deux variantes : specialiste | medecin. */}
      <Route path="/candidature/:type" element={<Candidature />} />
      {/* Annuaire « Trouver un médecin » : recherche et résultats sont
          publics (les résultats restent floutés tant que rien n'est payé). */}
      <Route path="/annuaire" element={<AnnuaireRecherche />} />
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
        path="/coordinateur/identites"
        element={
          <ProtectedRoute role="COORDINATEUR">
            <RevueIdentites />
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
    </>
  )
}
