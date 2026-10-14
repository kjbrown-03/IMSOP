const { prisma } = require('../lib/prisma')
const { putObject } = require('../lib/s3')
const { servirObjet } = require('../lib/servirFichier')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { safeUserSelect } = require('../lib/selectors')
const { v4: uuidv4 } = require('uuid')

// CDC §16 : « Avant activation d'un compte spécialiste, la plateforme doit
// permettre le dépôt et la vérification de : diplôme, licence ou autorisation
// d'exercer, numéro d'inscription professionnelle, pièce d'identité,
// établissement d'exercice, CV, références professionnelles. »
//
// Le cycle EN_VERIFICATION → VALIDE → SUSPENDU → EXPIRE → REVOQUE remplace le
// booléen `verified`, qui ne pouvait exprimer ni la suspension ni l'expiration.

const PROFILS = {
  SPECIALISTE: 'specialiste',
  MEDECIN_LOCAL: 'medecinLocal',
}

// Un praticien n'exerce sur la plateforme que tant que son habilitation est
// VALIDE : suspendue, expirée ou révoquée, il ne doit plus recevoir de dossier.
const STATUTS_ACTIFS = new Set(['VALIDE'])

function profilDe(user) {
  const cle = PROFILS[user.role]
  return cle ? user[cle] : null
}

async function chargerProfessionnel(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { specialiste: true, medecinLocal: true },
  })
}

async function majProfil(userId, role, data) {
  const cle = PROFILS[role]
  if (cle === 'specialiste') return prisma.specialiste.update({ where: { userId }, data })
  return prisma.medecinLocal.update({ where: { userId }, data })
}

async function uploadJustificatif(req, res) {
  if (!req.file) return res.status(400).json({ message: 'Aucun fichier reçu' })

  const key = `professionnels/${req.userId}/${uuidv4()}-${req.file.originalname}`
  await putObject(key, req.file.buffer, req.file.mimetype)

  const document = await prisma.professionalDocument.create({
    data: {
      userId: req.userId,
      type: req.body.type,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storageKey: key,
    },
  })

  await logAction({
    userId: req.userId,
    action: 'JUSTIFICATIF_DEPOSE',
    entityType: 'ProfessionalDocument',
    entityId: document.id,
    metadata: { type: document.type, filename: document.filename },
    ipAddress: req.ip,
  })

  const { storageKey: _omit, ...safe } = document
  res.status(201).json(safe)
}

async function listerMesJustificatifs(req, res) {
  const documents = await prisma.professionalDocument.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
  })

  // Les pieces du dossier de candidature, jointes a la liste.
  //
  // Elles n'etaient visibles que de la coordination : le praticien ne voyait
  // pas le CV qu'il avait lui-meme envoye, et pouvait croire qu'il ne l'avait
  // jamais transmis — ou le redeposer pour rien.
  //
  // Elles sont marquees `origine: 'CANDIDATURE'` et NON SUPPRIMABLES : le
  // dossier sur lequel le comite s'est prononce doit rester tel quel. Ce sont
  // des pieces d'archive, pas des documents de travail.
  const candidature = await prisma.candidature.findFirst({
    where: { compteUserId: req.userId },
    select: { id: true, cvKey: true, photoKey: true, createdAt: true },
  })

  const piecesCandidature = []
  if (candidature?.cvKey) {
    piecesCandidature.push({
      id: `candidature-cv-${candidature.id}`,
      origine: 'CANDIDATURE',
      type: 'CV',
      filename: 'CV déposé avec votre candidature',
      mimeType: 'application/pdf',
      sizeBytes: null,
      createdAt: candidature.createdAt,
      url: '/api/professionnels/me/candidature/cv',
    })
  }
  if (candidature?.photoKey) {
    piecesCandidature.push({
      id: `candidature-photo-${candidature.id}`,
      origine: 'CANDIDATURE',
      type: 'PHOTO',
      filename: 'Photo déposée avec votre candidature',
      mimeType: 'image/jpeg',
      sizeBytes: null,
      createdAt: candidature.createdAt,
      url: '/api/professionnels/me/candidature/photo',
    })
  }

  const user = await chargerProfessionnel(req.userId)
  const profil = profilDe(user)

  res.json({
    // Les pieces de candidature d'abord : c'est le dossier d'origine, et le
    // praticien les cherche en premier.
    documents: [...piecesCandidature, ...documents],
    habilitation: {
      status: profil?.verificationStatus ?? null,
      motif: profil?.verificationMotif ?? null,
      verifiedAt: profil?.verifiedAt ?? null,
      expireLe: profil?.habilitationExpireLe ?? null,
    },
  })
}

