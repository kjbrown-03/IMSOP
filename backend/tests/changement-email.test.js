require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerMedecinLocal, creerUtilisateur } = require('./helpers/factories')

test.beforeEach(viderBase)
test.after(fermerBase)

const MDP = 'MotDePasse123'
const CODE = '424242'

// Le code réel n'est lu nulle part : on remplace son empreinte par celle d'un
// code connu, construite comme le contrôleur la construit (code + adresse).
async function poserCodeConnu(userId, email) {
  const empreinte = crypto.createHash('sha256').update(`${CODE}:${email}`).digest('hex')
  await prisma.twoFactorChallenge.updateMany({
    where: { userId, purpose: 'CHANGEMENT_EMAIL', consumedAt: null },
    data: { codeHash: empreinte },
  })
}

function demander(user, nouvelEmail, motDePasse = MDP) {
  return api()
    .post('/api/auth/email')
    .set('Authorization', entete(user))
    .send({ nouvelEmail, motDePasse })
}

test("Ajout ou changement d'adresse e-mail", async (t) => {
  // Le cas qui a motivé la fonction : un tradipraticien importé sans adresse.
  await t.test("un tradipraticien enrôlé sans adresse ajoute la sienne", async () => {
    const user = await creerUtilisateur('TRADIPRATICIEN', {
      email: 'tp-0123456789abcdef@tradipraticiens.imsop.invalid',
      emailVerified: false,
      motDePasse: MDP,
    })

    const me = await api().get('/api/auth/me').set('Authorization', entete(user)).expect(200)
    assert.equal(me.body.sansEmail, true)

    const demande = await demander(user, 'Guerisseur@Exemple.cm').expect(200)
    assert.equal(demande.body.email, 'guerisseur@exemple.cm')

    // Rien ne change avant la confirmation.
    const entre = await prisma.user.findUnique({ where: { id: user.id } })
    assert.match(entre.email, /\.invalid$/)

    await poserCodeConnu(user.id, 'guerisseur@exemple.cm')
    const fin = await api()
      .post('/api/auth/email/confirmation')
      .set('Authorization', entete(user))
      .send({ jeton: demande.body.jeton, code: CODE })
      .expect(200)

    assert.equal(fin.body.email, 'guerisseur@exemple.cm')
    assert.equal(fin.body.sansEmail, false)
    const apres = await prisma.user.findUnique({ where: { id: user.id } })
    assert.equal(apres.email, 'guerisseur@exemple.cm')
    assert.equal(apres.emailVerified, true)
    assert.ok(await prisma.auditLog.findFirst({ where: { action: 'EMAIL_MODIFIE', entityId: user.id } }))
  })

  await t.test('un médecin traitant corrige une adresse mal saisie', async () => {
    const { user } = await creerMedecinLocal({ email: 'docteur@faute.cm', motDePasse: MDP })
    const demande = await demander(user, 'docteur@bonne.cm').expect(200)
    await poserCodeConnu(user.id, 'docteur@bonne.cm')
    await api()
      .post('/api/auth/email/confirmation')
      .set('Authorization', entete(user))
      .send({ jeton: demande.body.jeton, code: CODE })
      .expect(200)
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).email, 'docteur@bonne.cm')
  })

  await t.test('sans le bon mot de passe, aucun code ne part', async () => {
    const { user } = await creerMedecinLocal({ motDePasse: MDP })
    await demander(user, 'autre@exemple.cm', 'PasLeBon999').expect(400)
    assert.equal(await prisma.twoFactorChallenge.count({ where: { userId: user.id, purpose: 'CHANGEMENT_EMAIL' } }), 0)
  })

  await t.test("une adresse déjà prise par un autre compte est refusée", async () => {
    await creerUtilisateur('PATIENT', { email: 'prise@exemple.cm' })
    const { user } = await creerMedecinLocal({ motDePasse: MDP })
    await demander(user, 'prise@exemple.cm').expect(409)
  })

  await t.test('une adresse en .invalid est refusée', async () => {
    const { user } = await creerMedecinLocal({ motDePasse: MDP })
    await demander(user, 'x@tradipraticiens.imsop.invalid').expect(400)
  })

  await t.test('un mauvais code ne change rien', async () => {
    const { user } = await creerMedecinLocal({ email: 'avant@exemple.cm', motDePasse: MDP })
    const demande = await demander(user, 'apres@exemple.cm').expect(200)
    await poserCodeConnu(user.id, 'apres@exemple.cm')
    await api()
      .post('/api/auth/email/confirmation')
      .set('Authorization', entete(user))
      .send({ jeton: demande.body.jeton, code: '000000' })
      .expect(401)
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).email, 'avant@exemple.cm')
  })

  // Le code est lié à l'adresse : reçu pour l'une, il ne valide pas un jeton
  // forgé pour une autre.
  await t.test("le code reçu pour une adresse ne vaut pas pour une autre", async () => {
    const { user } = await creerMedecinLocal({ email: 'avant@exemple.cm', motDePasse: MDP })
    await demander(user, 'recue@exemple.cm').expect(200)
    await poserCodeConnu(user.id, 'recue@exemple.cm')

    const jwt = require('jsonwebtoken')
    const env = require('../src/config/env')
    const forge = jwt.sign({ sub: user.id, purpose: 'changement-email', email: 'pirate@exemple.cm' }, env.jwt.accessSecret)
    await api()
      .post('/api/auth/email/confirmation')
      .set('Authorization', entete(user))
      .send({ jeton: forge, code: CODE })
      .expect(401)
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).email, 'avant@exemple.cm')
  })

  await t.test("le jeton d'un autre compte est refusé", async () => {
    const { user: a } = await creerMedecinLocal({ motDePasse: MDP })
    const { user: b } = await creerMedecinLocal({ motDePasse: MDP })
    const demande = await demander(a, 'nouvelle@exemple.cm').expect(200)
    await poserCodeConnu(a.id, 'nouvelle@exemple.cm')
    await api()
      .post('/api/auth/email/confirmation')
      .set('Authorization', entete(b))
      .send({ jeton: demande.body.jeton, code: CODE })
      .expect(401)
  })
})

// Le navigateur mémorise la saisie de la connexion, blanc final compris, et la
// repropose dans « mot de passe actuel » : la connexion l'acceptait, le
// changement de mot de passe la refusait.
test('Changement de mot de passe : blanc en bordure toléré comme à la connexion', async () => {
  const { user } = await creerMedecinLocal({ motDePasse: MDP })
  await api()
    .post('/api/auth/mot-de-passe')
    .set('Authorization', entete(user))
    .send({ motDePasseActuel: `${MDP} \n`, nouveauMotDePasse: 'NouveauSecret2026' })
    .expect(200)
})
