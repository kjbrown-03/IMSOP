const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { v4: uuidv4 } = require('uuid')
const { prisma } = require('../lib/prisma')
// Le module entier plutot que ses fonctions destructurees : une liaison locale
// figee a la lecture empecherait de substituer le stockage dans les tests.
const s3 = require('../lib/s3')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
// Meme raison que pour s3 : le module, pour rester substituable dans les tests.
const mailer = require('../lib/mailer')
const { safeUserSelect } = require('../lib/selectors')
const env = require('../config/env')
const { PAYS_CEMAC } = require('../lib/cemac')
const { estSpecialiteLocale } = require('../lib/specialitesLocales')

/**
 * Parcours de recrutement.
 *
 *   1. Le comité scientifique invite un praticien à remplir le formulaire public
 *      (/candidature/specialiste ou /candidature/medecin), avec sa photo.
 *   2. Le comité examine la candidature et l'accepte ou la refuse. Un refus est
 *      notifié au candidat par e-mail, avec le motif.
 *   3. Une candidature acceptée arrive dans la file de la coordination, qui
 *      crée le compte en un clic : les champs sont recopiés, un mot de passe est
 *      généré, les identifiants partent par e-mail.
 *
 * Le comité et la coordination partagent ici les mêmes rôles (COORDINATEUR,
 * ADMIN) — un rôle « comité » distinct est possible mais n'a pas été retenu
 * pour l'instant.
 */

const PHOTO_PREFIX = 'candidatures/photos/'
const CV_PREFIX = 'candidatures/cv/'
const PHOTO_FILE_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp)$/
const EXTENSION_PAR_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
const MIME_PAR_EXTENSION = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

const ROLES_PAR_TYPE = { SPECIALISTE: 'SPECIALISTE', MEDECIN_LOCAL: 'MEDECIN_LOCAL' }

// --- Formulaire public --------------------------------------------------------