// Le coordinateur voit qui attend une décision, avec le compte de pièces déjà
// déposées : un dossier vide ne se traite pas comme un dossier complet.
async function listerDemandes(req, res) {
  const status = req.query.status || 'EN_VERIFICATION'

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { role: 'SPECIALISTE', specialiste: { verificationStatus: status } },
        { role: 'MEDECIN_LOCAL', medecinLocal: { verificationStatus: status } },
      ],
    },
    select: {
      ...safeUserSelect,
      createdAt: true,
      specialiste: true,
      medecinLocal: true,
      _count: { select: { professionalDocuments: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  res.json({
    items: users.map((u) => {
      const profil = u.role === 'SPECIALISTE' ? u.specialiste : u.medecinLocal
      return {
        userId: u.id,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        specialite: profil?.specialite ?? null,
        etablissement: profil?.etablissement ?? null,
        pays: profil?.pays ?? null,
        numeroOrdre: profil?.numeroOrdre ?? null,
        verificationStatus: profil?.verificationStatus ?? null,
        verificationMotif: profil?.verificationMotif ?? null,
        habilitationExpireLe: profil?.habilitationExpireLe ?? null,
        nombreJustificatifs: u._count.professionalDocuments,
        inscritLe: u.createdAt,
      }
    }),
  })
}

async function listerJustificatifsDe(req, res) {
  const user = await chargerProfessionnel(req.params.userId)
  if (!user || !PROFILS[user.role]) {
    return res.status(404).json({ message: 'Professionnel introuvable' })
  }

  const documents = await prisma.professionalDocument.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
  })

  await logAction({
    userId: req.userId,
    action: 'JUSTIFICATIFS_CONSULTES',
    entityType: 'User',
    entityId: user.id,
    ipAddress: req.ip,
  })

  const profil = profilDe(user)
  res.json({
    professionnel: {
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      specialite: profil?.specialite ?? null,
      etablissement: profil?.etablissement ?? null,
      pays: profil?.pays ?? null,
      numeroOrdre: profil?.numeroOrdre ?? null,
      verificationStatus: profil?.verificationStatus ?? null,
      verificationMotif: profil?.verificationMotif ?? null,
      habilitationExpireLe: profil?.habilitationExpireLe ?? null,
    },
    documents,
  })
}

// Le propriétaire relit ses propres pièces ; le coordinateur les examine. Un
// justificatif reste invisible à tout autre compte.
async function telechargerJustificatif(req, res) {
  const document = await prisma.professionalDocument.findUnique({ where: { id: req.params.id } })
  if (!document) return res.status(404).json({ message: 'Document introuvable' })

  const estProprietaire = document.userId === req.userId
  const estControleur = ['COORDINATEUR', 'ADMIN'].includes(req.userRole)
  if (!estProprietaire && !estControleur) {
    return res.status(403).json({ message: "Vous n'avez pas accès à ce justificatif" })
  }

  await logAction({
    userId: req.userId,
    action: 'JUSTIFICATIF_TELECHARGE',
    entityType: 'ProfessionalDocument',
    entityId: document.id,
    metadata: { type: document.type, proprietaire: document.userId },
    ipAddress: req.ip,
  })

  await servirObjet(res, document.storageKey, {
    filename: document.filename,
    contentType: document.mimeType,
  })
}

