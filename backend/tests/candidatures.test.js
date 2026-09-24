require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerCoordinateur, creerAdmin, creerSpecialiste, creerUtilisateur } = require('./helpers/factories')
const s3 = require('../src/lib/s3')

// Le stockage n'est pas forcément joignable depuis la suite : on remplace les
// deux fonctions S3 utilisées, en gardant la trace de ce qui a été déposé.
const putOriginal = s3.putObject
const streamOriginal = s3.getObjectStream
const urlOriginal = s3.getSignedDownloadUrl
let depots = []

test.beforeEach(async () => {
  await viderBase()
  depots = []
  s3.putObject = async (key, body, contentType) => {
    depots.push({ key, taille: body.length, contentType })
    return key
  }
  s3.getSignedDownloadUrl = async (key) => 'https://stockage.test/' + key
  s3.getObjectStream = async () => {
    const { Readable } = require('stream')
    return { body: Readable.from([Buffer.from('image')]), contentType: 'image/png', contentLength: 5 }
  }
})
test.after(async () => {
  s3.putObject = putOriginal
  s3.getObjectStream = streamOriginal
  s3.getSignedDownloadUrl = urlOriginal
  await fermerBase()
})

// Un PNG minimal, suffisant pour multer (le type MIME vient du champ, pas du contenu).
const PHOTO = Buffer.from('89504e470d0a1a0a', 'hex')

let compteur = 0
const emailUnique = () => `candidat-${process.pid}-${++compteur}@imsop.test`

// Un médecin traitant doit déclarer où il exerce : ce raccourci évite de
// répéter le bloc dans chaque cas de test qui ne s'y intéresse pas.
const medecin = (champs = {}) => ({
  type: 'MEDECIN_LOCAL',
  specialite: 'Médecine générale',
  pays: 'Cameroun',
  typeStructure: 'CLINIQUE',
  nomClinique: 'Clinique du Littoral',
  ...champs,
})

function deposer(champs = {}) {
  const req = api().post('/api/candidatures')
  const valeurs = {
    type: 'SPECIALISTE',
    fullName: 'Dr. Awa Ndiaye',
    email: emailUnique(),
    specialite: 'Oncologie',
    etablissement: 'Institut Curie',
    pays: 'France',
    langues: 'FR, EN',
    presentation: 'Oncologue médicale depuis douze ans, spécialisée dans les tumeurs mammaires et pulmonaires.',
    ...champs,
  }
  for (const [cle, valeur] of Object.entries(valeurs)) {
    if (valeur !== undefined && valeur !== null) req.field(cle, String(valeur))
  }
  if (champs.photo !== null) req.attach('photo', PHOTO, { filename: 'photo.png', contentType: 'image/png' })
  return req
}

