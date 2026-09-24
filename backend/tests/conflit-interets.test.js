require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const {
  creerPatient,
  creerSpecialiste,
  creerCoordinateur,
  creerDossier,
} = require('./helpers/factories')

const MOTIF = "J'ai opéré ce patient il y a deux ans, je ne peux pas rendre un avis indépendant."

// Un dossier affecté à un spécialiste, prêt à être récusé.
async function dossierAffecte() {
  const { patient } = await creerPatient()
  const { user, specialiste } = await creerSpecialiste()
  const dossier = await creerDossier({ patient, specialiste, status: 'ACCEPTE_PAR_SPECIALISTE' })
  return { user, specialiste, dossier }
}

test.beforeEach(viderBase)
test.after(fermerBase)

// CDC §18 : déclarer un conflit d'intérêts renvoie le dossier en affectation.
// Ce qui distingue cette action d'un refus ordinaire, c'est qu'elle laisse une
// trace : le même expert ne doit plus jamais être proposé sur CE dossier.
test("Conflit d'intérêts — déclaration", async (t) => {
  await t.test('le spécialiste assigné se récuse et le dossier repart en affectation', async () => {
    const { user, specialiste, dossier } = await dossierAffecte()

    const res = await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: MOTIF })
      .expect(200)

    assert.equal(res.body.status, 'EN_ATTENTE_AFFECTATION')
    assert.equal(res.body.specialisteId, null)

    const recusation = await prisma.recusationSpecialiste.findFirst({ where: { dossierId: dossier.id } })
    assert.ok(recusation)
    assert.equal(recusation.specialisteId, specialiste.id)
    assert.equal(recusation.motif, MOTIF)
  })

  await t.test("la déclaration est tracée dans le journal d'audit", async () => {
    const { user, dossier } = await dossierAffecte()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: MOTIF })
      .expect(200)

    const trace = await prisma.auditLog.findFirst({
      where: { dossierId: dossier.id, action: 'DOSSIER_CONFLIT_INTERETS' },
    })
    assert.ok(trace)
  })

  await t.test('un spécialiste non assigné ne peut pas se récuser', async () => {
    const { dossier } = await dossierAffecte()
    const { user: autreSpecialiste } = await creerSpecialiste()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(autreSpecialiste))
      .send({ motif: MOTIF })
      .expect(403)

    assert.equal(await prisma.recusationSpecialiste.count(), 0)
  })

  await t.test('un coordinateur ne peut pas se récuser à la place du spécialiste', async () => {
    const { dossier } = await dossierAffecte()
    const coordinateur = await creerCoordinateur()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(coordinateur))
      .send({ motif: MOTIF })
      .expect(403)
  })

  // Un motif vide rendrait la récusation inexploitable par la coordination.
  await t.test('un motif trop court est refusé', async () => {
    const { user, dossier } = await dossierAffecte()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: 'non' })
      .expect(400)

    assert.equal(await prisma.recusationSpecialiste.count(), 0)
  })

  await t.test('redéclarer ne crée pas de doublon', async () => {
    const { user, specialiste, dossier } = await dossierAffecte()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: MOTIF })
      .expect(200)

    // Le dossier n'est plus assigné : on le réaffecte pour pouvoir redéclarer.
    await prisma.dossier.update({ where: { id: dossier.id }, data: { specialisteId: specialiste.id } })

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: 'Motif mis à jour après vérification du dossier.' })
      .expect(200)

    const recusations = await prisma.recusationSpecialiste.findMany({ where: { dossierId: dossier.id } })
    assert.equal(recusations.length, 1)
    assert.match(recusations[0].motif, /mis à jour/)
  })
})

test("Conflit d'intérêts — conséquences sur l'affectation", async (t) => {
  await t.test("le coordinateur ne peut plus réassigner l'expert récusé", async () => {
    const { user, specialiste, dossier } = await dossierAffecte()
    const coordinateur = await creerCoordinateur()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: MOTIF })
      .expect(200)

    // Sans ce garde-fou, la récusation ne protégerait que les propositions
    // automatiques et se contournerait à la main.
    const res = await api()
      .post(`/api/dossiers/${dossier.id}/assigner`)
      .set('Authorization', entete(coordinateur))
      .send({ specialisteId: specialiste.id })
      .expect(409)

    assert.match(res.body.message, /récusé/)
  })

  await t.test('un autre expert reste affectable', async () => {
    const { user, dossier } = await dossierAffecte()
    const { specialiste: remplacant } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: MOTIF })
      .expect(200)

    const res = await api()
      .post(`/api/dossiers/${dossier.id}/assigner`)
      .set('Authorization', entete(coordinateur))
      .send({ specialisteId: remplacant.id })
      .expect(200)

    assert.equal(res.body.specialisteId, remplacant.id)
  })

  await t.test("l'expert récusé disparaît des recommandations", async () => {
    const { user, specialiste, dossier } = await dossierAffecte()
    const { specialiste: remplacant } = await creerSpecialiste()
    const coordinateur = await creerCoordinateur()

    const avant = await api()
      .get(`/api/specialistes/recommandations/${dossier.id}`)
      .set('Authorization', entete(coordinateur))
      .expect(200)
    assert.ok(avant.body.some((s) => s.id === specialiste.id), 'il devrait être proposé avant sa récusation')

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: MOTIF })
      .expect(200)

    const apres = await api()
      .get(`/api/specialistes/recommandations/${dossier.id}`)
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(apres.body.some((s) => s.id === specialiste.id), false)
    // Le remplaçant, lui, doit toujours ressortir : on écarte un expert, pas la
    // spécialité.
    assert.ok(apres.body.some((s) => s.id === remplacant.id))
  })

  // La récusation vaut pour un dossier, pas pour l'expert en général.
  await t.test("l'expert reste proposé sur les autres dossiers", async () => {
    const { user, specialiste, dossier } = await dossierAffecte()
    const { patient: autrePatient } = await creerPatient()
    const autreDossier = await creerDossier({ patient: autrePatient })
    const coordinateur = await creerCoordinateur()

    await api()
      .post(`/api/dossiers/${dossier.id}/conflit-interets`)
      .set('Authorization', entete(user))
      .send({ motif: MOTIF })
      .expect(200)

    const res = await api()
      .get(`/api/specialistes/recommandations/${autreDossier.id}`)
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.ok(res.body.some((s) => s.id === specialiste.id))
  })
})
