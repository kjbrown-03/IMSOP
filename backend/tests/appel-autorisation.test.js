require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { viderBase, fermerBase } = require('./helpers/db')
const {
  creerPatient,
  creerSpecialiste,
  creerMedecinLocal,
  creerCoordinateur,
  creerAdmin,
  creerDossier,
} = require('./helpers/factories')
const { appelAutorise } = require('../src/services/callSignalingService')

test.beforeEach(viderBase)
test.after(fermerBase)

// L'appel vidéo suit la même règle que la messagerie : coordination <->
// spécialiste assigné. La version précédente cherchait l'appelant dans la liste
// patient / spécialiste / médecin local, dont les coordinateurs sont absents —
// or c'est le seul rôle dont l'interface propose d'appeler. Aucune invitation
// n'atteignait donc jamais son destinataire.
test("Appel vidéo — qui peut appeler qui", async (t) => {
  await t.test('un coordinateur peut appeler le spécialiste du dossier', async () => {
    const { user: specialisteUser, specialiste } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur()
    const dossier = await creerDossier({ specialiste })

    assert.equal(await appelAutorise(dossier.id, coordinateur.id, specialisteUser.id), true)
  })

  await t.test('le spécialiste peut rappeler la coordination', async () => {
    const { user: specialisteUser, specialiste } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur()
    const dossier = await creerDossier({ specialiste })

    assert.equal(await appelAutorise(dossier.id, specialisteUser.id, coordinateur.id), true)
  })

  await t.test('un admin est traité comme la coordination', async () => {
    const { user: specialisteUser, specialiste } = await creerSpecialiste()
    const admin = await creerAdmin()
    const dossier = await creerDossier({ specialiste })

    assert.equal(await appelAutorise(dossier.id, admin.id, specialisteUser.id), true)
  })

  await t.test("un patient ne peut pas appeler le spécialiste", async () => {
    const { user: patientUser, patient } = await creerPatient()
    const { user: specialisteUser, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ patient, specialiste })

    assert.equal(await appelAutorise(dossier.id, patientUser.id, specialisteUser.id), false)
  })

  await t.test("un médecin local ne peut pas appeler le spécialiste", async () => {
    const { user: medecinUser, medecinLocal } = await creerMedecinLocal()
    const { user: specialisteUser, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ medecinLocal, specialiste })

    assert.equal(await appelAutorise(dossier.id, medecinUser.id, specialisteUser.id), false)
  })

  await t.test("un coordinateur ne peut pas appeler un spécialiste d'un autre dossier", async () => {
    const { specialiste } = await creerSpecialiste()
    const { user: autreSpecialisteUser } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur()
    const dossier = await creerDossier({ specialiste })

    assert.equal(await appelAutorise(dossier.id, coordinateur.id, autreSpecialisteUser.id), false)
  })

  await t.test("un dossier sans spécialiste assigné n'ouvre aucun canal", async () => {
    const { user: specialisteUser } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur()
    const dossier = await creerDossier({ status: 'EN_ATTENTE_AFFECTATION' })

    assert.equal(await appelAutorise(dossier.id, coordinateur.id, specialisteUser.id), false)
  })

  await t.test('un compte désactivé ne reçoit pas d\'appel', async () => {
    const { user: specialisteUser, specialiste } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur({ actif: false })
    const dossier = await creerDossier({ specialiste })

    assert.equal(await appelAutorise(dossier.id, coordinateur.id, specialisteUser.id), false)
  })

  await t.test('on ne peut pas s\'appeler soi-même', async () => {
    const { user: specialisteUser, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ specialiste })

    assert.equal(await appelAutorise(dossier.id, specialisteUser.id, specialisteUser.id), false)
  })

  await t.test('un dossier inexistant est refusé', async () => {
    const { user: specialisteUser } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur()

    assert.equal(
      await appelAutorise('00000000-0000-0000-0000-000000000000', coordinateur.id, specialisteUser.id),
      false,
    )
  })
})
