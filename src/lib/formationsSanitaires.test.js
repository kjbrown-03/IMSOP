import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import fr from '../i18n/locales/fr.json'
import en from '../i18n/locales/en.json'
import { CATEGORIES_PRIVEES, CATEGORIES_PUBLIQUES, libelleCategorie } from './formationsSanitaires'

const require = createRequire(import.meta.url)
const serveur = require('../../backend/src/lib/formationsSanitaires.js')

describe('catégories de formations sanitaires', () => {
  // Une clé proposée par l'écran et inconnue du serveur rendrait le formulaire
  // impossible à envoyer pour ce choix-là.
  it("l'écran et le serveur proposent les mêmes clés", () => {
    expect(CATEGORIES_PUBLIQUES).toEqual(serveur.CLES_PUBLIQUES)
    expect(CATEGORIES_PRIVEES).toEqual(serveur.CLES_PRIVEES)
  })

  it('chaque clé a un libellé dans les deux langues', () => {
    for (const cle of [...CATEGORIES_PUBLIQUES, ...CATEGORIES_PRIVEES]) {
      expect(fr.candidature.categories[cle]?.nom).toBeTruthy()
      expect(en.candidature.categories[cle]?.nom).toBeTruthy()
    }
  })

  it("le numéro de catégorie n'apparaît qu'au Cameroun", () => {
    // Comme i18next : une traduction absente renvoie la clé brute.
    const t = (cle) => {
      const [, , entree, champ] = cle.split('.')
      return fr.candidature.categories[entree][champ] ?? cle
    }
    expect(libelleCategorie(t, 'CMA', 'cm')).toBe("5e catégorie — Centre médical d'arrondissement (CMA)")
    expect(libelleCategorie(t, 'CMA', 'ga')).toBe("Centre médical d'arrondissement (CMA)")
    expect(libelleCategorie(t, 'CLINIQUE', 'cm')).toBe('Clinique')
  })
})
