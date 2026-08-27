// Sessions cloisonnées par rôle.
//
// L'application stockait UNE session sous trois clés fixes : se connecter en
// spécialiste écrasait donc la session patient, dans tous les onglets à la fois.
// Chaque rôle a désormais son propre emplacement, et chaque ONGLET retient le
// rôle qu'il utilise — d'où le sessionStorage, isolé par onglet, là où le
// localStorage est partagé.

export const ROLES = ['PATIENT', 'SPECIALISTE', 'MEDECIN_LOCAL', 'COORDINATEUR', 'ADMIN']

const CLE_ROLE_ACTIF = 'imsop_role_actif' // sessionStorage : propre à l'onglet
const CLE_DERNIER_ROLE = 'imsop_dernier_role' // localStorage : sert aux nouveaux onglets

const cleSession = (role) => `imsop_session_${role}`

// Chaque espace applicatif a son préfixe d'URL : un onglet ouvert directement
// sur /specialiste/... reprend ainsi la bonne session sans passer par l'écran de
// connexion. Les chemins partagés (/profil, /professionnel/...) sont absents
// volontairement : ils ne doivent pas changer le rôle actif de l'onglet.
const PREFIXES_ROLE = [
  ['/patient', 'PATIENT'],
  ['/specialiste', 'SPECIALISTE'],
  ['/medecin', 'MEDECIN_LOCAL'],
  ['/coordinateur', 'COORDINATEUR'],
  ['/admin', 'ADMIN'],
]

// Navigation privée, stockage désactivé, quota dépassé : aucune de ces
// situations ne doit faire planter l'application.
function lireBrut(stockage, cle) {
  try {
    return stockage.getItem(cle)
  } catch {
    return null
  }
}

function ecrireBrut(stockage, cle, valeur) {
  try {
    stockage.setItem(cle, valeur)
  } catch {
    /* stockage indisponible : la session ne survivra pas au rechargement */
  }
}

function effacerBrut(stockage, cle) {
  try {
    stockage.removeItem(cle)
  } catch {
    /* rien à faire */
  }
}

// Le `sub` du JWT est l'identité qui fait foi. Un profil mis en cache qui ne
// correspond pas au jeton est un reste d'une session précédente : on le jette.
function sujetDuJeton(token) {
  try {
    const partie = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const rembourre = partie + '='.repeat((4 - (partie.length % 4)) % 4)
    return JSON.parse(atob(rembourre)).sub || null
  } catch {
    return null
  }
}

export function lireSession(role) {
  if (!role) return null
  const brut = lireBrut(localStorage, cleSession(role))
  if (!brut) return null

  let session
  try {
    session = JSON.parse(brut)
  } catch {
    effacerBrut(localStorage, cleSession(role))
    return null
  }

  if (!session?.accessToken || !session?.user) return null
  // Un rôle ne peut contenir que la session de ce rôle.
  if (session.user.role !== role) {
    effacerBrut(localStorage, cleSession(role))
    return null
  }
  const sujet = sujetDuJeton(session.accessToken)
  if (sujet && session.user.id && sujet !== session.user.id) {
    effacerBrut(localStorage, cleSession(role))
    return null
  }
  return session
}

export function ecrireSession(role, session) {
  if (!role) return
  ecrireBrut(localStorage, cleSession(role), JSON.stringify(session))
}

export function supprimerSession(role) {
  if (!role) return
  effacerBrut(localStorage, cleSession(role))
  if (lireBrut(localStorage, CLE_DERNIER_ROLE) === role) {
    effacerBrut(localStorage, CLE_DERNIER_ROLE)
  }
  if (lireBrut(sessionStorage, CLE_ROLE_ACTIF) === role) {
    effacerBrut(sessionStorage, CLE_ROLE_ACTIF)
  }
}

export function rolesConnectes() {
  return ROLES.filter((role) => lireSession(role))
}

export function roleDepuisChemin(chemin = window.location.pathname) {
  const trouve = PREFIXES_ROLE.find(([prefixe]) => chemin === prefixe || chemin.startsWith(`${prefixe}/`))
  return trouve ? trouve[1] : null
}

export function definirRoleActif(role) {
  if (!role) {
    effacerBrut(sessionStorage, CLE_ROLE_ACTIF)
    return
  }
  ecrireBrut(sessionStorage, CLE_ROLE_ACTIF, role)
  ecrireBrut(localStorage, CLE_DERNIER_ROLE, role)
}

// Ordre de résolution : ce que cet onglet utilisait, puis l'espace où l'on se
// trouve, puis le dernier rôle utilisé sur ce navigateur, et enfin l'unique
// session ouverte s'il n'y en a qu'une.
export function roleActif() {
  const deLOnglet = lireBrut(sessionStorage, CLE_ROLE_ACTIF)
  if (deLOnglet && lireSession(deLOnglet)) return deLOnglet

  const duChemin = roleDepuisChemin()
  if (duChemin && lireSession(duChemin)) {
    definirRoleActif(duChemin)
    return duChemin
  }

  const dernier = lireBrut(localStorage, CLE_DERNIER_ROLE)
  if (dernier && lireSession(dernier)) {
    definirRoleActif(dernier)
    return dernier
  }

  const ouvertes = rolesConnectes()
  if (ouvertes.length === 1) {
    definirRoleActif(ouvertes[0])
    return ouvertes[0]
  }
  return null
}

export function sessionActive() {
  return lireSession(roleActif())
}

// Reprise des sessions créées avant le cloisonnement : sans ça, tout le monde
// se retrouverait déconnecté au déploiement.
export function migrerAncienneSession() {
  const accessToken = lireBrut(localStorage, 'imsop_access_token')
  const refreshToken = lireBrut(localStorage, 'imsop_refresh_token')
  const brutUser = lireBrut(localStorage, 'imsop_user')
  if (!accessToken || !brutUser) return

  try {
    const user = JSON.parse(brutUser)
    if (user?.role && ROLES.includes(user.role)) {
      ecrireSession(user.role, { accessToken, refreshToken, user })
      definirRoleActif(user.role)
    }
  } catch {
    /* données illisibles : on les jette avec le reste */
  }

  for (const cle of ['imsop_access_token', 'imsop_refresh_token', 'imsop_user']) {
    effacerBrut(localStorage, cle)
  }
}