test('Candidatures — dépôt public', async (t) => {
  await t.test('un praticien dépose sa candidature avec sa photo, sans compte', async () => {
    const res = await deposer().expect(201)

    assert.ok(res.body.id)
    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.equal(c.statut, 'EN_ATTENTE')
    assert.equal(c.type, 'SPECIALISTE')
    assert.match(c.photoKey, /\.png$/)
    // La photo est réellement déposée dans le stockage.
    assert.equal(depots.length, 1)
    assert.ok(depots[0].key.startsWith('candidatures/photos/'))
  })

  await t.test('le formulaire médecin traitant porte ses champs propres', async () => {
    const res = await deposer(medecin({
      ville: 'Douala',
      numeroOrdre: 'CM-12345',
    })).expect(201)

    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.equal(c.type, 'MEDECIN_LOCAL')
    assert.equal(c.ville, 'Douala')
    assert.equal(c.numeroOrdre, 'CM-12345')
  })

  // --- Lieu d'exercice du médecin traitant ---------------------------------
  //
  // Le comité vérifie l'exercice réel en appelant la structure. Un médecin qui
  // déclare une clinique sans la nommer ne serait pas vérifiable, d'où
  // l'obligation portée sur le nom et non sur le téléphone.

  await t.test("le médecin déclare la clinique où il exerce, avec son contact", async () => {
    const res = await deposer(medecin({
      typeStructure: 'CLINIQUE',
      nomClinique: 'Clinique du Littoral',
      telClinique: '+237 233 42 00 00',
      emailClinique: 'Contact@Littoral.CM',
    })).expect(201)

    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.equal(c.typeStructure, 'CLINIQUE')
    assert.equal(c.nomClinique, 'Clinique du Littoral')
    assert.equal(c.telClinique, '+237 233 42 00 00')
    assert.equal(c.emailClinique, 'contact@littoral.cm', "l'adresse est normalisée en minuscules")
    assert.equal(c.nomHopital, null)
  })

  await t.test("le médecin qui exerce des deux côtés renseigne les deux structures", async () => {
    const res = await deposer(medecin({
      typeStructure: 'LES_DEUX',
      nomClinique: 'Clinique du Littoral',
      telClinique: '+237 233 42 00 00',
      nomHopital: 'Hôpital Laquintinie',
      telHopital: '+237 233 42 11 11',
    })).expect(201)

    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.equal(c.typeStructure, 'LES_DEUX')
    assert.equal(c.nomClinique, 'Clinique du Littoral')
    assert.equal(c.nomHopital, 'Hôpital Laquintinie')
  })

  await t.test("un médecin traitant sans lieu d'exercice est refusé", async () => {
    const res = await deposer({
      type: 'MEDECIN_LOCAL',
      specialite: 'Médecine générale',
      pays: 'Cameroun',
    }).expect(400)

    assert.ok(res.body.errors.some((e) => e.field === 'typeStructure'))
    assert.equal(await prisma.candidature.count(), 0)
  })

  await t.test('une structure déclarée mais pas nommée est refusée', async () => {
    const res = await deposer({
      type: 'MEDECIN_LOCAL',
      specialite: 'Médecine générale',
      pays: 'Cameroun',
      typeStructure: 'HOPITAL',
    }).expect(400)

    assert.ok(res.body.errors.some((e) => e.field === 'nomHopital'))
  })

  await t.test("« les deux » exige les deux noms, pas un seul", async () => {
    const res = await deposer({
      type: 'MEDECIN_LOCAL',
      specialite: 'Médecine générale',
      pays: 'Cameroun',
      typeStructure: 'LES_DEUX',
      nomClinique: 'Clinique du Littoral',
    }).expect(400)

    assert.ok(res.body.errors.some((e) => e.field === 'nomHopital'))
  })

  await t.test("un lieu d'exercice sur une candidature de spécialiste est refusé", async () => {
    // Le spécialiste international n'exerce pas dans une structure locale :
    // accepter le champ laisserait croire au comité qu'il a été renseigné.
    const res = await deposer({ typeStructure: 'CLINIQUE', nomClinique: 'Ailleurs' }).expect(400)
    assert.ok(res.body.errors.some((e) => e.field === 'typeStructure'))
  })

  await t.test("le téléphone de la structure reste facultatif", async () => {
    const res = await deposer(medecin({ typeStructure: 'HOPITAL', nomHopital: 'Hôpital Laquintinie' })).expect(201)
    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.equal(c.telHopital, null)
    assert.equal(c.nomHopital, 'Hôpital Laquintinie')
  })

  await t.test("une adresse de structure invalide est refusée", async () => {
    const res = await deposer(medecin({ emailClinique: 'pas-une-adresse' })).expect(400)
    assert.ok(res.body.errors.some((e) => e.field === 'emailClinique'))
  })

  await t.test("la structure alimente l'établissement, repris ensuite par le profil", async () => {
    const res = await deposer(medecin({
      etablissement: undefined,
      typeStructure: 'LES_DEUX',
      nomClinique: 'Clinique du Littoral',
      nomHopital: 'Hôpital Laquintinie',
    })).expect(201)

    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.equal(c.etablissement, 'Clinique du Littoral et Hôpital Laquintinie')
  })

  await t.test('sans photo, la candidature est refusée', async () => {
    await deposer({ photo: null }).expect(400)
    assert.equal(await prisma.candidature.count(), 0)
  })

  await t.test('une présentation trop courte est refusée', async () => {
    await deposer({ presentation: 'Trop court.' }).expect(400)
  })

  // Le comité recevrait sinon la même personne plusieurs fois.
  await t.test('une seconde candidature avec le même e-mail est refusée tant que la première est ouverte', async () => {
    const email = emailUnique()
    await deposer({ email }).expect(201)
    await deposer({ email }).expect(409)
  })

  await t.test("un e-mail déjà rattaché à un compte ne peut pas candidater", async () => {
    const { user } = await creerSpecialiste()
    await deposer({ email: user.email }).expect(409)
  })

  await t.test('le comité est prévenu du dépôt', async () => {
    const coordinateur = await creerCoordinateur()
    await deposer().expect(201)

    const notif = await prisma.notification.findFirst({ where: { userId: coordinateur.id, type: 'CANDIDATURE_RECUE' } })
    assert.ok(notif)
  })
})