async function deposer(req, res) {
  // `fields` range les fichiers par nom de champ : la photo reste obligatoire,
  // le CV est facultatif.
  const photoFichier = req.files?.photo?.[0]
  const cvFichier = req.files?.cv?.[0]
  if (!photoFichier) return res.status(400).json({ message: 'La photo est obligatoire' })

  const {
    type, fullName, email, phone, specialite, etablissement, pays, ville, langues, numeroOrdre, presentation,
    typeStructure, nomClinique, telClinique, emailClinique, nomHopital, telHopital, emailHopital,
  } = req.body

  // Un compte existant avec cet e-mail n'a rien à candidater ; une candidature
  // encore ouverte non plus. Sans ce contrôle, le comité recevrait des doublons.
  const [compte, enCours] = await Promise.all([
    prisma.user.findUnique({ where: { email }, select: { id: true } }),
    prisma.candidature.findFirst({ where: { email, statut: { in: ['EN_ATTENTE', 'ACCEPTEE'] } }, select: { id: true } }),
  ])
  if (compte) return res.status(409).json({ message: 'Un compte existe déjà avec cette adresse e-mail' })
  if (enCours) return res.status(409).json({ message: 'Une candidature est déjà en cours avec cette adresse e-mail' })

  const fichier = `${uuidv4()}.${EXTENSION_PAR_MIME[photoFichier.mimetype]}`
  await s3.putObject(`${PHOTO_PREFIX}${fichier}`, photoFichier.buffer, photoFichier.mimetype)

  let cvFichierNom = null
  if (cvFichier) {
    cvFichierNom = `${uuidv4()}.pdf`
    await s3.putObject(`${CV_PREFIX}${cvFichierNom}`, cvFichier.buffer, cvFichier.mimetype)
  }

  const candidature = await prisma.candidature.create({
    data: {
      type,
      fullName,
      email,
      phone,
      photoKey: fichier,
      cvKey: cvFichierNom,
      specialite,
      etablissement,
      pays,
      ville,
      langues,
      numeroOrdre,
      presentation,
      typeStructure,
      nomClinique,
      telClinique,
      emailClinique,
      nomHopital,
      telHopital,
      emailHopital,
      // `etablissement` alimente le profil au moment de créer le compte. Pour un
      // médecin traitant, la structure d'exercice EST l'établissement : on y
      // recopie le résumé plutôt que de laisser le champ vide.
      ...(type === 'MEDECIN_LOCAL'
        ? { etablissement: etablissement || resumeStructure({ typeStructure, nomClinique, nomHopital }) }
        : {}),
    },
  })

  await logAction({
    action: 'CANDIDATURE_DEPOSEE',
    entityType: 'Candidature',
    entityId: candidature.id,
    metadata: { type, email },
    ipAddress: req.ip,
  })

  // Accusé de réception au candidat — pas de compte, donc un courriel direct.
  mailer.sendMail({
    to: email,
    subject: 'IMSOP — votre candidature a bien été reçue',
    text: `Bonjour ${fullName},\n\nNous avons bien reçu votre candidature. Le comité scientifique l'examinera et vous tiendrez informé(e) de sa décision par e-mail.\n\nL'équipe IMSOP`,
  }).catch((err) => console.error('accusé de réception candidature échoué', err))

  // Le comité scientifique n'a pas de compte : il reçoit le formulaire rempli
  // dans sa boîte, photo jointe, et décide de son côté. Sans adresse
  // configurée, rien ne part — et la coordination le verra dans les journaux.
  if (env.comite.emails.length === 0) {
    console.warn('[candidatures] COMITE_EMAILS non configuré : le comité ne recevra pas ce formulaire')
  }
  for (const destinataire of env.comite.emails) {
    mailer.sendMail({
      to: destinataire,
      subject: `IMSOP — candidature ${type === 'SPECIALISTE' ? 'spécialiste' : 'médecin traitant'} : ${fullName}`,
      text: formulaireEnTexte({
        type, fullName, email, phone, specialite, pays, ville, langues, numeroOrdre, presentation,
        etablissement: candidature.etablissement,
        typeStructure, nomClinique, telClinique, emailClinique, nomHopital, telHopital, emailHopital,
        cvJoint: Boolean(cvFichier),
      }),
      // Photo et CV joints : le comité lit tout dans son courriel, sans avoir
      // à se connecter à la plateforme.
      attachments: [
        { filename: `photo-${fichier}`, content: photoFichier.buffer, contentType: photoFichier.mimetype },
        ...(cvFichier
          ? [{ filename: `CV-${fullName.replace(/[^\p{L}\p{N}]+/gu, '-')}.pdf`, content: cvFichier.buffer, contentType: 'application/pdf' }]
          : []),
      ],
    }).catch((err) => console.error('envoi au comité échoué', err))
  }

  // La coordination est prévenue aussi : c'est elle qui appliquera la décision.
  const comite = await prisma.user.findMany({
    where: { role: { in: ['COORDINATEUR', 'ADMIN'] }, active: true },
    select: { id: true, email: true, fullName: true },
  })
  for (const membre of comite) {
    await notify(membre.id, membre.email, 'CANDIDATURE_RECUE', {
      name: membre.fullName,
      candidat: fullName,
      type: type === 'SPECIALISTE' ? 'spécialiste' : 'médecin traitant',
      specialite,
    })
  }

  res.status(201).json({ id: candidature.id, message: 'Candidature enregistrée' })
}

/**
 * Le bloc « lieu d'exercice » du courriel au comité. Rendu seulement quand il a
 * quelque chose à dire : un spécialiste international n'a pas ces champs.
 */
