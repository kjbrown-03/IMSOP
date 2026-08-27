const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')

const ROLES_AUTORISES = new Set(['PATIENT', 'MEDECIN_LOCAL'])

// Patients and médecins traitants are the only roles this form is offered
// to on the frontend, but the API enforces it too - a specialist's account
// posting a "testimonial" about the platform isn't the same kind of signal.
async function creerTemoignage(req, res) {
  if (!ROLES_AUTORISES.has(req.userRole)) {
    return res.status(403).json({ message: 'Cette fonctionnalité est réservée aux patients et aux médecins traitants' })
  }

  const { texte, note } = req.body
  const temoignage = await prisma.temoignage.create({
    data: { userId: req.userId, roleAuteur: req.userRole, texte, note },
  })

  await logAction({
    userId: req.userId,
    action: 'TEMOIGNAGE_SOUMIS',
    entityType: 'Temoignage',
    entityId: temoignage.id,
    ipAddress: req.ip,
  })

  res.status(201).json(temoignage)
}

// No auth, no moderation status leak: the public homepage only ever sees
// what an admin has explicitly approved.
async function listerTemoignagesPublics(req, res) {
  const temoignages = await prisma.temoignage.findMany({
    where: { statut: 'PUBLIE' },
    orderBy: { modereLe: 'desc' },
    take: 20,
    select: {
      id: true,
      texte: true,
      note: true,
      roleAuteur: true,
      modereLe: true,
      user: { select: { fullName: true } },
    },
  })
  res.json(temoignages)
}

async function listerTemoignagesAdmin(req, res) {
  const statut = req.query.statut || 'EN_ATTENTE'
  const temoignages = await prisma.temoignage.findMany({
    where: { statut },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, fullName: true, email: true, role: true } },
      moderateur: { select: { id: true, fullName: true } },
    },
  })
  res.json(temoignages)
}

// A rejection needs a reason on file even though it is never shown to the
// author automatically - if they ask why, the coordination team should be
// able to answer without having to guess after the fact.
async function modererTemoignage(req, res) {
  const { statut, motifRejet } = req.body
  if (statut === 'REJETE' && !motifRejet) {
    return res.status(400).json({ message: 'Un motif est requis pour rejeter un témoignage' })
  }

  const existant = await prisma.temoignage.findUnique({ where: { id: req.params.id } })
  if (!existant) return res.status(404).json({ message: 'Témoignage introuvable' })

  const updated = await prisma.temoignage.update({
    where: { id: req.params.id },
    data: {
      statut,
      motifRejet: statut === 'REJETE' ? motifRejet : null,
      moderePar: req.userId,
      modereLe: new Date(),
    },
  })

  await logAction({
    userId: req.userId,
    action: statut === 'PUBLIE' ? 'TEMOIGNAGE_PUBLIE' : 'TEMOIGNAGE_REJETE',
    entityType: 'Temoignage',
    entityId: updated.id,
    metadata: { motifRejet: motifRejet || null },
    ipAddress: req.ip,
  })

  res.json(updated)
}

module.exports = { creerTemoignage, listerTemoignagesPublics, listerTemoignagesAdmin, modererTemoignage }
