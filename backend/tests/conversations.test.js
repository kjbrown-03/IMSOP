require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerCoordinateur, creerAdmin, creerSpecialiste, creerMedecinLocal, creerPatient } = require('./helpers/factories')

test.beforeEach(viderBase)
test.after(fermerBase)

/**
 * La messagerie était entièrement accrochée à un dossier : un praticien tout
 * juste recruté n'apparaissait nulle part et personne ne pouvait lui écrire.
 * La coordination est le pivot des discussions directes.
 */
test('Discussions directes — ouverture', async (t) => {
  await t.test('le coordinateur ouvre une discussion avec un spécialiste', async () => {
    const coordinateur = await creerCoordinateur()
    const { user: specialiste } = await creerSpecialiste()

    const res = await api()
      .post('/api/conversations')
      .set('Authorization', entete(coordinateur))
      .send({ destinataireId: specialiste.id })
      .expect(201)

    assert.equal(res.body.correspondant.id, specialiste.id)
    assert.equal(res.body.deja, false)
  })

  await t.test('le coordinateur ouvre une discussion avec un médecin traitant', async () => {
    const coordinateur = await creerCoordinateur()
    const { user: medecin } = await creerMedecinLocal()

    await api()
      .post('/api/conversations')
      .set('Authorization', entete(coordinateur))
      .send({ destinataireId: medecin.id })
      .expect(201)
  })

  // Le coordinateur qui cherche deux fois le même nom ne doit pas se retrouver
  // avec deux fils parallèles.
  await t.test('rouvrir la même discussion rend celle qui existe', async () => {
    const coordinateur = await creerCoordinateur()
    const { user: specialiste } = await creerSpecialiste()

    const premiere = await api()
      .post('/api/conversations')
      .set('Authorization', entete(coordinateur))
      .send({ destinataireId: specialiste.id })
      .expect(201)

    const seconde = await api()
      .post('/api/conversations')
      .set('Authorization', entete(coordinateur))
      .send({ destinataireId: specialiste.id })
      .expect(200)

    assert.equal(seconde.body.id, premiere.body.id)
    assert.equal(seconde.body.deja, true)
    assert.equal(await prisma.conversation.count(), 1)
  })

  await t.test("un spécialiste n'ouvre pas de discussion", async () => {
    const { user: specialiste } = await creerSpecialiste()
    const { user: autre } = await creerMedecinLocal()

    await api()
      .post('/api/conversations')
      .set('Authorization', entete(specialiste))
      .send({ destinataireId: autre.id })
      .expect(403)
  })

  await t.test("la coordination n'ouvre pas de discussion avec un patient", async () => {
    const coordinateur = await creerCoordinateur()
    const { user: patient } = await creerPatient()

    // Le patient n'a pas de ligne directe : tout passe par son dossier.
    await api()
      .post('/api/conversations')
      .set('Authorization', entete(coordinateur))
      .send({ destinataireId: patient.id })
      .expect(403)
  })

  await t.test('un compte suspendu ne reçoit pas de discussion', async () => {
    const coordinateur = await creerCoordinateur()
    const { user: specialiste } = await creerSpecialiste({ actif: false })

    await api()
      .post('/api/conversations')
      .set('Authorization', entete(coordinateur))
      .send({ destinataireId: specialiste.id })
      .expect(409)
  })

  await t.test('sans être connecté, on n’ouvre rien', async () => {
    const { user: specialiste } = await creerSpecialiste()
    await api().post('/api/conversations').send({ destinataireId: specialiste.id }).expect(401)
  })
})

