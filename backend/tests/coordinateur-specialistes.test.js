require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerSpecialiste, creerMedecinLocal, creerCoordinateur, creerAdmin } = require('./helpers/factories')

let compteur = 0
const emailUnique = () => `nouvel-expert-${process.pid}-${++compteur}@imsop.test`

test.beforeEach(viderBase)
test.after(fermerBase)

// Animer le réseau d'experts est le métier du coordinateur : il doit pouvoir
// enrôler, corriger et désactiver un spécialiste sans passer par un
// administrateur. Ces routes lui étaient fermées par un requireRole('ADMIN').
test('Coordinateur — gestion des spécialistes', async (t) => {
  await t.test('il liste les spécialistes', async () => {
    const coordinateur = await creerCoordinateur()
    await creerSpecialiste()

    const res = await api()
      .get('/api/admin/users?role=SPECIALISTE')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.length, 1)
  })

  await t.test('il crée un spécialiste avec sa fiche', async () => {
    const coordinateur = await creerCoordinateur()
    const email = emailUnique()

    const res = await api()
      .post('/api/admin/users')
      .set('Authorization', entete(coordinateur))
      .send({
        role: 'SPECIALISTE',
        fullName: 'Dr. Awa Ndiaye',
        email,
        specialite: 'Oncologie',
        pays: 'France',
        etablissement: 'Institut Curie',
      })
      .expect(201)

    assert.equal(res.body.user.email, email)
    assert.equal(res.body.user.specialiste.specialite, 'Oncologie')
    // Le mot de passe provisoire n'est rendu qu'une fois, à la création.
    assert.ok(res.body.temporaryPassword)
  })

  // CDC §16 : créer un compte ne vaut pas habilitation. Sans ce garde-fou, le
  // coordinateur contournerait le contrôle des justificatifs en créant
  // directement un expert déjà validé.
  await t.test("un spécialiste créé n'est pas habilité d'office", async () => {
    const coordinateur = await creerCoordinateur()

    const res = await api()
      .post('/api/admin/users')
      .set('Authorization', entete(coordinateur))
      .send({ role: 'SPECIALISTE', fullName: 'Dr. Karim Benali', email: emailUnique(), specialite: 'Néphrologie' })
      .expect(201)

    assert.equal(res.body.user.specialiste.verificationStatus, 'EN_VERIFICATION')
  })

  await t.test('il corrige la fiche d\'un spécialiste', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerSpecialiste()

    const res = await api()
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', entete(coordinateur))
      .send({ specialite: 'Neurologie', etablissement: 'CHU de Lyon' })
      .expect(200)

    assert.equal(res.body.specialiste.specialite, 'Neurologie')
    assert.equal(res.body.specialiste.etablissement, 'CHU de Lyon')
  })

  await t.test('il désactive un spécialiste et ses sessions tombent', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerSpecialiste()
    await prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: 'jeton-de-test', expiresAt: new Date(Date.now() + 86400000) },
    })

    await api()
      .patch(`/api/admin/users/${user.id}/active`)
      .set('Authorization', entete(coordinateur))
      .send({ active: false })
      .expect(200)

    const apres = await prisma.user.findUnique({ where: { id: user.id } })
    assert.equal(apres.active, false)
    // Un compte désactivé qui garde un refresh token valide resterait joignable
    // jusqu'à l'expiration de celui-ci.
    assert.equal(await prisma.refreshToken.count({ where: { userId: user.id } }), 0)
  })

  await t.test('il peut réactiver un compte', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerSpecialiste({ actif: false })

    await api()
      .patch(`/api/admin/users/${user.id}/active`)
      .set('Authorization', entete(coordinateur))
      .send({ active: true })
      .expect(200)

    const apres = await prisma.user.findUnique({ where: { id: user.id } })
    assert.equal(apres.active, true)
  })
})

// Le coordinateur gère le réseau d'experts, pas les comptes de coordination :
// lui ouvrir ces routes ne doit pas lui ouvrir la gestion de ses pairs.
// Le médecin traitant de proximité fait partie du même réseau. Il n'était géré
// nulle part : recruté depuis une candidature, il ne pouvait plus être ni
// corrigé ni suspendu ensuite.
test('Coordinateur — gestion des médecins traitants', async (t) => {
  await t.test('il liste les médecins traitants', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerMedecinLocal({ fullName: 'Dr. Paul Mbarga' })

    const res = await api()
      .get('/api/admin/users?role=MEDECIN_LOCAL')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].id, user.id)
    assert.ok(res.body[0].medecinLocal, 'sa fiche doit accompagner le compte')
  })

  await t.test('il crée un médecin traitant avec sa ville et son numéro d’ordre', async () => {
    const coordinateur = await creerCoordinateur()
    const email = emailUnique()

    const res = await api()
      .post('/api/admin/users')
      .set('Authorization', entete(coordinateur))
      .send({
        role: 'MEDECIN_LOCAL',
        fullName: 'Dr. Paul Mbarga',
        email,
        specialite: 'Médecine générale',
        pays: 'cm',
        ville: 'Douala',
        numeroOrdre: 'CM-4821',
      })
      .expect(201)

    assert.equal(res.body.user.medecinLocal.ville, 'Douala')
    assert.equal(res.body.user.medecinLocal.numeroOrdre, 'CM-4821')
    assert.ok(res.body.temporaryPassword)
  })

  // Même règle que pour le spécialiste : c'est le contrôle du numéro d'ordre
  // qui habilite, pas la création du compte.
  await t.test("un médecin créé n'est pas habilité d'office", async () => {
    const coordinateur = await creerCoordinateur()

    const res = await api()
      .post('/api/admin/users')
      .set('Authorization', entete(coordinateur))
      .send({ role: 'MEDECIN_LOCAL', fullName: 'Dr. Non Habilité', email: emailUnique() })
      .expect(201)

    assert.notEqual(res.body.user.medecinLocal.verificationStatus, 'VALIDE')
  })

  await t.test('il corrige la fiche d’un médecin traitant', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerMedecinLocal()

    const res = await api()
      .patch(`/api/admin/users/${user.id}`)
      .set('Authorization', entete(coordinateur))
      .send({ ville: 'Yaoundé', numeroOrdre: 'CM-9999' })
      .expect(200)

    assert.equal(res.body.medecinLocal.ville, 'Yaoundé')
    assert.equal(res.body.medecinLocal.numeroOrdre, 'CM-9999')
  })

  await t.test('il suspend un médecin traitant', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerMedecinLocal()

    await api()
      .patch(`/api/admin/users/${user.id}/active`)
      .set('Authorization', entete(coordinateur))
      .send({ active: false })
      .expect(200)

    const apres = await prisma.user.findUnique({ where: { id: user.id } })
    assert.equal(apres.active, false)
  })

  await t.test("un médecin traitant ne gère pas les comptes", async () => {
    const { user } = await creerMedecinLocal()
    await api()
      .get('/api/admin/users?role=MEDECIN_LOCAL')
      .set('Authorization', entete(user))
      .expect(403)
  })
})

