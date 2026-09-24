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
const { appelAutorise, creerRegistreAppels } = require('../src/services/callSignalingService')

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

// Le contrôle d'accès ne portait que sur l'invitation : acceptation, refus,
// SDP/ICE et raccrochage relayaient vers n'importe quel `toUserId` fourni par
// le client. Le registre est ce qui referme ce relais — d'où ces tests, qui
// n'ont besoin d'aucune base.
test('Appel vidéo — registre des sessions autorisées', async (t) => {
  const A = 'utilisateur-a'
  const B = 'utilisateur-b'
  const C = 'utilisateur-c'

  await t.test('sans invitation, aucune session', () => {
    const registre = creerRegistreAppels()
    assert.equal(registre.trouver(A, B), null)
  })

  await t.test('une invitation ouvre une session lisible dans les deux sens', () => {
    const registre = creerRegistreAppels()
    registre.ouvrir(A, B, 'dossier-1')

    const vueAppelant = registre.trouver(A, B)
    const vueAppele = registre.trouver(B, A)

    assert.ok(vueAppelant)
    assert.equal(vueAppelant, vueAppele)
    assert.equal(vueAppelant.dossierId, 'dossier-1')
    assert.equal(vueAppelant.initiateur, A)
    assert.equal(vueAppelant.invite, B)
    assert.equal(vueAppelant.acceptee, false)
  })

  await t.test("un tiers n'atteint aucune des deux parties", () => {
    const registre = creerRegistreAppels()
    registre.ouvrir(A, B, 'dossier-1')

    assert.equal(registre.trouver(C, A), null)
    assert.equal(registre.trouver(C, B), null)
  })

  await t.test('accepter marque la session, sans en ouvrir une autre', () => {
    const registre = creerRegistreAppels()
    registre.ouvrir(A, B, 'dossier-1')
    registre.marquerAcceptee(registre.trouver(A, B))

    assert.equal(registre.trouver(B, A).acceptee, true)
    assert.equal(registre.trouver(A, C), null)
  })

  await t.test('fermer coupe le relais dans les deux sens', () => {
    const registre = creerRegistreAppels()
    registre.ouvrir(A, B, 'dossier-1')
    registre.fermer(B, A)

    assert.equal(registre.trouver(A, B), null)
    assert.equal(registre.trouver(B, A), null)
  })

  await t.test('une déconnexion rend les correspondants à prévenir', () => {
    const registre = creerRegistreAppels()
    registre.ouvrir(A, B, 'dossier-1')
    registre.ouvrir(C, A, 'dossier-2')

    const correspondants = registre.fermerTout(A)

    assert.equal(correspondants.length, 2)
    assert.deepEqual(
      correspondants.map((c) => c.userId).sort(),
      [B, C].sort(),
    )
    assert.equal(registre.trouver(A, B), null)
    assert.equal(registre.trouver(A, C), null)
  })

  await t.test("la déconnexion d'un tiers ne ferme pas la session des autres", () => {
    const registre = creerRegistreAppels()
    registre.ouvrir(A, B, 'dossier-1')

    assert.deepEqual(registre.fermerTout(C), [])
    assert.ok(registre.trouver(A, B))
  })
})