function blocStructure(c) {
  if (!c.typeStructure) return []
  const LIBELLES = { CLINIQUE: 'Clinique', HOPITAL: 'Hôpital', LES_DEUX: 'Clinique et hôpital' }
  const lignes = ['', `Lieu d'exercice : ${LIBELLES[c.typeStructure] || c.typeStructure}`]
  if (c.typeStructure !== 'HOPITAL') {
    lignes.push(`  Clinique : ${c.nomClinique || '—'}`)
    if (c.telClinique) lignes.push(`  Téléphone clinique : ${c.telClinique}`)
    if (c.emailClinique) lignes.push(`  E-mail clinique : ${c.emailClinique}`)
  }
  if (c.typeStructure !== 'CLINIQUE') {
    lignes.push(`  Hôpital : ${c.nomHopital || '—'}`)
    if (c.telHopital) lignes.push(`  Téléphone hôpital : ${c.telHopital}`)
    if (c.emailHopital) lignes.push(`  E-mail hôpital : ${c.emailHopital}`)
  }
  return lignes
}

/**
 * « Clinique du Littoral et Hôpital Laquintinie » : de quoi remplir le champ
 * établissement d'un seul tenant, lisible dans une fiche de profil.
 */
function resumeStructure({ typeStructure, nomClinique, nomHopital }) {
  const morceaux = []
  if (typeStructure !== 'HOPITAL' && nomClinique) morceaux.push(nomClinique)
  if (typeStructure !== 'CLINIQUE' && nomHopital) morceaux.push(nomHopital)
  return morceaux.join(' et ') || null
}

/** Le formulaire tel que le comité le lit dans son courriel. */
function formulaireEnTexte(c) {
  const ligne = (libelle, valeur) => (valeur ? `${libelle} : ${valeur}` : null)
  return [
    `Candidature ${c.type === 'SPECIALISTE' ? 'SPÉCIALISTE INTERNATIONAL' : 'MÉDECIN TRAITANT'}`,
    '',
    ligne('Nom', c.fullName),
    ligne('E-mail', c.email),
    ligne('Téléphone', c.phone),
    ligne('Spécialité', c.specialite),
    ligne('Établissement', c.etablissement),
    ligne('Pays', PAYS_CEMAC[String(c.pays || '').toLowerCase()]?.nom || c.pays),
    ligne('Ville de résidence', c.ville),
    ligne('Langues', c.langues),
    ligne("Numéro d'ordre", c.numeroOrdre),
    ...blocStructure(c),
    '',
    'Parcours et motivations :',
    c.presentation,
    '',
    c.cvJoint ? 'La photo et le CV sont joints à ce message.' : 'La photo est jointe à ce message. Aucun CV fourni.',
    '',
    "Pour donner suite, transmettez votre décision à la coordination médicale, qui l'appliquera depuis l'écran Candidatures de la plateforme.",
  ]
    .filter((l) => l !== null)
    .join('\n')
}

// --- Décision du comité, appliquée par la coordination ---------------------------

async function lister(req, res) {
  const { statut } = req.query
  const candidatures = await prisma.candidature.findMany({
    where: statut ? { statut } : {},
    orderBy: { createdAt: 'desc' },
  })
  res.json(candidatures)
}

async function detail(req, res) {
  const candidature = await prisma.candidature.findUnique({ where: { id: req.params.id } })
  if (!candidature) return res.status(404).json({ message: 'Candidature introuvable' })
  res.json(candidature)
}

// La photo est servie par l'API et non par une URL signée : elle s'affiche
// dans une balise <img>, qui ne porte ni jeton ni URL qui expire. Le nom
// aléatoire la rend indevinable, et la route reste derrière l'authentification.
async function photo(req, res) {
  const candidature = await prisma.candidature.findUnique({
    where: { id: req.params.id },
    select: { photoKey: true },
  })
  if (!candidature || !PHOTO_FILE_NAME.test(candidature.photoKey)) {
    return res.status(404).json({ message: 'Photo introuvable' })
  }

  let objet
  try {
    objet = await s3.getObjectStream(`${PHOTO_PREFIX}${candidature.photoKey}`)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ message: 'Photo introuvable' })
    }
    throw err
  }

  res.setHeader('Content-Type', objet.contentType || MIME_PAR_EXTENSION[candidature.photoKey.split('.').pop()])
  if (objet.contentLength) res.setHeader('Content-Length', objet.contentLength)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  objet.body.on('error', (err) => {
    console.error('flux photo candidature échoué', err)
    res.destroy(err)
  })
  objet.body.pipe(res)
}

