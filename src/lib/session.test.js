import { beforeEach, describe, expect, test } from 'vitest'
import {
  ROLES,
  definirRoleActif,
  ecrireSession,
  lireSession,
  migrerAncienneSession,
  roleActif,
  roleDepuisChemin,
  rolesConnectes,
  sessionActive,
  supprimerSession,
} from './session'

// Fabrique un JWT de forme valide : seule la charge utile est lue ici
// (`sujetDuJeton` décode le `sub`), la signature n'est jamais vérifiée côté
// navigateur — c'est le serveur qui s'en charge.
function jetonPour(sub) {
  const charge = btoa(JSON.stringify({ sub })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `entete.${charge}.signature`
}

function session(role, id = `${role}-1`) {
  return {
    accessToken: jetonPour(id),
    refreshToken: `refresh-${id}`,
    user: { id, role, fullName: `Compte ${role}` },
  }
}

describe('Sessions cloisonnées par rôle', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  test('une session écrite est relue à l\'identique', () => {
    ecrireSession('PATIENT', session('PATIENT'))

    expect(lireSession('PATIENT')).toMatchObject({ user: { role: 'PATIENT', id: 'PATIENT-1' } })
  })

  // La régression d'origine : se connecter en spécialiste écrasait la session
  // patient dans tous les onglets à la fois. C'est ce que ce test empêche de
  // revenir.
  test('deux rôles coexistent sans s\'écraser', () => {
    ecrireSession('PATIENT', session('PATIENT'))
    ecrireSession('SPECIALISTE', session('SPECIALISTE'))

    expect(lireSession('PATIENT').user.id).toBe('PATIENT-1')
    expect(lireSession('SPECIALISTE').user.id).toBe('SPECIALISTE-1')
    expect(rolesConnectes()).toEqual(['PATIENT', 'SPECIALISTE'])
  })

  test('se déconnecter d\'un rôle laisse les autres ouverts', () => {
    ecrireSession('PATIENT', session('PATIENT'))
    ecrireSession('ADMIN', session('ADMIN'))

    supprimerSession('PATIENT')

    expect(lireSession('PATIENT')).toBeNull()
    expect(lireSession('ADMIN')).not.toBeNull()
  })

  describe('Rejet des sessions incohérentes', () => {
    test('une session rangée sous un rôle qui n\'est pas le sien est jetée', () => {
      // Écriture volontairement croisée : le profil dit SPECIALISTE, la clé dit PATIENT.
      ecrireSession('PATIENT', session('SPECIALISTE'))

      expect(lireSession('PATIENT')).toBeNull()
      // Et la clé est purgée, pas seulement ignorée.
      expect(localStorage.getItem('imsop_session_PATIENT')).toBeNull()
    })

    test('un profil qui ne correspond pas au sujet du jeton est jeté', () => {
      // Cas réel : un reste de session précédente, dont le profil en cache
      // n'appartient pas au compte que le jeton désigne. Le `sub` du JWT fait foi.
      ecrireSession('PATIENT', {
        accessToken: jetonPour('un-autre-compte'),
        refreshToken: 'refresh',
        user: { id: 'PATIENT-1', role: 'PATIENT' },
      })

      expect(lireSession('PATIENT')).toBeNull()
    })

    test('une entrée illisible est jetée sans faire planter l\'application', () => {
      localStorage.setItem('imsop_session_PATIENT', '{ceci nest pas du json')

      expect(lireSession('PATIENT')).toBeNull()
      expect(localStorage.getItem('imsop_session_PATIENT')).toBeNull()
    })

    test('une session sans jeton ou sans profil est ignorée', () => {
      ecrireSession('PATIENT', { refreshToken: 'refresh', user: { id: 'x', role: 'PATIENT' } })
      expect(lireSession('PATIENT')).toBeNull()

      ecrireSession('ADMIN', { accessToken: jetonPour('x') })
      expect(lireSession('ADMIN')).toBeNull()
    })

    test('lireSession sans rôle renvoie null', () => {
      expect(lireSession(null)).toBeNull()
      expect(lireSession(undefined)).toBeNull()
    })
  })

  describe('Rôle déduit du chemin', () => {
    test.each([
      ['/patient/dossiers', 'PATIENT'],
      ['/specialiste/tableau-de-bord', 'SPECIALISTE'],
      ['/medecin/dossiers', 'MEDECIN_LOCAL'],
      ['/coordinateur/tableau-de-bord', 'COORDINATEUR'],
      ['/admin/journal', 'ADMIN'],
    ])('%s correspond à %s', (chemin, attendu) => {
      expect(roleDepuisChemin(chemin)).toBe(attendu)
    })

    // Ces chemins sont partagés entre plusieurs espaces : les rattacher à un
    // rôle ferait basculer l'onglet au premier clic dans le menu.
    test.each(['/profil', '/professionnel/justificatifs', '/', '/connexion'])(
      '%s ne change pas le rôle actif',
      (chemin) => {
        expect(roleDepuisChemin(chemin)).toBeNull()
      },
    )

    test('un préfixe partiel ne compte pas', () => {
      expect(roleDepuisChemin('/patientele')).toBeNull()
    })
  })

  describe('Résolution du rôle actif', () => {
    test('le rôle mémorisé par l\'onglet est prioritaire', () => {
      ecrireSession('PATIENT', session('PATIENT'))
      ecrireSession('ADMIN', session('ADMIN'))
      definirRoleActif('ADMIN')

      expect(roleActif()).toBe('ADMIN')
      expect(sessionActive().user.role).toBe('ADMIN')
    })

    test('une seule session ouverte est choisie d\'office', () => {
      ecrireSession('COORDINATEUR', session('COORDINATEUR'))

      expect(roleActif()).toBe('COORDINATEUR')
    })

    test('sans aucune session, il n\'y a pas de rôle actif', () => {
      expect(roleActif()).toBeNull()
      expect(sessionActive()).toBeNull()
    })

    test('un rôle actif dont la session a disparu ne bloque pas la résolution', () => {
      ecrireSession('PATIENT', session('PATIENT'))
      definirRoleActif('PATIENT')
      supprimerSession('PATIENT')
      ecrireSession('ADMIN', session('ADMIN'))

      expect(roleActif()).toBe('ADMIN')
    })
  })

  // Sans cette reprise, le déploiement du cloisonnement aurait déconnecté
  // d'un coup tous les utilisateurs déjà en session.
  describe('Reprise des anciennes sessions', () => {
    test('l\'ancien format est converti puis effacé', () => {
      localStorage.setItem('imsop_access_token', jetonPour('ancien-1'))
      localStorage.setItem('imsop_refresh_token', 'ancien-refresh')
      localStorage.setItem('imsop_user', JSON.stringify({ id: 'ancien-1', role: 'PATIENT' }))

      migrerAncienneSession()

      expect(lireSession('PATIENT').user.id).toBe('ancien-1')
      expect(localStorage.getItem('imsop_access_token')).toBeNull()
      expect(localStorage.getItem('imsop_user')).toBeNull()
    })

    test('un rôle inconnu n\'est pas repris', () => {
      localStorage.setItem('imsop_access_token', jetonPour('x'))
      localStorage.setItem('imsop_user', JSON.stringify({ id: 'x', role: 'INTRUS' }))

      migrerAncienneSession()

      expect(rolesConnectes()).toEqual([])
    })

    test('sans ancienne session, la migration ne fait rien', () => {
      expect(() => migrerAncienneSession()).not.toThrow()
      expect(rolesConnectes()).toEqual([])
    })
  })

  test('la liste des rôles couvre tous les espaces de l\'application', () => {
    expect(ROLES).toEqual(['PATIENT', 'SPECIALISTE', 'MEDECIN_LOCAL', 'COORDINATEUR', 'ADMIN'])
  })
})