test('Candidatures — examen par le comité', async (t) => {
  async function candidatureEnAttente(champs) {
    const res = await deposer(champs).expect(201)
    return prisma.candidature.findUnique({ where: { id: res.body.id } })
  }

  await t.test('le comité voit la file des candidatures en attente', async () => {
    const coordinateur = await creerCoordinateur()
    await candidatureEnAttente()
    await candidatureEnAttente()

    const res = await api()
      .get('/api/candidatures?statut=EN_ATTENTE')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.length, 2)
  })

  await t.test('la photo est lisible par le comité', async () => {
    const coordinateur = await creerCoordinateur()
    const c = await candidatureEnAttente()

    const res = await api()
      .get(`/api/candidatures/${c.id}/photo`)
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.match(res.headers['content-type'], /image/)
  })

  // Le comité décide hors de la plateforme : écarter n'est qu'un rangement de
  // la file, sans courriel au candidat — c'est le comité qui lui répond.
  await t.test('écarter une candidature la sort de la file sans prévenir le candidat', async () => {
    const coordinateur = await creerCoordinateur()
    const c = await candidatureEnAttente()

    const res = await api()
      .post(`/api/candidatures/${c.id}/ecarter`)
      .set('Authorization', entete(coordinateur))
      .send({ motif: 'Diplôme non reconnu dans le pays déclaré.' })
      .expect(200)

    assert.equal(res.body.statut, 'REFUSEE')
    assert.match(res.body.motifRefus, /Diplôme/)
    assert.equal(res.body.decideParId, coordinateur.id)
  })

  await t.test('écarter sans note est accepté', async () => {
    const coordinateur = await creerCoordinateur()
    const c = await candidatureEnAttente()

    const res = await api()
      .post(`/api/candidatures/${c.id}/ecarter`)
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.statut, 'REFUSEE')
    assert.equal(res.body.motifRefus, null)
  })

  await t.test("une candidature dont le compte existe ne s'écarte plus", async () => {
    const coordinateur = await creerCoordinateur()
    const c = await candidatureEnAttente()
    await api().post(`/api/candidatures/${c.id}/creer-compte`).set('Authorization', entete(coordinateur)).expect(201)

    await api().post(`/api/candidatures/${c.id}/ecarter`).set('Authorization', entete(coordinateur)).expect(409)
  })

  await t.test("un spécialiste n'a accès à aucune candidature", async () => {
    const { user } = await creerSpecialiste()
    await api().get('/api/candidatures').set('Authorization', entete(user)).expect(403)
  })

  await t.test('sans authentification, la file est fermée', async () => {
    await api().get('/api/candidatures').expect(401)
  })
})

