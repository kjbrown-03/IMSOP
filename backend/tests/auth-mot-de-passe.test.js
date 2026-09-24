require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerSpecialiste } = require('./helpers/factories')

test.beforeEach(viderBase)
test.after(fermerBase)

// Le mot de passe initial d'un praticien recruté est généré par la plateforme
// et circule en clair dans un courriel. Tant qu'il ne peut pas le remplacer, ce
// courriel reste une clé de son compte.
test('Changement de mot de passe', async (t) => {
  async function compte(motDePasse = 'MotDePasse123') {
    const { user } = await creerSpecialiste({ motDePasse })
    return user
  }

  await t.test('le titulaire remplace son mot de passe', async () => {
    const user = await compte()

    await api()
      .post('/api/auth/mot-de-passe')
      .set('Authorization', entete(user))
      .send({ motDePasseActuel: 'MotDePasse123', nouveauMotDePasse: 'NouveauSecret2026' })
      .expect(200)

    const apres = await prisma.user.findUnique({ where: { id: user.id } })
    assert.ok(await bcrypt.compare('NouveauSecret2026', apres.passwordHash))
  })

  await t.test("un mot de passe actuel faux ne change rien", async () => {
    const user = await compte()

    await api()
      .post('/api/auth/mot-de-passe')
      .set('Authorization', entete(user))
      .send({ motDePasseActuel: 'PasLeBon999', nouveauMotDePasse: 'NouveauSecret2026' })
      .expect(400)

    const apres = await prisma.user.findUnique({ where: { id: user.id } })
    assert.ok(await bcrypt.compare('MotDePasse123', apres.passwordHash), "l'ancien reste valable")
  })

  await t.test('sans être connecté, on ne change rien', async () => {
    await api()
      .post('/api/auth/mot-de-passe')
      .send({ motDePasseActuel: 'MotDePasse123', nouveauMotDePasse: 'NouveauSecret2026' })
      .expect(401)
  })

  await t.test('un mot de passe trop court est refusé', async () => {
    const user = await compte()
    const res = await api()
      .post('/api/auth/mot-de-passe')
      .set('Authorization', entete(user))
      .send({ motDePasseActuel: 'MotDePasse123', nouveauMotDePasse: 'court7c' })
      .expect(400)

    assert.ok(res.body.errors.some((e) => e.field === 'nouveauMotDePasse'))
  })

  await t.test("reprendre le même mot de passe est refusé", async () => {
    const user = await compte()
    await api()
      .post('/api/auth/mot-de-passe')
      .set('Authorization', entete(user))
      .send({ motDePasseActuel: 'MotDePasse123', nouveauMotDePasse: 'MotDePasse123' })
      .expect(400)
  })

  // Changer son mot de passe sert justement quand on le soupçonne connu d'un
  // tiers : les sessions ouvertes avec l'ancien doivent tomber.
  await t.test('les sessions ouvertes sont révoquées', async () => {
    const user = await compte()
    await prisma.refreshToken.create({
      data: { tokenHash: `session-${user.id}`, userId: user.id, expiresAt: new Date(Date.now() + 864e5) },
    })

    await api()
      .post('/api/auth/mot-de-passe')
      .set('Authorization', entete(user))
      .send({ motDePasseActuel: 'MotDePasse123', nouveauMotDePasse: 'NouveauSecret2026' })
      .expect(200)

    assert.equal(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }), 0)
  })

  await t.test('le changement est tracé au journal', async () => {
    const user = await compte()
    await api()
      .post('/api/auth/mot-de-passe')
      .set('Authorization', entete(user))
      .send({ motDePasseActuel: 'MotDePasse123', nouveauMotDePasse: 'NouveauSecret2026' })
      .expect(200)

    const trace = await prisma.auditLog.findFirst({ where: { action: 'MOT_DE_PASSE_CHANGE', entityId: user.id } })
    assert.ok(trace)
  })
})
