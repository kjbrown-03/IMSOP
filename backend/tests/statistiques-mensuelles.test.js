require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerPatient, creerSpecialiste, creerCoordinateur, creerAdmin, creerDossier } = require('./helpers/factories')
const {
  calculerStatistiquesMensuelles,
  moisDe,
  derniersMois,
} = require('../src/services/statistiquesMensuellesService')

const kpi = (ligne, cle) => ligne.kpis.find((k) => k.cle === cle)
const moisCourant = () => moisDe(new Date())
const ligneDuMois = (donnees) => donnees.mois.find((m) => m.mois === moisCourant())

test.beforeEach(viderBase)
test.after(fermerBase)

// Le découpage décide de la ligne dans laquelle tombe chaque événement : c'est
// la partie qu'il faut verrouiller avant tout le reste.
test('Statistiques mensuelles — découpage des mois', async (t) => {
  await t.test('une date en milieu de mois tombe dans son mois', () => {
    assert.equal(moisDe(new Date('2026-03-15T12:00:00Z')), '2026-03')
  })

  // Douala est à UTC+1 : sans calage, ce dossier basculerait en février.
  await t.test('le dernier soir du mois reste dans le mois, heure de Douala', () => {
    assert.equal(moisDe(new Date('2026-01-31T23:30:00+01:00')), '2026-01')
  })

  await t.test('le premier instant du mois suivant bascule bien', () => {
    assert.equal(moisDe(new Date('2026-02-01T00:15:00+01:00')), '2026-02')
  })

  await t.test('la série est ordonnée du plus ancien au plus récent', () => {
    const mois = derniersMois(3, new Date('2026-03-10T12:00:00Z'))
    assert.deepEqual(mois, ['2026-01', '2026-02', '2026-03'])
  })

  await t.test('la série traverse un changement d\'année', () => {
    const mois = derniersMois(3, new Date('2026-02-10T12:00:00Z'))
    assert.deepEqual(mois, ['2025-12', '2026-01', '2026-02'])
  })

  await t.test('le nombre de mois demandé est respecté', () => {
    assert.equal(derniersMois(12).length, 12)
  })
})

test('Statistiques mensuelles — les dix indicateurs', async (t) => {
  await t.test('une base vide rend des mois sans taux plutôt que des zéros', async () => {
    const donnees = await calculerStatistiquesMensuelles({ mois: 3 })
    const ligne = ligneDuMois(donnees)

    assert.equal(kpi(ligne, 'demandes').valeur, 0)
    // Un taux sur zéro dossier n'est pas 0 %, il n'existe pas : un zéro se
    // lirait comme « aucune conversion », ce qui est faux.
    assert.equal(kpi(ligne, 'tauxConversion').valeur, null)
    assert.equal(kpi(ligne, 'delaiMoyen').valeur, null)
  })

  await t.test('les demandes et les dossiers complets se comptent', async () => {
    const { patient } = await creerPatient()
    await creerDossier({ patient, status: 'BROUILLON' })
    await creerDossier({ patient, status: 'SOUMIS' })
    await creerDossier({ patient, status: 'COMPLET' })

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))

    assert.equal(kpi(ligne, 'demandes').valeur, 3)
    assert.equal(kpi(ligne, 'dossiersComplets').valeur, 1)
    // 2 dossiers sortis du brouillon sur 3 créés.
    assert.equal(kpi(ligne, 'tauxConversion').valeur, 66.7)
  })

  // Le coût moyen a été retiré du périmètre : aucune ligne ne doit le rendre,
  // même indisponible.
  await t.test('le coût moyen ne figure plus dans la série', async () => {
    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    assert.equal(kpi(ligne, 'coutMoyen'), undefined)
    assert.equal(ligne.kpis.length, 9)
  })

  await t.test('le revenu moyen est rendu par devise', async () => {
    const { patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    await prisma.paiement.createMany({
      data: [
        { dossierId: dossier.id, amount: 50000, currency: 'XAF', status: 'PAYE', confirmedAt: new Date() },
        { dossierId: dossier.id, amount: 70000, currency: 'XAF', status: 'PAYE', confirmedAt: new Date() },
        { dossierId: dossier.id, amount: 100, currency: 'EUR', status: 'PAYE', confirmedAt: new Date() },
      ],
    })

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    const revenu = kpi(ligne, 'revenuMoyen').valeur

    // Additionner des XAF et des EUR sans taux de conversion ne voudrait rien
    // dire : chaque devise garde sa ligne.
    assert.equal(revenu.find((r) => r.devise === 'XAF').montant, 60000)
    assert.equal(revenu.find((r) => r.devise === 'EUR').montant, 100)
  })

  await t.test('un paiement non confirmé ne compte pas', async () => {
    const { patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    await prisma.paiement.create({
      data: { dossierId: dossier.id, amount: 50000, currency: 'XAF', status: 'EN_ATTENTE' },
    })

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    assert.deepEqual(kpi(ligne, 'revenuMoyen').valeur, [])
  })

  await t.test('la satisfaction sépare patients et médecins', async () => {
    const { user: patientUser } = await creerPatient()
    const { user: autrePatient } = await creerPatient()

    await prisma.temoignage.createMany({
      data: [
        { userId: patientUser.id, roleAuteur: 'PATIENT', texte: 'Très bien', note: 5 },
        { userId: autrePatient.id, roleAuteur: 'PATIENT', texte: 'Correct', note: 3 },
        { userId: patientUser.id, roleAuteur: 'MEDECIN_LOCAL', texte: 'Utile', note: 4 },
      ],
    })

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))

    assert.equal(kpi(ligne, 'satisfactionPatient').valeur, 4)
    assert.equal(kpi(ligne, 'satisfactionPatient').echantillon, 2)
    assert.equal(kpi(ligne, 'satisfactionMedecin').valeur, 4)
    assert.equal(kpi(ligne, 'satisfactionMedecin').echantillon, 1)
  })

  await t.test('un témoignage rejeté compte quand même dans la note', async () => {
    const { user } = await creerPatient()
    await prisma.temoignage.create({
      data: { userId: user.id, roleAuteur: 'PATIENT', texte: 'Déçu', note: 2, statut: 'REJETE' },
    })

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    assert.equal(kpi(ligne, 'satisfactionPatient').valeur, 2)
  })

  await t.test('un témoignage sans note ne fausse pas la moyenne', async () => {
    const { user } = await creerPatient()
    await prisma.temoignage.createMany({
      data: [
        { userId: user.id, roleAuteur: 'PATIENT', texte: 'Avec note', note: 4 },
        { userId: user.id, roleAuteur: 'PATIENT', texte: 'Sans note' },
      ],
    })

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    assert.equal(kpi(ligne, 'satisfactionPatient').valeur, 4)
    assert.equal(kpi(ligne, 'satisfactionPatient').echantillon, 1)
  })
})