// Le CV est un PDF : on rend une URL signée de courte durée plutôt qu'un flux,
// comme pour les justificatifs — le navigateur l'ouvre dans sa visionneuse.
async function cv(req, res) {
  const candidature = await prisma.candidature.findUnique({
    where: { id: req.params.id },
    select: { cvKey: true, fullName: true },
  })
  if (!candidature) return res.status(404).json({ message: 'Candidature introuvable' })
  if (!candidature.cvKey) return res.status(404).json({ message: 'Aucun CV fourni avec cette candidature' })

  const url = await s3.getSignedDownloadUrl(`${CV_PREFIX}${candidature.cvKey}`)

  await logAction({
    userId: req.userId,
    action: 'CANDIDATURE_CV_TELECHARGE',
    entityType: 'Candidature',
    entityId: req.params.id,
    ipAddress: req.ip,
  })

  res.json({ url })
}

/**
 * Écarte une candidature que le comité n'a pas retenue.
 *
 * Aucun courriel n'est envoyé : le comité décide et répond au candidat lui-même,
 * hors de la plateforme. L'écran de la coordination ne fait que refléter cette
 * décision pour que la file des candidatures à traiter finisse par se vider.
 *
 * La candidature est conservée, jamais supprimée : c'est la trace de ce qui a
 * été reçu, et l'adresse écartée peut recandidater plus tard.
 */
async function ecarter(req, res) {
  const candidature = await prisma.candidature.findUnique({ where: { id: req.params.id } })
  if (!candidature) return res.status(404).json({ message: 'Candidature introuvable' })
  if (candidature.statut === 'COMPTE_CREE') {
    return res.status(409).json({ message: 'Un compte a déjà été créé pour cette candidature' })
  }

  const ecartee = await prisma.candidature.update({
    where: { id: candidature.id },
    data: {
      statut: 'REFUSEE',
      motifRefus: req.body?.motif?.trim() || null,
      decideParId: req.userId,
      decideLe: new Date(),
    },
  })

  await logAction({
    userId: req.userId,
    action: 'CANDIDATURE_ECARTEE',
    entityType: 'Candidature',
    entityId: candidature.id,
    ipAddress: req.ip,
  })

  res.json(ecartee)
}

/**
 * Mot de passe initial du praticien recruté.
 *
 * base64url : lisible au téléphone, sans caractère qu'on puisse confondre avec
 * un séparateur dans un courriel. Il est destiné à être remplacé par son
 * titulaire depuis « Mon profil ».
 */
/**
 * « Pédiatrie » (second avis) vers « pediatrie » (annuaire de proximité).
 *
 * Les deux listes ne se recouvrent pas entièrement : l'anatomopathologie n'a
 * pas de sens dans un annuaire de proximité, et le dentaire n'en a pas pour un
 * second avis international. On ne reporte donc que ce qui existe des deux
 * côtés, et on laisse le champ vide sinon plutôt que d'inventer.
 */
function versSpecialiteLocale(nom) {
  const cle = String(nom || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z]+/g, '_')
    .replace(/^_|_$/g, '')

  // Quelques libellés ne tombent pas sur la clé attendue par simple
  // translittération.
  const EXCEPTIONS = {
    gynecologie_obstetrique: 'gynecologie',
    gastro_enterologie: 'gastroenterologie',
    medecine_interne: 'medecine_generale',
    chirurgie_generale: 'medecine_generale',
  }
  const candidate = EXCEPTIONS[cle] || cle
  return estSpecialiteLocale(candidate) ? candidate : null
}

