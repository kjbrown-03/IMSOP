import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Placeholder from './pages/Placeholder'
import { useThemeStore } from './store/useThemeStore'

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
import ChatSecurise from './pages/patient/ChatSecurise'
import Messagerie from './pages/patient/Messagerie'
import RapportExpertFinal from './pages/patient/RapportExpertFinal'
import MonMedecinTraitant from './pages/patient/MonMedecinTraitant'
import DashboardMedecinLocal from './pages/medecin/DashboardMedecinLocal'
import DossierMedecinLocal from './pages/medecin/DossierMedecinLocal'
import MesJustificatifs from './pages/professionnel/MesJustificatifs'
import RevueHabilitations from './pages/coordinateur/RevueHabilitations'
import DashboardCoordinateur from './pages/coordinateur/DashboardCoordinateur'
import AffectationExpert from './pages/coordinateur/AffectationExpert'
import RechercheExpertCoordinateur from './pages/coordinateur/RechercheExpertCoordinateur'
import GestionExceptions from './pages/coordinateur/GestionExceptions'
import RevueIdentites from './pages/coordinateur/RevueIdentites'
import DashboardSpecialiste from './pages/specialiste/DashboardSpecialiste'
import RedactionRapportExpert from './pages/specialiste/RedactionRapportExpert'
import PaiementSecurise from './pages/patient/PaiementSecurise'
import AccueilV2 from './pages/public/AccueilV2'
import PourMedecins from './pages/public/PourMedecins'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSpecialistes from './pages/admin/AdminSpecialistes'
import AdminCoordinateurs from './pages/admin/AdminCoordinateurs'
import AdminJournal from './pages/admin/AdminJournal'
import MessagerieSpecialiste from './pages/specialiste/MessagerieSpecialiste'

export default function App() {
  const initTheme = useThemeStore((state) => state.initTheme)

  useEffect(() => {
    initTheme()
  }, [initTheme])

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Accueil />} />
      <Route path="/accueil-v2" element={<AccueilV2 />} />
      <Route path="/pour-medecins" element={<PourMedecins />} />

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
        path="/patient/medecins"
        element={
          <ProtectedRoute role="PATIENT">
            <MonMedecinTraitant />
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
        path="/medecin/messages/:id"
        element={
          <ProtectedRoute role="MEDECIN_LOCAL">
            <ChatSecurise />
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
        path="/coordinateur/habilitations"
        element={
          <ProtectedRoute role={['COORDINATEUR', 'ADMIN']}>
            <RevueHabilitations />
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
        path="/patient/messages"
        element={
          <ProtectedRoute role="PATIENT">
            <Messagerie />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/messages/:id"
        element={
          <ProtectedRoute role="PATIENT">
            <Messagerie />
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
        path="/admin/journal"
        element={
          <ProtectedRoute role="ADMIN">
            <AdminJournal />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Placeholder title="Page introuvable" />} />
    </Routes>
  )
}
