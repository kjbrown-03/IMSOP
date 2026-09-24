const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')

/**
 * Liste des spécialités proposées dans les formulaires.
 *
 * Lecture publique : le formulaire de candidature en a besoin et personne n'est
 * connecté à ce moment-là. Écriture réservée à la coordination — c'est elle qui
 * anime le réseau, c'est à elle de décider quelles spécialités recruter.
 */

// --- Lecture publique ---------------------------------------------------------

async function lister(req, res) {
  const { cible, toutes } = req.query

  const where = {}
  // Par défaut on ne rend que les spécialités actives : une spécialité retirée
  // ne doit plus être proposée, même si des praticiens la portent encore.
  if (toutes !== 'true') where.actif = true
  if (cible === 'SPECIALISTE') where.pourSpecialiste = true
  if (cible === 'MEDECIN_LOCAL') where.pourMedecin = true

  const specialites = await prisma.specialite.findMany({ where, orderBy: { nom: 'asc' } })
  res.json(specialites)
}

// --- Administration par la coordination ---------------------------------------

async function creer(req, res) {
  const { nom, pourSpecialiste = true, pourMedecin = false } = req.body

  const existante = await prisma.specialite.findUnique({ where: { nom } })
  if (existante) {
    // Réactiver plutôt que refuser : rajouter une spécialité désactivée est
    // l'intention la plus probable, et un doublon serait impossible à créer.
    if (!existante.actif) {
      const reactivee = await prisma.specialite.update({
        where: { id: existante.id },
        data: { actif: true, pourSpecialiste, pourMedecin },
      })
      return res.status(200).json(reactivee)
    }
    return res.status(409).json({ message: 'Cette spécialité existe déjà' })
  }

  const specialite = await prisma.specialite.create({
    data: { nom, pourSpecialiste, pourMedecin, creeParId: req.userId },
  })

  await logAction({
    userId: req.userId,
    action: 'SPECIALITE_CREEE',
    entityType: 'Specialite',
    entityId: specialite.id,
    metadata: { nom },
    ipAddress: req.ip,
  })

  res.status(201).json(specialite)
}

async function modifier(req, res) {
  const specialite = await prisma.specialite.findUnique({ where: { id: req.params.id } })
  if (!specialite) return res.status(404).json({ message: 'Spécialité introuvable' })

  const { nom, pourSpecialiste, pourMedecin, actif } = req.body
  const data = {}
  if (nom !== undefined) data.nom = nom
  if (pourSpecialiste !== undefined) data.pourSpecialiste = pourSpecialiste
  if (pourMedecin !== undefined) data.pourMedecin = pourMedecin
  if (actif !== undefined) data.actif = actif

  const misAJour = await prisma.specialite.update({ where: { id: specialite.id }, data })

  await logAction({
    userId: req.userId,
    action: 'SPECIALITE_MODIFIEE',
    entityType: 'Specialite',
    entityId: specialite.id,
    metadata: data,
    ipAddress: req.ip,
  })

  res.json(misAJour)
}

module.exports = { lister, creer, modifier }