test("Statistiques mensuelles — acceptation et compléments", async (t) => {
  async function tracer(action, dossierId, userId) {
    await prisma.auditLog.create({ data: { userId, action, entityType: 'Dossier', entityId: dossierId, dossierId } })
  }

  // La récusation déontologique n'est pas un refus de travailler : la compter
  // comme tel pénaliserait l'expert qui fait exactement ce qu'on attend de lui.
  await t.test("la récusation est exclue du taux d'acceptation", async () => {
    const { user, specialiste } = await creerSpecialiste()
    const { patient } = await creerPatient()
    const dossier = await creerDossier({ patient, specialiste })

    await tracer('DOSSIER_ACCEPTE', dossier.id, user.id)
    await tracer('DOSSIER_ACCEPTE', dossier.id, user.id)
    await tracer('DOSSIER_REFUSE', dossier.id, user.id)
    await tracer('DOSSIER_CONFLIT_INTERETS', dossier.id, user.id)

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    const acceptation = kpi(ligne, 'tauxAcceptationSpecialistes')

    // 2 acceptations sur 3 prises de position — la récusation n'entre pas.
    assert.equal(acceptation.valeur, 66.7)
    assert.equal(acceptation.echantillon, 3)
    assert.equal(acceptation.recusations, 1)
  })

  // Le dossier repasse en analyse dès le complément fourni : le compter par son
  // statut courant le ferait disparaître de l'indicateur.
  await t.test('un complément déjà fourni compte encore', async () => {
    const { user, specialiste } = await creerSpecialiste()
    const { patient } = await creerPatient()
    const avecComplement = await creerDossier({ patient, specialiste, status: 'EN_ANALYSE' })
    await creerDossier({ patient, status: 'SOUMIS' })

    await tracer('DOSSIER_COMPLEMENT_DEMANDE', avecComplement.id, user.id)

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    assert.equal(kpi(ligne, 'tauxComplementsDemandes').valeur, 50)
  })

  await t.test('deux demandes sur le même dossier ne le comptent qu\'une fois', async () => {
    const { user, specialiste } = await creerSpecialiste()
    const { patient } = await creerPatient()
    const dossier = await creerDossier({ patient, specialiste })

    await tracer('DOSSIER_COMPLEMENT_DEMANDE', dossier.id, user.id)
    await tracer('DOSSIER_COMPLEMENT_DEMANDE', dossier.id, user.id)

    const ligne = ligneDuMois(await calculerStatistiquesMensuelles({ mois: 1 }))
    assert.equal(kpi(ligne, 'tauxComplementsDemandes').valeur, 100)
  })
})

test('Statistiques mensuelles — accès', async (t) => {
  await t.test('le coordinateur y a accès', async () => {
    const coordinateur = await creerCoordinateur()

    const res = await api()
      .get('/api/admin/statistiques/mensuel?mois=6')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.mois.length, 6)
    assert.equal(res.body.fuseau, 'Africa/Douala')
  })

  // Dérogation assumée au §32 : la direction a ouvert le financier à la
  // coordination.
  await t.test('le coordinateur voit désormais le financier', async () => {
    const coordinateur = await creerCoordinateur()

    const res = await api()
      .get('/api/admin/statistiques')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.ok(res.body.finance, 'le bloc financier doit être rendu au coordinateur')
    const revenu = res.body.kpis.find((k) => k.cle === 'revenuMoyenParDossier')
    assert.equal(revenu.disponible, true)
  })

  await t.test("l'administrateur y a accès", async () => {
    const admin = await creerAdmin()
    await api().get('/api/admin/statistiques/mensuel').set('Authorization', entete(admin)).expect(200)
  })

  await t.test("un spécialiste n'y a pas accès", async () => {
    const { user } = await creerSpecialiste()
    await api().get('/api/admin/statistiques/mensuel').set('Authorization', entete(user)).expect(403)
  })
})