function motDePasseInitial() {
  return crypto.randomBytes(11).toString('base64url').slice(0, 14)
}

async function creerCompte(req, res) {
  const candidature = await prisma.candidature.findUnique({ where: { id: req.params.id } })
  if (!candidature) return res.status(404).json({ message: 'Candidature introuvable' })
  // Le comité décide hors de la plateforme et transmet le candidat retenu à la
  // coordination : il n'y a pas d'étape d'acceptation à refaire ici. Seules une
  // candidature écartée ou déjà pourvue d'un compte sont refusées.
  if (candidature.statut === 'COMPTE_CREE') {
    return res.status(409).json({ message: 'Un compte a déjà été créé pour cette candidature' })
  }
  if (candidature.statut === 'REFUSEE') {
    return res.status(409).json({ message: 'Cette candidature a été écartée' })
  }

  const existant = await prisma.user.findUnique({ where: { email: candidature.email } })
  if (existant) return res.status(409).json({ message: 'Un compte existe déjà avec cette adresse e-mail' })

  const motDePasse = motDePasseInitial()
  const passwordHash = await bcrypt.hash(motDePasse, 12)
  const role = ROLES_PAR_TYPE[candidature.type]

  // La candidature a été validée par le comité : c'est cette validation qui
  // vaut habilitation. Faire renaître le compte EN_VERIFICATION obligerait la
  // coordination à vérifier deux fois la même personne.
  const profil = {
    specialite: candidature.specialite,
    etablissement: candidature.etablissement,
    pays: candidature.pays,
    verificationStatus: 'VALIDE',
    verifiedAt: new Date(),
    verifiedById: req.userId,
  }

  // Ce que le candidat a déjà renseigné n'a pas à être redemandé dans ses
  // réglages d'annuaire : la spécialité qu'il a déclarée y est reportée quand
  // elle correspond à une spécialité de proximité. Il lui reste à choisir son
  // quartier et à se rendre visible — le reste est prêt.
  const specialiteAnnuaire = versSpecialiteLocale(candidature.specialite)

  const user = await prisma.$transaction(async (tx) => {
    const cree = await tx.user.create({
      data: {
        email: candidature.email,
        passwordHash,
        fullName: candidature.fullName,
        phone: candidature.phone,
        role,
        twoFactorEnabled: true,
        emailVerified: true,
        ...(role === 'SPECIALISTE'
          ? { specialiste: { create: { ...profil, langues: candidature.langues, disponible: true } } }
          : {
              medecinLocal: {
                create: {
                  ...profil,
                  ville: candidature.ville,
                  numeroOrdre: candidature.numeroOrdre,
                  ...(specialiteAnnuaire ? { annuaireSpecialites: [specialiteAnnuaire] } : {}),
                },
              },
            }),
      },
      select: { ...safeUserSelect, specialiste: true, medecinLocal: true },
    })

    await tx.candidature.update({
      where: { id: candidature.id },
      data: { statut: 'COMPTE_CREE', compteUserId: cree.id, compteCreeLe: new Date() },
    })

    return cree
  })

  await logAction({
    userId: req.userId,
    action: 'COMPTE_CREE_DEPUIS_CANDIDATURE',
    entityType: 'User',
    entityId: user.id,
    metadata: { candidatureId: candidature.id, role },
    ipAddress: req.ip,
  })

  // L'envoi est attendu, pas lancé en arrière-plan : la coordination doit savoir
  // si le praticien a reçu ses identifiants. Un envoi perdu laissait un compte
  // inutilisable et un écran affirmant le contraire.
  const envoi = await envoyerIdentifiants({ user, motDePasse, role, auteurId: req.userId, ip: req.ip })

  res.status(201).json({ user, identifiantsEnvoyes: envoi.envoye })
}

