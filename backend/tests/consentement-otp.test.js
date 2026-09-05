require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerPatient, creerSpecialiste, creerMedecinLocal, creerDossier } = require('./helpers/factories')

const hacher = (valeur) => crypto.createHash('sha256').update(valeur).digest('hex')

// Même approche que auth.test.js : le code part par e-mail, que la suite
// n'envoie pas. On réécrit donc le haché du dernier challenge émis avec une
// valeur connue, ce qui laisse le reste du parcours intact.
async function fixerCode(userId, code) {
  const challenge = await prisma.twoFactorChallenge.findFirst({
    where: { userId, purpose: 'CONSENTEMENT_SIGNATURE', consumedAt: null },
    orderBy: { createdAt: 'desc' },
  })
  assert.ok(challenge, 'aucun code de consentement en attente pour ce compte')
  await prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { codeHash: hacher(code) } })
  return challenge
}

// Parcours complet : demander le code, le saisir, recuperer le jeton.
async function obtenirJeton(user, code = '123456') {
  await api().post('/api/auth/consentement/code').set('Authorization', entete(user)).expect(200)
  await fixerCode(user.id, code)
  const res = await api()
    .post('/api/auth/consentement/code/verify')
    .set('Authorization', entete(user))
    .send({ code })
    .expect(200)
  return res.body.consentToken
}

test.beforeEach(viderBase)
test.after(fermerBase)

test('Consentement — confirmation par code e-mail', async (t) => {
  await t.test("un patient reçoit un code et obtient un jeton avec le bon code", async () => {
    const { user } = await creerPatient()

    const envoi = await api().post('/api/auth/consentement/code').set('Authorization', entete(user)).expect(200)
    // L'adresse revient masquée : l'écran doit pouvoir dire où le code est
    // parti sans étaler l'adresse complète.
    assert.match(envoi.body.email, /^.{2}\*+@/)

    await fixerCode(user.id, '123456')

    const verif = await api()
      .post('/api/auth/consentement/code/verify')
      .set('Authorization', entete(user))
      .send({ code: '123456' })
      .expect(200)

    assert.ok(verif.body.consentToken)
  })

  await t.test('un mauvais code est refusé', async () => {
    const { user } = await creerPatient()
    await api().post('/api/auth/consentement/code').set('Authorization', entete(user)).expect(200)
    await fixerCode(user.id, '123456')

    await api()
      .post('/api/auth/consentement/code/verify')
      .set('Authorization', entete(user))
      .send({ code: '000000' })
      .expect(401)
  })

  await t.test('un code déjà consommé ne sert pas deux fois', async () => {
    const { user } = await creerPatient()
    await obtenirJeton(user)

    await api()
      .post('/api/auth/consentement/code/verify')
      .set('Authorization', entete(user))
      .send({ code: '123456' })
      .expect(401)
  })

  await t.test("demander un nouveau code invalide le précédent", async () => {
    const { user } = await creerPatient()
    await api().post('/api/auth/consentement/code').set('Authorization', entete(user)).expect(200)
    await fixerCode(user.id, '111111')

    await api().post('/api/auth/consentement/code').set('Authorization', entete(user)).expect(200)

    await api()
      .post('/api/auth/consentement/code/verify')
      .set('Authorization', entete(user))
      .send({ code: '111111' })
      .expect(401)
  })

  await t.test("un rôle qui ne demande pas de second avis n'obtient pas de code", async () => {
    const { user } = await creerSpecialiste()
    await api().post('/api/auth/consentement/code').set('Authorization', entete(user)).expect(403)
  })
})

test('Consentement — le serveur exige la confirmation', async (t) => {
  await t.test('la signature est refusée sans jeton', async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })

    const res = await api()
      .post(`/api/dossiers/${dossier.id}/consentements`)
      .set('Authorization', entete(user))
      .send({ type: 'TRANSMISSION_SPECIALISTE', accepted: true, nomSignataire: 'Jean Dupont' })
      .expect(403)

    assert.match(res.body.message, /Confirmation par e-mail/)
    assert.equal(await prisma.consentement.count(), 0)
  })

  // Ce qui est vérifié ici est la barrière, pas l'aboutissement de la requête :
  // un consentement TRANSMISSION_SPECIALISTE accepté déclenche la génération du
  // PDF signé et son dépôt sur S3/MinIO. Le stockage n'étant pas forcément
  // joignable depuis l'environnement de test, on s'assure que la demande passe
  // la barrière (pas de 403) et que le consentement est bien enregistré.
  await t.test('la signature passe avec un jeton valide', async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    const otpToken = await obtenirJeton(user)

    const res = await api()
      .post(`/api/dossiers/${dossier.id}/consentements`)
      .set('Authorization', entete(user))
      .send({ type: 'TRANSMISSION_SPECIALISTE', accepted: true, nomSignataire: 'Jean Dupont', otpToken })

    assert.notEqual(res.status, 403)
    assert.equal(await prisma.consentement.count(), 1)
  })

  await t.test("le jeton d'un autre compte ne vaut rien", async () => {
    const { user, patient } = await creerPatient()
    const autre = await creerPatient()
    const dossier = await creerDossier({ patient })
    const jetonDeLAutre = await obtenirJeton(autre.user)

    await api()
      .post(`/api/dossiers/${dossier.id}/consentements`)
      .set('Authorization', entete(user))
      .send({
        type: 'TRANSMISSION_SPECIALISTE',
        accepted: true,
        nomSignataire: 'Jean Dupont',
        otpToken: jetonDeLAutre,
      })
      .expect(403)
  })

  await t.test('un médecin traitant signe sa propre demande avec un jeton', async () => {
    const { user, medecinLocal } = await creerMedecinLocal()
    const dossier = await creerDossier({ demandeurMedecin: medecinLocal, patientAge: 54, patientSexe: 'femme' })
    const otpToken = await obtenirJeton(user)

    const res = await api()
      .post(`/api/dossiers/${dossier.id}/consentements`)
      .set('Authorization', entete(user))
      .send({ type: 'TRANSMISSION_SPECIALISTE', accepted: true, nomSignataire: 'Dr. Awa Ngo', otpToken })

    assert.notEqual(res.status, 403)
    assert.equal(await prisma.consentement.count(), 1)
  })

  // Les autres types de consentement restent de simples cases à cocher : les
  // soumettre au code alourdirait le parcours sans rien protéger de plus.
  await t.test("les autres consentements ne demandent pas de code", async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })

    await api()
      .post(`/api/dossiers/${dossier.id}/consentements`)
      .set('Authorization', entete(user))
      .send({ type: 'TRAITEMENT_DONNEES', accepted: true })
      .expect(201)
  })
})