test('Discussions directes — échange', async (t) => {
  async function discussion() {
    const coordinateur = await creerCoordinateur()
    const { user: specialiste } = await creerSpecialiste()
    const res = await api()
      .post('/api/conversations')
      .set('Authorization', entete(coordinateur))
      .send({ destinataireId: specialiste.id })
      .expect(201)
    return { coordinateur, specialiste, id: res.body.id }
  }

  await t.test('le coordinateur écrit, le praticien lit et répond', async () => {
    const { coordinateur, specialiste, id } = await discussion()

    await api()
      .post(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(coordinateur))
      .send({ body: 'Bienvenue sur la plateforme.' })
      .expect(201)

    const lu = await api()
      .get(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(specialiste))
      .expect(200)

    assert.equal(lu.body.messages.length, 1)
    assert.equal(lu.body.messages[0].body, 'Bienvenue sur la plateforme.')
    assert.equal(lu.body.correspondant.id, coordinateur.id)

    await api()
      .post(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(specialiste))
      .send({ body: 'Merci, je suis disponible dès lundi.' })
      .expect(201)

    const cote = await api()
      .get(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(coordinateur))
      .expect(200)
    assert.equal(cote.body.messages.length, 2)
  })

  // Confirmer l'existence d'une discussion entre deux tiers est déjà une fuite.
  await t.test('un tiers ne voit pas la discussion des autres', async () => {
    const { id } = await discussion()
    const { user: intrus } = await creerSpecialiste()

    await api()
      .get(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(intrus))
      .expect(404)

    await api()
      .post(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(intrus))
      .send({ body: 'Je passais par là' })
      .expect(404)
  })

  await t.test('un message vide est refusé', async () => {
    const { coordinateur, id } = await discussion()
    await api()
      .post(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(coordinateur))
      .send({ body: '   ' })
      .expect(400)
  })

  await t.test('ouvrir la discussion marque les messages reçus comme lus', async () => {
    const { coordinateur, specialiste, id } = await discussion()
    await api()
      .post(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(coordinateur))
      .send({ body: 'Un message à lire' })
      .expect(201)

    await api().get(`/api/conversations/${id}/messages`).set('Authorization', entete(specialiste)).expect(200)

    const msg = await prisma.message.findFirst({ where: { conversationId: id } })
    assert.ok(msg.readAt, 'le message est marqué lu')
  })

  await t.test('la liste montre le dernier message et le correspondant', async () => {
    const { coordinateur, specialiste, id } = await discussion()
    await api()
      .post(`/api/conversations/${id}/messages`)
      .set('Authorization', entete(coordinateur))
      .send({ body: 'Dernier en date' })
      .expect(201)

    const res = await api().get('/api/conversations').set('Authorization', entete(specialiste)).expect(200)
    assert.equal(res.body.conversations.length, 1)
    assert.equal(res.body.conversations[0].correspondant.id, coordinateur.id)
    assert.equal(res.body.conversations[0].dernierMessage.body, 'Dernier en date')
  })

  await t.test("on ne voit que ses propres discussions", async () => {
    await discussion()
    const autre = await creerCoordinateur()
    const res = await api().get('/api/conversations').set('Authorization', entete(autre)).expect(200)
    assert.equal(res.body.conversations.length, 0)
  })
})

test('Discussions directes — recherche des destinataires', async (t) => {
  await t.test('la coordination trouve un praticien par son nom', async () => {
    const coordinateur = await creerCoordinateur()
    await creerSpecialiste({ fullName: 'Dr. Amina Traoré' })
    await creerMedecinLocal({ fullName: 'Dr. Paul Mbarga' })

    const res = await api()
      .get('/api/conversations/destinataires?q=amina')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.utilisateurs.length, 1)
    assert.equal(res.body.utilisateurs[0].fullName, 'Dr. Amina Traoré')
  })

  // C'est tout l'objet de la fonctionnalité : joindre quelqu'un à qui aucun
  // dossier n'est encore affecté.
  await t.test('un praticien sans aucun dossier ressort quand même', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerSpecialiste({ fullName: 'Dr. Nouveau Venu' })

    const res = await api()
      .get('/api/conversations/destinataires')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.ok(res.body.utilisateurs.some((u) => u.id === user.id))
    assert.equal(await prisma.dossier.count(), 0)
  })

  await t.test('ni patients ni coordinateurs dans les résultats', async () => {
    const coordinateur = await creerCoordinateur()
    await creerPatient({ fullName: 'Patient Untel' })
    await creerAdmin({ fullName: 'Admin Untel' })

    const res = await api()
      .get('/api/conversations/destinataires')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.utilisateurs.length, 0)
  })

  await t.test('un compte suspendu ne ressort pas', async () => {
    const coordinateur = await creerCoordinateur()
    await creerSpecialiste({ fullName: 'Dr. Suspendu', actif: false })

    const res = await api()
      .get('/api/conversations/destinataires')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.utilisateurs.length, 0)
  })

  await t.test('un praticien ne cherche pas de destinataires', async () => {
    const { user } = await creerSpecialiste()
    await api()
      .get('/api/conversations/destinataires')
      .set('Authorization', entete(user))
      .expect(403)
  })
})
