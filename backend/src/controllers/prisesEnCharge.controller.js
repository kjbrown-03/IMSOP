const { v4: uuidv4 } = require('uuid')
const { prisma } = require('../lib/prisma')
// Le module, pas la fonction : les tests le substituent.
const s3 = require('../lib/s3')
const { servirObjet } = require('../lib/servirFichier')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')

// Ce que soigne un tradipraticien décide des patients que l'annuaire lui
// envoie, des inconnus qui paient pour être mis en relation. Il ne l'écrit donc
// pas lui-même : il le demande, pièces à l'appui, et la coordination tranche.
// Les spécialités n'atteignent sa fiche qu'à l'acceptation.

const SELECT_PIECE = { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true }

async function profilTradipraticien(req, res) {
  const medecin = await prisma.medecinLocal.findUnique({
    where: { userId: req.userId },
    select: { id: true, annuaireSpecialites: true },
  })
  if (!medecin) res.status(404).json({ message: 'Profil tradipraticien introuvable' })
  return medecin
}

async function creer(req, res) {
  const medecin = await profilTradipraticien(req, res)
  if (!medecin) return

  const fichiers = req.files || []
  if (fichiers.length === 0) {
    return res.status(400).json({ message: 'Joignez au moins un justificatif à votre demande' })
  }

  // On ne redemande pas ce qu'on a déjà : la coordination n'aurait rien à juger.
  const nouvelles = [...new Set(req.body.specialites)].filter((s) => !medecin.annuaireSpecialites.includes(s))
  if (nouvelles.length === 0) {
    return res.status(400).json({ message: 'Vous prenez déjà en charge tout ce que vous demandez' })
  }

  // Une demande à la fois : deux demandes croisées laisseraient la
  // coordination juger l'une sans voir l'autre.
  const enCours = await prisma.demandePriseEnCharge.count({
    where: { medecinLocalId: medecin.id, statut: 'EN_ATTENTE' },
  })
  if (enCours > 0) {
    return res.status(409).json({ message: 'Une demande est déjà en cours d’examen. Attendez la réponse de la coordination.' })
  }

  // Les fichiers d'abord : une demande sans ses pièces ne doit jamais exister,
  // la coordination la refuserait faute de preuve.
  const pieces = []
  for (const f of fichiers) {
    const storageKey = `prises-en-charge/${medecin.id}/${uuidv4()}-${f.originalname}`
    await s3.putObject(storageKey, f.buffer, f.mimetype)
    pieces.push({ filename: f.originalname, mimeType: f.mimetype, sizeBytes: f.size, storageKey })
  }

  const demande = await prisma.demandePriseEnCharge.create({
    data: {
      medecinLocalId: medecin.id,
      specialites: nouvelles,
      motif: req.body.motif,
      pieces: { create: pieces },
    },
    include: { pieces: { select: SELECT_PIECE } },
  })

  await logAction({
    userId: req.userId,
    action: 'PRISE_EN_CHARGE_DEMANDEE',
    entityType: 'DemandePriseEnCharge',
    entityId: demande.id,
    metadata: { specialites: nouvelles, pieces: pieces.length },
    ipAddress: req.ip,
  })

  // Toute la coordination est prévenue : il n'y a pas d'affectation, le premier
  // disponible traite.
  const coordinateurs = await prisma.user.findMany({
    where: { role: 'COORDINATEUR', active: true },
    select: { id: true, email: true, fullName: true },
  })
  const praticien = await prisma.user.findUnique({ where: { id: req.userId }, select: { fullName: true } })
  for (const c of coordinateurs) {
    notify(c.id, c.email, 'PRISE_EN_CHARGE_DEMANDEE', { name: c.fullName, praticien: praticien?.fullName || '' })
      .catch((err) => console.error('notification de demande de prise en charge', err))
  }

  res.status(201).json(demande)
}

async function mesDemandes(req, res) {
  const medecin = await profilTradipraticien(req, res)
  if (!medecin) return
  const demandes = await prisma.demandePriseEnCharge.findMany({
    where: { medecinLocalId: medecin.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true, specialites: true, motif: true, statut: true, motifRefus: true, traiteLe: true, createdAt: true,
      pieces: { select: SELECT_PIECE },
    },
  })
  res.json(demandes)
}

