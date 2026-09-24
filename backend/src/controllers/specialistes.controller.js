const { prisma } = require('../lib/prisma')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
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

// Mots vides francais : sans ce filtre, « le », « des » ou « une » feraient
// remonter n'importe quel profil dont la biographie est un peu bavarde.
const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'au', 'aux',
  'en', 'sur', 'pour', 'par', 'avec', 'sans', 'dans', 'chez', 'que', 'qui', 'est',
  'son', 'sa', 'ses', 'ce', 'cette', 'plus', 'depuis', 'ans', 'patient', 'patiente',
])

function motsSignificatifs(texte) {
  return (texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((mot) => mot.length > 3 && !MOTS_VIDES.has(mot))
}

// Score volontairement simple et decomposable : le coordinateur voit sur quoi
// repose la proposition et peut la contester. Une boite noire serait ici un
// probleme, la decision finale d'affectation restant humaine.
function scoreSpecialiste(specialiste, contexte) {
  const criteres = []
  let score = 0

  const specialiteDossier = (contexte.specialiteRequise || '').toLowerCase()
  const specialiteExpert = (specialiste.specialite || '').toLowerCase()
  if (specialiteExpert === specialiteDossier) {
    score += 50
    criteres.push({ critere: 'specialite', points: 50, detail: 'Specialite exactement correspondante' })
  } else if (specialiteExpert.includes(specialiteDossier) || specialiteDossier.includes(specialiteExpert)) {
    score += 30
    criteres.push({ critere: 'specialite', points: 30, detail: 'Specialite proche' })
  }

  // Recoupement entre le cas decrit et l'expertise declaree par l'expert.
  const profil = new Set(motsSignificatifs(`${specialiste.bio || ''} ${specialiste.specialite || ''}`))
  const communs = [...new Set(contexte.motsDuCas)].filter((mot) => profil.has(mot))
  if (communs.length) {
    const points = Math.min(25, communs.length * 8)
    score += points
    criteres.push({ critere: 'expertise', points, detail: `Termes en commun : ${communs.slice(0, 4).join(', ')}` })
  }

  // Charge de travail : a competence egale, on propose celui qui pourra
  // reellement s'en occuper vite.
  const enCours = specialiste._count?.dossiers ?? 0
  const pointsCharge = Math.max(0, 20 - enCours * 4)
  score += pointsCharge
  criteres.push({ critere: 'charge', points: pointsCharge, detail: `${enCours} dossier(s) en cours` })

  if (contexte.pays && specialiste.pays && specialiste.pays.toLowerCase() === contexte.pays.toLowerCase()) {
    score += 5
    criteres.push({ critere: 'pays', points: 5, detail: 'Meme pays que le demandeur' })
  }

  return { score, criteres }
}

async function getRecommandations(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  // Un expert qui s'est récusé coche toujours les mêmes critères : sans cette
  // exclusion, le score le replacerait en tête et le coordinateur se verrait
  // reproposer celui qui vient de se retirer.
  const recusations = await prisma.recusationSpecialiste.findMany({
    where: { dossierId: dossier.id },
    select: { specialisteId: true },
  })
  const recuses = recusations.map((r) => r.specialisteId)

  const specialistes = await prisma.specialiste.findMany({
    where: {
      verificationStatus: 'VALIDE',
      disponible: true,
      // `notIn: []` n'a pas de sens en SQL : on n'ajoute la clause que s'il y a
      // effectivement quelqu'un à écarter.
      ...(recuses.length ? { id: { notIn: recuses } } : {}),
    },
    include: {
      user: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      // Seuls les dossiers reellement en cours comptent dans la charge.
      _count: { select: { dossiers: { where: { status: { notIn: ['CLOTURE', 'ANNULE', 'REFUSE'] } } } } },
    },
  })

  const contexte = {
    specialiteRequise: dossier.specialiteRequise,
    motsDuCas: motsSignificatifs(`${dossier.motif} ${dossier.symptomes || ''} ${dossier.questionMedecinLocal || ''}`),
    pays: dossier.demandeurMedecin?.pays ?? dossier.patient?.country ?? null,
  }

  const classes = specialistes
    .map((specialiste) => {
      const { score, criteres } = scoreSpecialiste(specialiste, contexte)
      return { ...specialiste, score, criteres }
    })
    // En dessous de la correspondance de specialite, la proposition n'a pas de
    // sens : mieux vaut ne rien proposer que d'orienter vers le mauvais expert.
    .filter((s) => s.criteres.some((c) => c.critere === 'specialite'))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  res.json(classes)
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
