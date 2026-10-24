import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Headphones, Square, Volume2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AdminLayout from '../components/layout/AdminLayout'
import CoordinatorLayout from '../components/layout/CoordinatorLayout'
import MedecinShell from '../components/layout/MedecinShell'
import PatientShell from '../components/layout/PatientShell'
import SpecialistShell from '../components/layout/SpecialistShell'

const TUTORIELS = {
  PATIENT: {
    titre: 'Guide du patient', introduction: 'Votre espace vous permet de demander un avis spécialisé et de suivre chaque étape de votre dossier.',
    etapes: [
      ['Créer une demande', 'Choisissez Nouvelle demande, décrivez votre situation et indiquez les informations demandées. Vous pouvez enregistrer un brouillon avant de l’envoyer.'],
      ['Compléter le dossier', 'Ajoutez les documents médicaux utiles, vérifiez les informations et répondez aux éventuelles demandes de compléments.'],
      ['Suivre le traitement', 'Le tableau de bord indique le statut de chaque dossier : vérification, affectation à un spécialiste, analyse ou rapport disponible. Ouvrez un dossier pour lire les détails.'],
      ['Échanger et lire le rapport', 'Utilisez la messagerie liée au dossier pour répondre aux professionnels. Quand le rapport est validé, ouvrez-le depuis votre dossier.'],
      ['Gérer votre compte', 'Dans Profil, mettez à jour vos coordonnées et préférences. Ne partagez pas votre mot de passe ni vos codes de vérification.'],
    ],
  },
  SPECIALISTE: {
    titre: 'Guide du spécialiste', introduction: 'Votre espace rassemble les dossiers qui vous sont confiés et les échanges nécessaires pour rendre un avis.',
    etapes: [
      ['Consulter les dossiers', 'Le tableau de bord présente les nouvelles affectations et leur priorité. Ouvrez chaque dossier pour consulter les informations et pièces accessibles.'],
      ['Accepter ou signaler un problème', 'Suivez les actions proposées sur le dossier. Si vous ne pouvez pas le traiter ou constatez un conflit d’intérêts, utilisez les options de refus ou de récusation disponibles.'],
      ['Analyser et demander des précisions', 'Étudiez les éléments transmis. Si une donnée manque, demandez un complément au patient dans le dossier ou la messagerie.'],
      ['Rédiger et transmettre votre rapport', 'Rédigez votre avis dans l’espace de rapport, relisez-le, puis soumettez-le pour validation. Les statuts vous indiquent quand il a été validé et transmis.'],
      ['Gérer votre activité', 'Dans Disponibilités, indiquez si vous pouvez recevoir de nouvelles demandes. Consultez Messagerie pour répondre, et Justificatifs pour maintenir votre dossier professionnel à jour.'],
    ],
  },
  MEDECIN_LOCAL: {
    titre: 'Guide du médecin traitant', introduction: 'Votre espace sert à suivre vos dossiers et, si vous le souhaitez, à demander un second avis spécialisé.',
    etapes: [
      ['Suivre les dossiers', 'Le tableau de bord liste les dossiers où vous êtes le médecin traitant désigné. Ouvrez un dossier pour consulter son avancement et les messages.'],
      ['Demander un second avis', 'Choisissez Nouvelle demande, décrivez la question médicale et fournissez les informations nécessaires en respectant le consentement du patient.'],
      ['Consulter l’annuaire', 'Dans Annuaire, complétez vos spécialités, votre lieu d’exercice et vos coordonnées. Vous contrôlez la visibilité de votre fiche.'],
      ['Gérer les pièces professionnelles', 'Dans Justificatifs et Profil, maintenez vos documents et vos coordonnées à jour afin que l’équipe puisse vérifier votre activité.'],
      ['Communiquer avec l’équipe', 'Utilisez les messages du dossier pour apporter les précisions demandées et suivre la réponse du spécialiste.'],
    ],
  },
  COORDINATEUR: {
    titre: 'Guide du coordinateur', introduction: 'Votre espace organise la réception, la vérification et l’orientation des demandes vers les bons professionnels.',
    etapes: [
      ['Traiter les dossiers entrants', 'Le tableau de bord met en avant les dossiers à vérifier, les urgences et les rapports à valider. Ouvrez un dossier pour contrôler les informations et les pièces.'],
      ['Affecter un spécialiste', 'Utilisez Recherche d’expert pour trouver un profil adapté, vérifier sa spécialité et ses disponibilités, puis affectez-le au dossier.'],
      ['Suivre les échanges et rapports', 'La messagerie permet de communiquer avec les patients et professionnels. Consultez les rapports soumis, demandez une correction si nécessaire et validez ceux qui sont complets.'],
      ['Maintenir le réseau professionnel', 'Candidatures et Habilitations servent à instruire les demandes d’inscription et les justificatifs. Spécialités et gestion des médecins/spécialistes permettent de garder l’annuaire cohérent.'],
      ['Piloter l’activité', 'Consultez Statistiques et Reversements pour suivre l’activité et les paiements. Exceptions et Témoignages servent au suivi opérationnel prévu par ces rubriques.'],
    ],
  },
  ADMIN: {
    titre: 'Guide de l’administration', introduction: 'Votre espace donne une vue de pilotage sur la plateforme et ses utilisateurs.',
    etapes: [
      ['Lire le tableau de bord', 'Les indicateurs résument les patients, les professionnels, les dossiers et les rapports. Utilisez-les pour repérer les volumes ou les points qui demandent un suivi.'],
      ['Gérer les spécialistes et coordinateurs', 'Les rubriques dédiées permettent de consulter les comptes professionnels et de gérer les accès et leur état selon les actions disponibles.'],
      ['Consulter les statistiques', 'Ouvrez les statistiques pour examiner les tendances d’activité et les principaux indicateurs de la plateforme.'],
      ['Auditer les actions', 'Le Journal conserve les événements importants réalisés dans l’application. Filtrez et consultez les entrées pour comprendre qui a effectué une action et quand.'],
      ['Sécuriser l’accès', 'Utilisez un mot de passe unique, protégez les codes de connexion et déconnectez-vous après usage sur un appareil partagé.'],
    ],
  },
}