// La décision d'habilitation. Un refus, une suspension ou une révocation exige
// un motif : le praticien doit savoir ce qu'on lui reproche (CDC §16).
async function statuerHabilitation(req, res) {
  const user = await chargerProfessionnel(req.params.userId)
  if (!user || !PROFILS[user.role]) {
    return res.status(404).json({ message: 'Professionnel introuvable' })
  }

  const { status, motif, habilitationExpireLe } = req.body
  if (status !== 'VALIDE' && !motif) {
    return res.status(400).json({ message: 'Un motif est requis pour refuser, suspendre ou révoquer une habilitation' })
  }

  const profilAvant = profilDe(user)

  await majProfil(user.id, user.role, {
    verificationStatus: status,
    verificationMotif: status === 'VALIDE' ? null : motif,
    verifiedAt: status === 'VALIDE' ? new Date() : profilAvant?.verifiedAt ?? null,
    verifiedById: req.userId,
    habilitationExpireLe: habilitationExpireLe ? new Date(habilitationExpireLe) : profilAvant?.habilitationExpireLe ?? null,
  })

  // Un praticien qui perd son habilitation ne doit plus apparaître comme
  // disponible dans le moteur d'affectation (CDC §14).
  if (user.role === 'SPECIALISTE' && !STATUTS_ACTIFS.has(status)) {
    await prisma.specialiste.update({ where: { userId: user.id }, data: { disponible: false } })
  }

  await logAction({
    userId: req.userId,
    action: 'HABILITATION_STATUEE',
    entityType: 'User',
    entityId: user.id,
    metadata: { de: profilAvant?.verificationStatus, vers: status, motif },
    ipAddress: req.ip,
  })

  await notify(user.id, user.email, 'HABILITATION_STATUT', {
    name: user.fullName,
    statut: status,
    motif: status === 'VALIDE' ? null : motif,
  })

  const apres = await chargerProfessionnel(user.id)
  const profil = profilDe(apres)
  res.json({
    userId: user.id,
    verificationStatus: profil.verificationStatus,
    verificationMotif: profil.verificationMotif,
    verifiedAt: profil.verifiedAt,
    habilitationExpireLe: profil.habilitationExpireLe,
  })
}

/**
 * Sert une piece du dossier de candidature a son AUTEUR.
 *
 * La route des candidatures est reservee a la coordination, ce qui est juste
 * pour examiner un dossier — mais le praticien doit pouvoir relire ce qu'il a
 * lui-meme envoye.
 *
 * Celle-ci ne lit AUCUN identifiant fourni par l'appelant : elle part de
 * `req.userId` et retrouve la candidature rattachee a ce compte. Il est donc
 * impossible d'y demander celle d'un autre, meme en connaissant son
 * identifiant.
 */
function servirPieceCandidature(champ, prefixe, options) {
  return async (req, res) => {
    const candidature = await prisma.candidature.findFirst({
      where: { compteUserId: req.userId },
      select: { [champ]: true },
    })
    const cle = candidature?.[champ]
    if (!cle) return res.status(404).json({ message: 'Aucune pièce de ce type dans votre candidature' })
    return servirObjet(res, `${prefixe}${cle}`, options)
  }
}

const monCvCandidature = servirPieceCandidature('cvKey', 'candidatures/cv/', {
  filename: 'cv-candidature.pdf',
  contentType: 'application/pdf',
})

const maPhotoCandidature = servirPieceCandidature('photoKey', 'candidatures/photos/', {
  filename: 'photo-candidature',
})

module.exports = {
  monCvCandidature,
  maPhotoCandidature,
  uploadJustificatif,
  listerMesJustificatifs,
  listerDemandes,
  listerJustificatifsDe,
  telechargerJustificatif,
  statuerHabilitation,
  STATUTS_ACTIFS,
}
