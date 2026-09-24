require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerCoordinateur, creerAdmin, creerSpecialiste } = require('./helpers/factories')

async function semer() {
  await prisma.specialite.createMany({
    data: [
      { nom: 'Cardiologie', pourSpecialiste: true, pourMedecin: true },
      { nom: 'Anatomopathologie', pourSpecialiste: true, pourMedecin: false },
      { nom: 'Médecine générale', pourSpecialiste: false, pourMedecin: true },
      { nom: 'Spécialité retirée', pourSpecialiste: true, pourMedecin: true, actif: false },
    ],
  })
}

test.beforeEach(async () => {
  await viderBase()
  await semer()
})
test.after(fermerBase)

test('Spécialités — lecture par les formulaires', async (t) => {
  // Le formulaire de candidature est public : personne n'est connecté quand il
  // charge la liste.
  await t.test('la liste est lisible sans être connecté', async () => {
    const res = await api().get('/api/specialites').expect(200)
    assert.ok(res.body.length >= 3)
  })

  await t.test('une spécialité désactivée ne ressort pas', async () => {
    const res = await api().get('/api/specialites').expect(200)
    assert.equal(res.body.some((s) => s.nom === 'Spécialité retirée'), false)
  })

  await t.test('le formulaire spécialiste ne voit que ce qui le concerne', async () => {
    const res = await api().get('/api/specialites?cible=SPECIALISTE').expect(200)
    const noms = res.body.map((s) => s.nom)
    assert.ok(noms.includes('Anatomopathologie'))
    assert.equal(noms.includes('Médecine générale'), false)
  })

  await t.test('le formulaire médecin ne voit que ce qui le concerne', async () => {
    const res = await api().get('/api/specialites?cible=MEDECIN_LOCAL').expect(200)
    const noms = res.body.map((s) => s.nom)
    assert.ok(noms.includes('Médecine générale'))
    assert.equal(noms.includes('Anatomopathologie'), false)
  })

  await t.test('la liste est triée par nom', async () => {
    const res = await api().get('/api/specialites').expect(200)
    const noms = res.body.map((s) => s.nom)
    assert.deepEqual(noms, [...noms].sort((a, b) => a.localeCompare(b, 'fr')))
  })
})

test('Spécialités — administration par la coordination', async (t) => {
  await t.test('le coordinateur ajoute une spécialité', async () => {
    const coordinateur = await creerCoordinateur()

    const res = await api()
      .post('/api/specialites')
      .set('Authorization', entete(coordinateur))
      .send({ nom: 'Hématologie', pourSpecialiste: true, pourMedecin: true })
      .expect(201)

    assert.equal(res.body.nom, 'Hématologie')
    assert.equal(res.body.actif, true)

    // Elle apparaît aussitôt dans le formulaire public.
    const publique = await api().get('/api/specialites?cible=MEDECIN_LOCAL').expect(200)
    assert.ok(publique.body.some((s) => s.nom === 'Hématologie'))
  })

  await t.test('un doublon exact est refusé', async () => {
    const coordinateur = await creerCoordinateur()
    await api()
      .post('/api/specialites')
      .set('Authorization', entete(coordinateur))
      .send({ nom: 'Cardiologie' })
      .expect(409)
  })

  // Rajouter une spécialité désactivée est l'intention la plus probable ; la
  // refuser laisserait le coordinateur sans issue, le nom étant déjà pris.
  await t.test('rajouter une spécialité désactivée la réactive', async () => {
    const coordinateur = await creerCoordinateur()

    const res = await api()
      .post('/api/specialites')
      .set('Authorization', entete(coordinateur))
      .send({ nom: 'Spécialité retirée', pourSpecialiste: true, pourMedecin: true })
      .expect(200)

    assert.equal(res.body.actif, true)
  })

  await t.test("le coordinateur retire une spécialité sans la supprimer", async () => {
    const coordinateur = await creerCoordinateur()
    const cible = await prisma.specialite.findUnique({ where: { nom: 'Cardiologie' } })

    await api()
      .patch(`/api/specialites/${cible.id}`)
      .set('Authorization', entete(coordinateur))
      .send({ actif: false })
      .expect(200)

    // Retirée des listes, mais toujours en base : les praticiens qui la portent
    // gardent un libellé lisible.
    const publique = await api().get('/api/specialites').expect(200)
    assert.equal(publique.body.some((s) => s.nom === 'Cardiologie'), false)
    assert.ok(await prisma.specialite.findUnique({ where: { nom: 'Cardiologie' } }))
  })

  await t.test("le coordinateur change le formulaire où elle apparaît", async () => {
    const coordinateur = await creerCoordinateur()
    const cible = await prisma.specialite.findUnique({ where: { nom: 'Anatomopathologie' } })

    await api()
      .patch(`/api/specialites/${cible.id}`)
      .set('Authorization', entete(coordinateur))
      .send({ pourMedecin: true })
      .expect(200)

    const res = await api().get('/api/specialites?cible=MEDECIN_LOCAL').expect(200)
    assert.ok(res.body.map((s) => s.nom).includes('Anatomopathologie'))
  })

  await t.test("l'administration voit aussi les spécialités retirées", async () => {
    const admin = await creerAdmin()
    const res = await api()
      .get('/api/specialites?toutes=true')
      .set('Authorization', entete(admin))
      .expect(200)

    assert.ok(res.body.some((s) => s.nom === 'Spécialité retirée'))
  })

  await t.test("un spécialiste ne modifie pas la liste", async () => {
    const { user } = await creerSpecialiste()
    await api()
      .post('/api/specialites')
      .set('Authorization', entete(user))
      .send({ nom: 'Fausse spécialité' })
      .expect(403)
  })

  await t.test('sans être connecté, on ne modifie rien', async () => {
    await api().post('/api/specialites').send({ nom: 'Anonyme' }).expect(401)
  })
})