/**
 * Envoie les identifiants au praticien et consigne le résultat.
 *
 * Le mot de passe n'est ni journalisé ni renvoyé à l'appelant : la coordination
 * crée le compte, elle n'a pas à connaître le mot de passe de quelqu'un d'autre.
 * Seul le fait de l'envoi est tracé — c'est ce qu'on a besoin de prouver le jour
 * où un praticien dit n'avoir rien reçu.
 */
async function envoyerIdentifiants({ user, motDePasse, role, auteurId, ip }) {
  const urlConnexion = `${env.publicUrl}/connexion/${role === 'SPECIALISTE' ? 'specialiste' : 'medecin'}`

  try {
    const resultat = await mailer.sendMail({
      to: user.email,
      subject: 'IMSOP — vos identifiants de connexion',
      text:
        `Bonjour ${user.fullName},\n\n` +
        `Votre candidature a été acceptée et votre compte est créé.\n\n` +
        `Adresse de connexion : ${urlConnexion}\n` +
        `Identifiant : ${user.email}\n` +
        `Mot de passe : ${motDePasse}\n\n` +
        `À chaque connexion, un code de vérification vous sera envoyé par e-mail.\n` +
        `Ces identifiants restent valables tant que votre compte est actif. Vous pouvez changer votre mot de passe depuis votre profil.\n\n` +
        `L'équipe IMSOP`,
    })

    await logAction({
      userId: auteurId,
      action: 'IDENTIFIANTS_ENVOYES',
      entityType: 'User',
      entityId: user.id,
      metadata: { destinataire: user.email, messageId: resultat?.messageId || null },
      ipAddress: ip,
    })
    return { envoye: true }
  } catch (err) {
    // Journalisé plutôt que propagé : le compte, lui, est bel et bien créé. Le
    // renvoi depuis l'écran Candidatures est la porte de sortie.
    console.error('envoi des identifiants échoué', err)
    await logAction({
      userId: auteurId,
      action: 'IDENTIFIANTS_ENVOI_ECHOUE',
      entityType: 'User',
      entityId: user.id,
      metadata: { destinataire: user.email, erreur: err.message },
      ipAddress: ip,
    })
    return { envoye: false }
  }
}

/**
 * Renvoie les identifiants d'un compte déjà créé, avec un nouveau mot de passe.
 *
 * Un courriel se perd : classé en indésirable, adresse mal saisie, boîte pleine.
 * Sans ce renvoi, le compte existe mais personne ne peut s'y connecter et la
 * seule issue passait par la base. Le mot de passe est régénéré plutôt que relu
 * — l'ancien n'existe nulle part en clair, et c'est voulu.
 */
async function renvoyerIdentifiants(req, res) {
  const candidature = await prisma.candidature.findUnique({ where: { id: req.params.id } })
  if (!candidature) return res.status(404).json({ message: 'Candidature introuvable' })
  if (candidature.statut !== 'COMPTE_CREE' || !candidature.compteUserId) {
    return res.status(409).json({ message: "Aucun compte n'a encore été créé pour cette candidature" })
  }

  const user = await prisma.user.findUnique({
    where: { id: candidature.compteUserId },
    select: { id: true, email: true, fullName: true, role: true, active: true },
  })
  if (!user) return res.status(404).json({ message: 'Compte introuvable' })
  if (!user.active) {
    return res.status(409).json({ message: 'Ce compte est suspendu : réactivez-le avant de renvoyer ses identifiants' })
  }

  const motDePasse = motDePasseInitial()
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(motDePasse, 12) },
  })

  // Les sessions ouvertes avec l'ancien mot de passe n'ont plus lieu d'être.
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const envoi = await envoyerIdentifiants({ user, motDePasse, role: user.role, auteurId: req.userId, ip: req.ip })
  if (!envoi.envoye) {
    return res.status(502).json({ message: "L'envoi a échoué. Vérifiez l'adresse du praticien, puis réessayez." })
  }

  res.json({ message: 'Identifiants renvoyés', email: user.email })
}

module.exports = { deposer, lister, detail, photo, cv, ecarter, creerCompte, renvoyerIdentifiants }