test('Candidatures — création du compte par la coordination', async (t) => {
  // Plus d'etape d'acceptation dans l'application : le comite a deja decide, la
  // coordination cree le compte directement depuis la candidature recue.
  async function candidatureAcceptee(champs) {
    const coordinateur = await creerCoordinateur()
    const res = await deposer(champs).expect(201)
    return { coordinateur, candidature: await prisma.candidature.findUnique({ where: { id: res.body.id } }) }
  }

  await t.test("un spécialiste accepté obtient un compte VALIDE, recopié depuis sa candidature", async () => {
    const { coordinateur, candidature } = await candidatureAcceptee()

    const res = await api()
      .post(`/api/candidatures/${candidature.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)

    const user = res.body.user
    assert.equal(user.email, candidature.email)
    assert.equal(user.role, 'SPECIALISTE')
    assert.equal(user.specialiste.specialite, 'Oncologie')
    assert.equal(user.specialiste.etablissement, 'Institut Curie')
    // Le comité a validé : le compte n'a pas à repasser par la vérification.
    assert.equal(user.specialiste.verificationStatus, 'VALIDE')
    // Le mot de passe part par e-mail, jamais dans la réponse.
    assert.equal(res.body.motDePasse, undefined)
    assert.equal(res.body.temporaryPassword, undefined)

    const c = await prisma.candidature.findUnique({ where: { id: candidature.id } })
    assert.equal(c.statut, 'COMPTE_CREE')
    assert.equal(c.compteUserId, user.id)
  })

  // --- Renvoi des identifiants ---------------------------------------------
  //
  // Un courriel se perd. Sans renvoi, le compte existe mais personne ne peut
  // s'y connecter : la seule issue passait par la base de données.

  await t.test("la coordination renvoie les identifiants d'un compte déjà créé", async () => {
    const { coordinateur, candidature } = await candidatureAcceptee()
    await api()
      .post(`/api/candidatures/${candidature.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)

    const avant = await prisma.user.findUnique({ where: { email: candidature.email } })

    const res = await api()
      .post(`/api/candidatures/${candidature.id}/renvoyer-identifiants`)
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.email, candidature.email)

    // Le mot de passe est régénéré : l'ancien n'existe nulle part en clair.
    const apres = await prisma.user.findUnique({ where: { email: candidature.email } })
    assert.notEqual(apres.passwordHash, avant.passwordHash)
  })

  await t.test('le renvoi révoque les sessions ouvertes', async () => {
    const { coordinateur, candidature } = await candidatureAcceptee()
    const creation = await api()
      .post(`/api/candidatures/${candidature.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)

    await prisma.refreshToken.create({
      data: { tokenHash: `test-${creation.body.user.id}`, userId: creation.body.user.id, expiresAt: new Date(Date.now() + 864e5) },
    })

    await api()
      .post(`/api/candidatures/${candidature.id}/renvoyer-identifiants`)
      .set('Authorization', entete(coordinateur))
      .expect(200)

    const vivants = await prisma.refreshToken.count({ where: { userId: creation.body.user.id, revokedAt: null } })
    assert.equal(vivants, 0, 'un mot de passe remplacé ne laisse pas de session ouverte')
  })

  await t.test("on ne renvoie rien tant que le compte n'existe pas", async () => {
    const { coordinateur, candidature } = await candidatureAcceptee()
    await api()
      .post(`/api/candidatures/${candidature.id}/renvoyer-identifiants`)
      .set('Authorization', entete(coordinateur))
      .expect(409)
  })

  await t.test("un compte suspendu ne reçoit pas de nouveaux identifiants", async () => {
    const { coordinateur, candidature } = await candidatureAcceptee()
    const creation = await api()
      .post(`/api/candidatures/${candidature.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)

    await prisma.user.update({ where: { id: creation.body.user.id }, data: { active: false } })

    // Renvoyer des identifiants à un compte suspendu rouvrirait une porte
    // qu'on vient de fermer.
    await api()
      .post(`/api/candidatures/${candidature.id}/renvoyer-identifiants`)
      .set('Authorization', entete(coordinateur))
      .expect(409)
  })

  await t.test('un médecin traitant accepté obtient un compte MEDECIN_LOCAL avec sa ville', async () => {
    const { coordinateur, candidature } = await candidatureAcceptee(medecin({
      ville: 'Bafoussam',
      numeroOrdre: 'CM-777',
    }))

    const res = await api()
      .post(`/api/candidatures/${candidature.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)

    assert.equal(res.body.user.role, 'MEDECIN_LOCAL')
    assert.equal(res.body.user.medecinLocal.ville, 'Bafoussam')
    assert.equal(res.body.user.medecinLocal.numeroOrdre, 'CM-777')
    assert.equal(res.body.user.medecinLocal.verificationStatus, 'VALIDE')
  })

  // Le praticien doit pouvoir se connecter avec ce qu'il a reçu : le hash en
  // base correspond bien à un mot de passe de la forme attendue.
  await t.test('le compte créé a un mot de passe et exige la 2FA', async () => {
    const { coordinateur, candidature } = await candidatureAcceptee()
    await api().post(`/api/candidatures/${candidature.id}/creer-compte`).set('Authorization', entete(coordinateur)).expect(201)

    const user = await prisma.user.findUnique({ where: { email: candidature.email } })
    assert.ok(user.passwordHash.startsWith('$2'), 'le mot de passe doit être haché avec bcrypt')
    assert.equal(user.twoFactorEnabled, true)
    assert.equal(user.active, true)
  })

  // L'etape d'acceptation a disparu : une candidature recue donne un compte
  // directement. Seule celle qui a ete ecartee reste sans suite.
  await t.test("une candidature écartée ne donne pas de compte", async () => {
    const coordinateur = await creerCoordinateur()
    const res = await deposer().expect(201)
    await api().post(`/api/candidatures/${res.body.id}/ecarter`).set('Authorization', entete(coordinateur)).expect(200)

    await api()
      .post(`/api/candidatures/${res.body.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(409)

    assert.equal(await prisma.user.count({ where: { role: 'SPECIALISTE' } }), 0)
  })

  // Ce que le candidat a déjà renseigné n'a pas à être redemandé : le pays part
  // en code ISO, celui que l'annuaire attend, et la spécialité déclarée y est
  // reportée quand elle correspond à une spécialité de proximité.
  await t.test("le compte médecin arrive prêt pour l'annuaire", async () => {
    const { coordinateur, candidature } = await candidatureAcceptee(medecin({
      specialite: 'Pédiatrie',
      pays: 'cm',
      ville: 'Douala',
    }))

    const res = await api()
      .post(`/api/candidatures/${candidature.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)

    assert.equal(res.body.user.medecinLocal.pays, 'cm', "le code ISO, pas « Cameroun »")
    assert.deepEqual(res.body.user.medecinLocal.annuaireSpecialites, ['pediatrie'])
  })

  await t.test("une spécialité sans équivalent de proximité ne remplit rien", async () => {
    const { coordinateur, candidature } = await candidatureAcceptee(medecin({ specialite: 'Anatomopathologie' }))

    const res = await api()
      .post(`/api/candidatures/${candidature.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)

    assert.deepEqual(res.body.user.medecinLocal.annuaireSpecialites, [])
  })

  await t.test('une candidature reçue donne un compte sans étape intermédiaire', async () => {
    const coordinateur = await creerCoordinateur()
    const res = await deposer().expect(201)

    await api()
      .post(`/api/candidatures/${res.body.id}/creer-compte`)
      .set('Authorization', entete(coordinateur))
      .expect(201)
  })

  await t.test('on ne crée pas deux fois le compte', async () => {
    const { coordinateur, candidature } = await candidatureAcceptee()
    await api().post(`/api/candidatures/${candidature.id}/creer-compte`).set('Authorization', entete(coordinateur)).expect(201)
    await api().post(`/api/candidatures/${candidature.id}/creer-compte`).set('Authorization', entete(coordinateur)).expect(409)
  })

  await t.test("l'administrateur peut aussi créer le compte", async () => {
    const { candidature } = await candidatureAcceptee()
    const admin = await creerAdmin()
    await api().post(`/api/candidatures/${candidature.id}/creer-compte`).set('Authorization', entete(admin)).expect(201)
  })
})

// Le comité scientifique n'a pas de compte : c'est par e-mail qu'il reçoit chaque
// formulaire rempli, photo jointe. Sans cet envoi, le comité ne saurait jamais
// qu'une candidature existe.
test('Candidatures — envoi au comité scientifique', async (t) => {
  const mailer = require('../src/lib/mailer')
  const env = require('../src/config/env')
  const sendOriginal = mailer.sendMail
  const comiteOriginal = [...env.comite.emails]
  let courriels = []

  t.beforeEach(() => {
    courriels = []
    mailer.sendMail = async (m) => { courriels.push(m); return { skipped: true } }
  })
  t.after(() => {
    mailer.sendMail = sendOriginal
    env.comite.emails = comiteOriginal
  })

  await t.test('chaque membre du comité reçoit le formulaire rempli avec la photo', async () => {
    env.comite.emails = ['comite-a@imsop.test', 'comite-b@imsop.test']
    await deposer({ fullName: 'Dr. Karim Benali', specialite: 'Néphrologie' }).expect(201)

    const auComite = courriels.filter((m) => env.comite.emails.includes(m.to))
    assert.equal(auComite.length, 2, 'un courriel par membre du comité')
    for (const m of auComite) {
      assert.match(m.subject, /Karim Benali/)
      assert.match(m.text, /Néphrologie/)
      assert.match(m.text, /Parcours et motivations/)
      assert.equal(m.attachments.length, 1, 'la photo doit être jointe')
      assert.match(m.attachments[0].contentType, /image/)
    }
  })

  await t.test("le courriel au comité porte le lieu d'exercice et son contact", async () => {
    env.comite.emails = ['comite@imsop.test']
    await deposer(medecin({
      typeStructure: 'LES_DEUX',
      nomClinique: 'Clinique du Littoral',
      telClinique: '+237 233 42 00 00',
      nomHopital: 'Hôpital Laquintinie',
      telHopital: '+237 233 42 11 11',
    })).expect(201)

    const auComite = courriels.find((m) => m.to === 'comite@imsop.test')
    assert.match(auComite.text, /Lieu d'exercice : Clinique et hôpital/)
    assert.match(auComite.text, /Clinique : Clinique du Littoral/)
    assert.match(auComite.text, /Téléphone clinique : \+237 233 42 00 00/)
    assert.match(auComite.text, /Hôpital : Hôpital Laquintinie/)
  })

  await t.test("le courriel d'un spécialiste ne porte pas de lieu d'exercice", async () => {
    env.comite.emails = ['comite@imsop.test']
    await deposer().expect(201)

    const auComite = courriels.find((m) => m.to === 'comite@imsop.test')
    assert.equal(/Lieu d'exercice/.test(auComite.text), false)
  })

  await t.test("le candidat reçoit un accusé de réception, distinct du courriel au comité", async () => {
    env.comite.emails = ['comite@imsop.test']
    const email = emailUnique()
    await deposer({ email }).expect(201)

    const auCandidat = courriels.find((m) => m.to === email)
    assert.ok(auCandidat)
    assert.match(auCandidat.subject, /bien été reçue/)
    assert.equal(auCandidat.attachments, undefined, "le candidat n'a pas à recevoir sa propre photo")
  })

  await t.test('sans adresse de comité configurée, le dépôt aboutit quand même', async () => {
    env.comite.emails = []
    await deposer().expect(201)
    assert.equal(courriels.filter((m) => /candidature .* :/.test(m.subject)).length, 0)
  })
})

// Le CV est facultatif : exiger un fichier ferait abandonner des candidatures,
// et le comité peut juger sur la présentation seule.
test('Candidatures — CV', async (t) => {
  const CV = Buffer.from('%PDF-1.4 test')

  function deposerAvecCv(champs = {}) {
    const req = deposer(champs)
    return req.attach('cv', CV, { filename: 'cv.pdf', contentType: 'application/pdf' })
  }

  await t.test('un CV PDF est accepté et rangé à part', async () => {
    const res = await deposerAvecCv().expect(201)

    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.match(c.cvKey, /\.pdf$/)
    assert.ok(depots.some((d) => d.key.startsWith('candidatures/cv/')), 'le CV doit aller dans son propre dossier')
    assert.ok(depots.some((d) => d.key.startsWith('candidatures/photos/')), 'la photo garde le sien')
  })

  await t.test('sans CV, la candidature passe quand même', async () => {
    const res = await deposer().expect(201)
    const c = await prisma.candidature.findUnique({ where: { id: res.body.id } })
    assert.equal(c.cvKey, null)
  })

  // Une photo déposée comme CV, ou l'inverse, doit être refusée : le contrôle
  // porte sur le champ, pas sur une liste commune.
  await t.test("un CV qui n'est pas un PDF est refusé", async () => {
    await deposer()
      .attach('cv', PHOTO, { filename: 'cv.png', contentType: 'image/png' })
      .expect(400)
    assert.equal(await prisma.candidature.count(), 0)
  })

  await t.test('la coordination obtient un lien vers le CV', async () => {
    const coordinateur = await creerCoordinateur()
    const depot = await deposerAvecCv().expect(201)

    const res = await api()
      .get(`/api/candidatures/${depot.body.id}/cv`)
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.match(res.body.url, /candidatures\/cv\//)
  })

  await t.test("sans CV, le téléchargement le dit clairement", async () => {
    const coordinateur = await creerCoordinateur()
    const depot = await deposer().expect(201)

    const res = await api()
      .get(`/api/candidatures/${depot.body.id}/cv`)
      .set('Authorization', entete(coordinateur))
      .expect(404)

    assert.match(res.body.message, /Aucun CV/)
  })
})