test('Coordinateur — limites de ses droits', async (t) => {
  await t.test('il ne liste pas les coordinateurs', async () => {
    const coordinateur = await creerCoordinateur()

    await api()
      .get('/api/admin/users?role=COORDINATEUR')
      .set('Authorization', entete(coordinateur))
      .expect(403)
  })

  await t.test('il ne crée pas de coordinateur', async () => {
    const coordinateur = await creerCoordinateur()

    await api()
      .post('/api/admin/users')
      .set('Authorization', entete(coordinateur))
      .send({ role: 'COORDINATEUR', fullName: 'Faux Collègue', email: emailUnique() })
      .expect(403)

    assert.equal(await prisma.user.count({ where: { role: 'COORDINATEUR' } }), 1)
  })

  await t.test('il ne modifie pas un autre coordinateur', async () => {
    const coordinateur = await creerCoordinateur()
    const collegue = await creerCoordinateur()

    await api()
      .patch(`/api/admin/users/${collegue.id}`)
      .set('Authorization', entete(coordinateur))
      .send({ fullName: 'Nom Modifié' })
      .expect(403)
  })

  await t.test('il ne désactive pas un autre coordinateur', async () => {
    const coordinateur = await creerCoordinateur()
    const collegue = await creerCoordinateur()

    await api()
      .patch(`/api/admin/users/${collegue.id}/active`)
      .set('Authorization', entete(coordinateur))
      .send({ active: false })
      .expect(403)

    const apres = await prisma.user.findUnique({ where: { id: collegue.id } })
    assert.equal(apres.active, true)
  })

  await t.test("un spécialiste n'accède à aucune de ces routes", async () => {
    const { user } = await creerSpecialiste()

    await api()
      .get('/api/admin/users?role=SPECIALISTE')
      .set('Authorization', entete(user))
      .expect(403)
  })

  await t.test("l'administrateur garde la gestion des coordinateurs", async () => {
    const admin = await creerAdmin()
    const collegue = await creerCoordinateur()

    await api()
      .patch(`/api/admin/users/${collegue.id}`)
      .set('Authorization', entete(admin))
      .send({ fullName: 'Nom Corrigé' })
      .expect(200)
  })
})

// Un jeton d'accès vit 15 minutes. Sans vérification à chaque requête, un
// compte désactivé gardait l'accès jusqu'à son expiration. Pour des dossiers
// médicaux, la coupure doit être immédiate.
test('Désactivation — effet immédiat, jeton encore valide', async (t) => {
  await t.test("un jeton valide est refusé dès que le compte est désactivé", async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerSpecialiste()
    const jeton = entete(user) // signé maintenant, valable 15 minutes

    // Avant : le spécialiste accède normalement.
    await api().get('/api/dossiers').set('Authorization', jeton).expect(200)

    await api()
      .patch(`/api/admin/users/${user.id}/active`)
      .set('Authorization', entete(coordinateur))
      .send({ active: false })
      .expect(200)

    // Après, même jeton : refusé sur-le-champ.
    const res = await api().get('/api/dossiers').set('Authorization', jeton).expect(403)
    assert.match(res.body.message, /désactivé/)
  })

  await t.test('la réactivation rend l\'accès avec le même jeton', async () => {
    const coordinateur = await creerCoordinateur()
    const { user } = await creerSpecialiste({ actif: false })
    const jeton = entete(user)

    await api().get('/api/dossiers').set('Authorization', jeton).expect(403)

    await api()
      .patch(`/api/admin/users/${user.id}/active`)
      .set('Authorization', entete(coordinateur))
      .send({ active: true })
      .expect(200)

    await api().get('/api/dossiers').set('Authorization', jeton).expect(200)
  })

  await t.test("un jeton d'un compte supprimé est refusé", async () => {
    const { user } = await creerSpecialiste()
    const jeton = entete(user)
    await prisma.user.delete({ where: { id: user.id } })

    await api().get('/api/dossiers').set('Authorization', jeton).expect(401)
  })
})
