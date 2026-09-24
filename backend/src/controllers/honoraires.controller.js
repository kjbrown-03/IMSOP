const { prisma } = require('../lib/prisma')
const { safeUserSelect } = require('../lib/selectors')
const { reverserParFapshi, marquerReverse } = require('../services/honorairesService')

const inclusions = {
  specialiste: { select: { id: true, pays: true, specialite: true, user: { select: safeUserSelect } } },
  dossier: { select: { id: true, reference: true, specialiteRequise: true } },
}

// Relevé, du plus ancien au plus récent : ce qui attend depuis longtemps passe
// en premier.
async function lister(req, res) {
  const { statut } = req.query
  const honoraires = await prisma.honoraire.findMany({
    where: statut ? { statut } : {},
    orderBy: { createdAt: 'asc' },
    include: inclusions,
  })
  res.json(honoraires)
}

// Totaux à reverser par spécialiste et par devise : c'est ce que le comptable
// regarde avant de faire ses virements.
async function synthese(req, res) {
  const enAttente = await prisma.honoraire.findMany({
    where: { statut: { in: ['A_REVERSER', 'ECHOUE'] } },
    include: inclusions,
  })

  const parSpecialiste = new Map()
  for (const h of enAttente) {
    const cle = h.specialisteId
    if (!parSpecialiste.has(cle)) {
      parSpecialiste.set(cle, {
        specialiste: h.specialiste,
        canal: h.canal,
        devise: h.deviseNet,
        dossiers: 0,
        total: 0,
      })
    }
    const ligne = parSpecialiste.get(cle)
    ligne.dossiers++
    ligne.total = Math.round((ligne.total + Number(h.montantNetDevise)) * 100) / 100
  }

  res.json([...parSpecialiste.values()].sort((a, b) => b.total - a.total))
}

async function reverser(req, res) {
  const honoraire = await prisma.honoraire.findUnique({ where: { id: req.params.id } })
  if (!honoraire) return res.status(404).json({ message: 'Honoraire introuvable' })
  if (honoraire.statut === 'REVERSE') return res.status(409).json({ message: 'Déjà reversé' })

  try {
    if (honoraire.canal === 'FAPSHI' && !req.body.reference) {
      // Reversement automatique en Mobile Money.
      const resultat = await reverserParFapshi(honoraire, { userId: req.userId })
      return res.json(resultat)
    }
    // Virement fait hors plateforme : on enregistre sa référence.
    if (!req.body.reference) {
      return res.status(400).json({ message: 'La référence du virement est requise' })
    }
    const resultat = await marquerReverse(honoraire, { userId: req.userId, reference: req.body.reference })
    res.json(resultat)
  } catch (err) {
    res.status(502).json({ message: err.message })
  }
}

module.exports = { lister, synthese, reverser }
