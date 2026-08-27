require('./helpers/env')
const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('crypto')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api } = require('./helpers/http')
const f = require('./helpers/factories')

const hacher = (valeur) => crypto.createHash('sha256').update(valeur).digest('hex')

// Remplace le code du dernier challenge émis par une valeur connue. Le code
// réel n'est stocké que haché — impossible à relire — et il n'apparaît que
// dans les logs du serveur. Le récupérer par ce détour rendrait la suite
// dépendante d'un format de log ; on réécrit donc l'empreinte, ce qui laisse
// intacte la mécanique vérifiée ici (expiration, compteur d'essais,
// consommation à usage unique).
async function fixerCode(userId, code) {
  const challenge = await prisma.twoFactorChallenge.findFirst({
    where: { userId, purpose: 'LOGIN_2FA', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  assert.ok(challenge, 'aucun challenge 2FA en attente pour ce compte')
  await prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { codeHash: hacher(code) } })
  return challenge
}

describe('Authentification', () => {
  beforeEach(async () => {
    await viderBase()
  })

  after(async () => {
    await viderBase()
    await fermerBase()
  })

  describe('Connexion', () => {
    test('un patient obtient une session complète', async () => {
      const { user } = await f.creerPatient()

      const res = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })

      assert.equal(res.status, 200)
      assert.ok(res.body.accessToken)
      assert.ok(res.body.refreshToken)
      assert.equal(res.body.user.email, user.email)
      assert.equal(res.body.user.role, 'PATIENT')
      // Le hachage du mot de passe ne doit jamais franchir la frontière HTTP.
      assert.equal(res.body.user.passwordHash, undefined)
    })

    test('le refresh token est stocké haché, jamais en clair', async () => {
      const { user } = await f.creerPatient()

      const res = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })

      const stocke = await prisma.refreshToken.findFirst({ where: { userId: user.id } })
      assert.ok(stocke)
      assert.notEqual(stocke.tokenHash, res.body.refreshToken)
      assert.equal(stocke.tokenHash, hacher(res.body.refreshToken))
    })

    test('un mot de passe erroné est refusé', async () => {
      const { user } = await f.creerPatient()

      const res = await api().post('/api/auth/login').send({ email: user.email, password: 'MauvaisMotDePasse1!' })
      assert.equal(res.status, 401)
    })

    test('un compte inexistant renvoie le même message qu\'un mot de passe erroné', async () => {
      const { user } = await f.creerPatient()

      const inconnu = await api().post('/api/auth/login').send({ email: 'personne@imsop.test', password: f.MOT_DE_PASSE })
      const mauvais = await api().post('/api/auth/login').send({ email: user.email, password: 'MauvaisMotDePasse1!' })

      // Deux réponses distinctes transformeraient le formulaire en oracle :
      // un bot saurait quelles adresses ont un compte sur une plateforme
      // médicale, ce qui est déjà une information de santé.
      assert.equal(inconnu.status, mauvais.status)
      assert.deepEqual(inconnu.body, mauvais.body)
    })

    test('se connecter sur le mauvais espace échoue', async () => {
      const { user } = await f.creerPatient()

      const res = await api()
        .post('/api/auth/login')
        .send({ email: user.email, password: f.MOT_DE_PASSE, role: 'ADMIN' })

      assert.equal(res.status, 401)
    })

    test('un compte désactivé ne peut plus se connecter', async () => {
      const { user } = await f.creerPatient({ actif: false })

      const res = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })
      assert.equal(res.status, 403)
    })
  })

  // CDC §9 — tous les rôles professionnels passent obligatoirement par la 2FA.
  describe('Double authentification', () => {
    const rolesProfessionnels = [
      ['spécialiste', f.creerSpecialiste],
      ['médecin traitant', f.creerMedecinLocal],
      ['coordinateur', f.creerCoordinateur],
      ['administrateur', f.creerAdmin],
    ]

    for (const [libelle, creer] of rolesProfessionnels) {
      test(`un ${libelle} n'obtient pas de session sans second facteur`, async () => {
        const compte = await creer()
        const user = compte.user ?? compte

        const res = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })

        assert.equal(res.status, 200)
        assert.equal(res.body.twoFactorRequired, true)
        assert.ok(res.body.challengeToken)
        assert.equal(res.body.accessToken, undefined)
      })
    }

    test('le bon code délivre la session', async () => {
      const { user } = await f.creerSpecialiste()
      const connexion = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })
      await fixerCode(user.id, '123456')

      const res = await api()
        .post('/api/auth/2fa/verify')
        .send({ challengeToken: connexion.body.challengeToken, code: '123456' })

      assert.equal(res.status, 200)
      assert.ok(res.body.accessToken)
      assert.equal(res.body.user.role, 'SPECIALISTE')
    })

    test('un code erroné est refusé', async () => {
      const { user } = await f.creerSpecialiste()
      const connexion = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })
      await fixerCode(user.id, '123456')

      const res = await api()
        .post('/api/auth/2fa/verify')
        .send({ challengeToken: connexion.body.challengeToken, code: '000000' })

      assert.equal(res.status, 401)
      assert.equal(res.body.accessToken, undefined)
    })

    test('le code ne sert qu\'une fois', async () => {
      const { user } = await f.creerSpecialiste()
      const connexion = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })
      await fixerCode(user.id, '123456')
      const corps = { challengeToken: connexion.body.challengeToken, code: '123456' }

      const premier = await api().post('/api/auth/2fa/verify').send(corps)
      const second = await api().post('/api/auth/2fa/verify').send(corps)

      assert.equal(premier.status, 200)
      assert.equal(second.status, 401)
    })

    // Le limiteur par IP est contourné par un attaquant réparti sur plusieurs
    // adresses : c'est le compteur porté par le challenge lui-même qui protège
    // réellement un code à 6 chiffres.
    test('le challenge est brûlé après 5 essais erronés', async () => {
      const { user } = await f.creerSpecialiste()
      const connexion = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })
      await fixerCode(user.id, '123456')
      const jeton = connexion.body.challengeToken

      for (let essai = 0; essai < 5; essai += 1) {
        const res = await api().post('/api/auth/2fa/verify').send({ challengeToken: jeton, code: '000000' })
        assert.equal(res.status, 401, `essai ${essai + 1}`)
      }

      const sixieme = await api().post('/api/auth/2fa/verify').send({ challengeToken: jeton, code: '000000' })
      assert.equal(sixieme.status, 429)

      // Et le bon code ne rattrape plus rien : il faut recommencer la connexion.
      const avecBonCode = await api().post('/api/auth/2fa/verify').send({ challengeToken: jeton, code: '123456' })
      assert.equal(avecBonCode.status, 401)
    })
  })

  describe('Inscription patient', () => {
    const inscription = (email) => ({
      fullName: 'Awa Ndiaye',
      email,
      password: 'MotDePasseTest123!',
      country: 'CM',
    })

    test('crée le compte et son profil patient', async () => {
      const res = await api().post('/api/auth/register/patient').send(inscription('nouvelle@imsop.test'))

      assert.equal(res.status, 202)
      const user = await prisma.user.findUnique({ where: { email: 'nouvelle@imsop.test' }, include: { patient: true } })
      assert.ok(user)
      assert.equal(user.role, 'PATIENT')
      assert.ok(user.patient, 'un profil Patient doit accompagner le compte')
      assert.ok(user.patient.patientRef.startsWith('IMS-'))
    })

    test('une adresse déjà utilisée donne exactement la même réponse', async () => {
      const premier = await api().post('/api/auth/register/patient').send(inscription('doublon@imsop.test'))
      const second = await api().post('/api/auth/register/patient').send(inscription('doublon@imsop.test'))

      assert.equal(premier.status, second.status)
      assert.deepEqual(premier.body, second.body)

      // Et surtout : aucun second compte n'a été créé.
      const comptes = await prisma.user.count({ where: { email: 'doublon@imsop.test' } })
      assert.equal(comptes, 1)
    })

    test('le mot de passe est haché, jamais stocké en clair', async () => {
      await api().post('/api/auth/register/patient').send(inscription('hachage@imsop.test'))

      const user = await prisma.user.findUnique({ where: { email: 'hachage@imsop.test' } })
      assert.notEqual(user.passwordHash, 'MotDePasseTest123!')
      assert.match(user.passwordHash, /^\$2[aby]\$/)
    })
  })

  describe('Renouvellement de session', () => {
    test('un refresh token valide délivre un nouvel access token', async () => {
      const { user } = await f.creerPatient()
      const connexion = await api().post('/api/auth/login').send({ email: user.email, password: f.MOT_DE_PASSE })

      const res = await api().post('/api/auth/refresh').send({ refreshToken: connexion.body.refreshToken })

      assert.equal(res.status, 200)
      assert.ok(res.body.accessToken)
    })

    test('un refresh token inventé est refusé', async () => {
      const res = await api().post('/api/auth/refresh').send({ refreshToken: 'jeton.inexistant.ici' })
      assert.equal(res.status, 401)
    })
  })
})
