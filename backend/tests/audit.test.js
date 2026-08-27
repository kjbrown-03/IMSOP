require('./helpers/env')
const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')

// CDC §4.3 et §33 — la piste d'audit.
//
// Un journal d'audit ne se remarque pas quand il cesse de fonctionner : les
// écrans continuent de marcher, et l'absence de traces ne se découvre qu'au
// moment où on en aurait eu besoin. D'où ces tests, qui vérifient qu'un accès
// à des données de santé laisse bien une ligne, avec de quoi l'exploiter
// (qui, quoi, quel dossier).
describe('Journal d\'audit', () => {
  let patient, dossier

  beforeEach(async () => {
    await viderBase()
    patient = await f.creerPatient()
    dossier = await f.creerDossier({ patient: patient.patient })
  })

  after(async () => {
    await viderBase()
    await fermerBase()
  })

  test('la consultation d\'un dossier est tracée', async () => {
    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(patient.user))

    const traces = await prisma.auditLog.findMany({ where: { action: 'DOSSIER_VIEW' } })
    assert.equal(traces.length, 1)
    assert.equal(traces[0].userId, patient.user.id)
    assert.equal(traces[0].dossierId, dossier.id)
    assert.equal(traces[0].entityType, 'Dossier')
  })

  test('chaque consultation ajoute sa propre ligne', async () => {
    const jeton = entete(patient.user)
    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', jeton)
    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', jeton)

    const traces = await prisma.auditLog.count({ where: { action: 'DOSSIER_VIEW' } })
    assert.equal(traces, 2, 'un journal qui dédoublonne perdrait la chronologie des accès')
  })

  test('la consultation par un coordinateur est tracée à son nom', async () => {
    const coordinateur = await f.creerCoordinateur()

    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(coordinateur))

    const trace = await prisma.auditLog.findFirst({ where: { action: 'DOSSIER_VIEW' } })
    assert.equal(trace.userId, coordinateur.id)
  })

  test('la modification d\'un dossier est tracée', async () => {
    await api()
      .patch(`/api/dossiers/${dossier.id}`)
      .set('Authorization', entete(patient.user))
      .send({ motif: 'Motif corrigé après relecture' })

    const trace = await prisma.auditLog.findFirst({ where: { action: 'DOSSIER_UPDATE' } })
    assert.ok(trace, 'une modification doit laisser une trace')
    assert.equal(trace.dossierId, dossier.id)
  })

  test('l\'affectation d\'un spécialiste est tracée', async () => {
    const coordinateur = await f.creerCoordinateur()
    const { specialiste } = await f.creerSpecialiste()

    await api()
      .post(`/api/dossiers/${dossier.id}/assigner`)
      .set('Authorization', entete(coordinateur))
      .send({ specialisteId: specialiste.id })

    const traces = await prisma.auditLog.findMany({ where: { dossierId: dossier.id } })
    assert.ok(traces.length > 0, "l'affectation d'un dossier doit être auditée")
  })

  // Documente le comportement actuel : la trace est écrite APRÈS le contrôle
  // d'accès, donc une tentative refusée ne laisse rien. C'est défendable (le
  // journal reste un registre d'accès réels), mais ça prive d'un signal utile :
  // un compte qui butte en boucle sur des dossiers qui ne sont pas les siens
  // est exactement ce qu'on voudrait voir. À arbitrer — voir le rapport.
  test('un accès refusé ne laisse aujourd\'hui aucune trace', async () => {
    const intrus = await f.creerPatient()

    const res = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(intrus.user))
    assert.equal(res.status, 403)

    const traces = await prisma.auditLog.count()
    assert.equal(traces, 0)
  })
})
