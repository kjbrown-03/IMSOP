const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')

async function listSpecialistes(req, res) {
  const { specialite, pays, disponible, page, pageSize } = req.query

  const where = {}
  if (specialite) where.specialite = { contains: specialite, mode: 'insensitive' }
  if (pays) where.pays = { contains: pays, mode: 'insensitive' }
  if (disponible !== undefined) where.disponible = disponible === 'true'

  const [specialistes, total] = await Promise.all([
    prisma.specialiste.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.specialiste.count({ where }),
  ])

  res.json({ items: specialistes, total, page, pageSize })
}

async function getRecommandations(req, res) {
  const dossier = await prisma.dossier.findUnique({ where: { id: req.params.dossierId } })
  if (!dossier) return res.status(404).json({ message: 'Dossier introuvable' })

  const specialistes = await prisma.specialiste.findMany({
    where: { specialite: { contains: dossier.specialiteRequise, mode: 'insensitive' }, verificationStatus: 'VALIDE', disponible: true },
    include: { user: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    take: 10,
  })

  res.json(specialistes)
}

async function updateMyAvailability(req, res) {
  const { disponible } = req.body

  const specialiste = await prisma.specialiste.findUnique({ where: { userId: req.userId } })
  if (!specialiste) return res.status(404).json({ message: 'Profil spécialiste introuvable' })

  // Se retirer est toujours permis ; se déclarer disponible suppose une
  // habilitation active (CDC §16). Sans ce garde-fou, un praticien suspendu
  // pourrait se remettre lui-même dans le moteur d'affectation.
  if (disponible && specialiste.verificationStatus !== 'VALIDE') {
    return res.status(403).json({
      message: "Votre habilitation n'est pas active : vous ne pouvez pas vous déclarer disponible.",
    })
  }

  const updated = await prisma.specialiste.update({
    where: { userId: req.userId },
    data: { disponible },
  })

  await logAction({
    userId: req.userId,
    action: 'SPECIALISTE_DISPONIBILITE',
    entityType: 'Specialiste',
    entityId: updated.id,
    metadata: { disponible: updated.disponible },
    ipAddress: req.ip,
  })

  res.json({ disponible: updated.disponible })
}

module.exports = { listSpecialistes, getRecommandations, updateMyAvailability }
