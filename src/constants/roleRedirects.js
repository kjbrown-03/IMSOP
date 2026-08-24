// Where a session lands right after a successful login, shared between the
// normal email/password form (AnimatedLogin) and the OAuth callback page -
// both need to send a freshly-authenticated user to the same place.
export const ROLE_REDIRECTS = {
  PATIENT: '/patient/dossiers',
  SPECIALISTE: '/specialiste/tableau-de-bord',
  MEDECIN_LOCAL: '/medecin/dossiers',
  COORDINATEUR: '/coordinateur/tableau-de-bord',
  ADMIN: '/admin/tableau-de-bord',
}