async function lister(req, res) {
  const statut = req.query.statut || 'EN_ATTENTE'
  const demandes = await prisma.demandePriseEnCharge.findMany({
    where: { statut },
    // Les plus anciennes d'abord tant qu'elles attendent : premier arrivé,
    // premier servi. Les plus récentes d'abord dans l'historique.
    orderBy: { createdAt: statut === 'EN_ATTENTE' ? 'asc' : 'desc' },
    take: 100,
    include: {
      pieces: { select: SELECT_PIECE },
      medecinLocal: {
        select: {
          id: true, annuaireSpecialites: true, pays: true, ville: true, region: true, departement: true, arrondissement: true, quartier: true,
          user: { select: { id: true, fullName: true, email: true, phone: true } },
        },
      },
    },
  })
  res.json(demandes)
}

async function decider(req, res) {
  const { decision, motifRefus } = req.body
  const demande = await prisma.demandePriseEnCharge.findUnique({
    where: { id: req.params.id },
    include: { medecinLocal: { select: { id: true, user: { select: { id: true, email: true, fullName: true } } } } },
  })
  if (!demande) return res.status(404).json({ message: 'Demande introuvable' })

  // Écriture sous condition, comme les paiements : deux coordinateurs qui
  // cliquent en même temps ne doivent pas tous deux statuer, ni un refus
  // arrivé second défaire une acceptation.
  const resultat = await prisma.$transaction(async (tx) => {
    const { count } = await tx.demandePriseEnCharge.updateMany({
      where: { id: demande.id, statut: 'EN_ATTENTE' },
      data: {
        statut: decision,
        motifRefus: decision === 'REFUSEE' ? motifRefus : null,
        traiteParId: req.userId,
        traiteLe: new Date(),
      },
    })
    if (count === 0) return null
    if (decision === 'ACCEPTEE') {
      const m = await tx.medecinLocal.findUnique({ where: { id: demande.medecinLocalId }, select: { annuaireSpecialites: true } })
      await tx.medecinLocal.update({
        where: { id: demande.medecinLocalId },
        data: { annuaireSpecialites: [...new Set([...m.annuaireSpecialites, ...demande.specialites])] },
      })
    }
    return true
  })
  if (!resultat) return res.status(409).json({ message: 'Cette demande a déjà été traitée' })

  await logAction({
    userId: req.userId,
    action: decision === 'ACCEPTEE' ? 'PRISE_EN_CHARGE_ACCEPTEE' : 'PRISE_EN_CHARGE_REFUSEE',
    entityType: 'DemandePriseEnCharge',
    entityId: demande.id,
    metadata: { specialites: demande.specialites, praticien: demande.medecinLocal.user.id },
    ipAddress: req.ip,
  })

  const praticien = demande.medecinLocal.user
  notify(praticien.id, praticien.email, 'PRISE_EN_CHARGE_TRAITEE', {
    name: praticien.fullName,
    acceptee: decision === 'ACCEPTEE',
    reason: decision === 'REFUSEE' ? motifRefus : undefined,
  }).catch((err) => console.error('notification de décision de prise en charge', err))

  const maj = await prisma.demandePriseEnCharge.findUnique({ where: { id: demande.id }, include: { pieces: { select: SELECT_PIECE } } })
  res.json(maj)
}

async function telechargerPiece(req, res) {
  const piece = await prisma.pieceDemandePriseEnCharge.findUnique({
    where: { id: req.params.id },
    include: { demande: { select: { medecinLocal: { select: { userId: true } } } } },
  })
  if (!piece) return res.status(404).json({ message: 'Pièce introuvable' })

  const estProprietaire = piece.demande.medecinLocal.userId === req.userId
  const estControleur = ['COORDINATEUR', 'ADMIN'].includes(req.userRole)
  // 404 plutôt que 403 : on ne confirme pas qu'une pièce d'un autre existe.
  if (!estProprietaire && !estControleur) return res.status(404).json({ message: 'Pièce introuvable' })

  await logAction({
    userId: req.userId,
    action: 'PRISE_EN_CHARGE_PIECE_CONSULTEE',
    entityType: 'PieceDemandePriseEnCharge',
    entityId: piece.id,
    ipAddress: req.ip,
  })
  await servirObjet(res, piece.storageKey, { filename: piece.filename, contentType: piece.mimeType })
}

module.exports = { creer, mesDemandes, lister, decider, telechargerPiece }
