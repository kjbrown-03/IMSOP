require('./helpers/env')
const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { trier } = require('../src/lib/triage')
const CORPUS = require('./helpers/corpus-symptomes')

/*
 * Audit du dictionnaire de triage, fige en test.
 *
 * Il est ne d'un defaut signale a l'usage : un patient decrivait un probleme
 * cardiaque et l'annuaire ne lui proposait aucun cardiologue. Le medecin etait
 * en regle ; c'est le dictionnaire qui ne connaissait ni « douleurs
 * thoraciques » ni « infarctus ».
 *
 * En passant les 19 specialites au crible avec des phrases telles qu'un patient
 * les formule, 13 trous du meme genre sont apparus : « je suis constipe »
 * (le dictionnaire ne savait que « constipation »), « j'entends mal » (le 's'
 * de la conjugaison cassait le motif), « je suis diabetique », « mes yeux sont
 * jaunes » qui partait en ophtalmologie.
 *
 * D'ou ce test : le dictionnaire est ecrit a la main, il grandira, et rien
 * n'avertit quand une formulation courante cesse d'etre reconnue.
 */
describe('Triage — corpus de formulations de patients', () => {
  for (const [attendue, phrase] of CORPUS) {
    test(`« ${phrase} » oriente vers ${attendue}`, () => {
      const obtenues = trier(phrase).specialites
      assert.ok(
        obtenues.includes(attendue),
        `attendu ${attendue}, obtenu ${obtenues.join(', ') || '(aucune)'}`,
      )
    })
  }

  // L'inverse compte autant : un dictionnaire trop large proposerait a chacun
  // la moitie des specialites, et ne vaudrait pas mieux qu'une liste.
  const HORS_SUJET = [
    ['je suis fatigue tout le temps', 'cardiologie'],
    ['j ai soif apres le sport', 'endocrinologie'],
    ['j ai une toux grasse', 'cardiologie'],
    ['j ai des boutons qui grattent', 'oncologie'],
  ]

  for (const [phrase, interdite] of HORS_SUJET) {
    test(`« ${phrase} » ne part pas en ${interdite}`, () => {
      assert.ok(!trier(phrase).specialites.includes(interdite))
    })
  }
})
