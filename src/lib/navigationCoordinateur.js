import {
  Banknote,
  ClipboardList,
  HeartPulse,
  BarChart3,
  BadgeCheck,
  LayoutDashboard,
  ListChecks,
  MessageCircleHeart,
  MessageSquare,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserCog,
} from 'lucide-react'

/**
 * Navigation de l'espace coordinateur, déclarée une seule fois.
 *
 * Deux écrans la rendent : la coquille habituelle (`CoordinatorLayout`) et la
 * messagerie, qui a sa propre barre latérale. Cette dernière recopiait deux
 * entrées à la main — ouvrir « Messages » faisait donc disparaître tous les
 * autres onglets, et chaque écran ajouté ici manquait là-bas.
 *
 * Les icônes sont des composants, pas des éléments : chaque écran les rend à
 * sa taille.
 */
export const LIENS_COORDINATEUR = [
  { to: '/coordinateur/tableau-de-bord', cle: 'dashboard', icone: LayoutDashboard },
  // « Dossiers » pointait ici aussi : deux entrees pour une seule adresse, donc
  // deux onglets allumes au meme clic. Et l'ecran n'a jamais liste de dossiers,
  // c'est la recherche d'experts — les dossiers sont sur le tableau de bord.
  { to: '/coordinateur/recherche-expert', cle: 'experts', icone: Stethoscope },
  { to: '/coordinateur/messages', cle: 'messages', icone: MessageSquare },
  { to: '/coordinateur/identites', cle: 'identites', icone: ShieldCheck },
  { to: '/coordinateur/statistiques', cle: 'statistiques', icone: BarChart3 },
  { to: '/coordinateur/candidatures', cle: 'candidatures', icone: ClipboardList },
  { to: '/coordinateur/specialites', cle: 'specialites', icone: ListChecks },
  { to: '/coordinateur/specialistes', cle: 'gestionExperts', icone: UserCog },
  { to: '/coordinateur/medecins', cle: 'gestionMedecins', icone: HeartPulse },
  { to: '/coordinateur/reversements', cle: 'reversements', icone: Banknote },
  { to: '/coordinateur/habilitations', cle: 'habilitations', icone: BadgeCheck },
  { to: '/coordinateur/exceptions', cle: 'parametres', icone: Settings },
  { to: '/coordinateur/temoignages', cle: 'temoignages', icone: MessageCircleHeart },
]