const SHELLS = {
  PATIENT: PatientShell,
  SPECIALISTE: SpecialistShell,
  MEDECIN_LOCAL: MedecinShell,
  COORDINATEUR: CoordinatorLayout,
  ADMIN: AdminLayout,
}

export default function TutorielRole({ role }) {
  const { i18n } = useTranslation()
  const [mode, setMode] = useState('lire')
  const [lectureActive, setLectureActive] = useState(false)
  const contenu = useMemo(() => TUTORIELS[role] || TUTORIELS.PATIENT, [role])
  const Shell = SHELLS[role] || PatientShell
  const texte = `${contenu.titre}. ${contenu.introduction} ${contenu.etapes.map(([titre, description]) => `${titre}. ${description}`).join(' ')}`

  useEffect(() => () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
  }, [])

  function ecouter() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const parole = new SpeechSynthesisUtterance(texte)
    parole.lang = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR'
    parole.onstart = () => setLectureActive(true)
    parole.onend = () => setLectureActive(false)
    parole.onerror = () => setLectureActive(false)
    window.speechSynthesis.speak(parole)
  }

  function arreter() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    setLectureActive(false)
  }

  return (
    <Shell>
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-primary-700"><BookOpen className="h-4 w-4" /> Aide de votre espace</p>
          <h2 className="text-2xl font-bold">{contenu.titre}</h2>
          <p className="text-slate-600 dark:text-slate-300">{contenu.introduction}</p>
        </header>
        <div className="flex flex-wrap gap-3" role="group" aria-label="Mode du tutoriel">
          <button type="button" onClick={() => { arreter(); setMode('lire') }} aria-pressed={mode === 'lire'} className={`rounded-full px-5 py-2.5 font-semibold ${mode === 'lire' ? 'bg-primary-700 text-white' : 'border border-slate-300'}`}>
            <BookOpen className="mr-2 inline h-4 w-4" />Lire
          </button>
          <button type="button" onClick={() => { setMode('ecouter'); ecouter() }} aria-pressed={mode === 'ecouter'} className={`rounded-full px-5 py-2.5 font-semibold ${mode === 'ecouter' ? 'bg-primary-700 text-white' : 'border border-slate-300'}`}>
            <Headphones className="mr-2 inline h-4 w-4" />Écouter
          </button>
          {lectureActive && <button type="button" onClick={arreter} className="rounded-full border border-slate-300 px-5 py-2.5 font-semibold"><Square className="mr-2 inline h-4 w-4" />Arrêter</button>}
        </div>
        {mode === 'ecouter' && (typeof window === 'undefined' || !('speechSynthesis' in window)) && <p role="status" className="text-sm text-amber-700">La lecture audio n’est pas disponible dans ce navigateur. Vous pouvez lire le guide ci-dessous.</p>}
        <ol className="space-y-4">
          {contenu.etapes.map(([titre, description], index) => (
            <li key={titre} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
              <h3 className="mb-2 flex items-center gap-3 font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-800">{index + 1}</span>{titre}</h3>
              <p className="leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
            </li>
          ))}
        </ol>
        <p className="flex items-center gap-2 text-xs text-slate-500"><Volume2 className="h-4 w-4" />La lecture audio s’arrête lorsque vous quittez cette page du tableau de bord.</p>
      </section>
    </Shell>
  )
}
