const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')

// Le registre est le carnet du tradipraticien, pas un dossier de la
// plateforme : chaque requete part du compte connecte et filtre sur lui. Une
// fiche d'un autre praticien repond 404, pas 403 — on ne confirme pas qu'elle
// existe.
// Le role TRADIPRATICIEN est exige par la route ; il reste a retrouver le
// profil, qui porte l'identifiant auquel les fiches sont rattachees.
async function praticienTraditionnel(req, res) {
  const medecin = await prisma.medecinLocal.findUnique({ where: { userId: req.userId }, select: { id: true } })
  if (!medecin) {
    res.status(404).json({ message: 'Profil tradipraticien introuvable' })
    return null
  }
  return medecin
}

async function chargerFiche(req, res, medecin) {
  const fiche = await prisma.patientRegistre.findFirst({
    where: { id: req.params.id, medecinLocalId: medecin.id },
  })
  if (!fiche) res.status(404).json({ message: 'Patient introuvable' })
  return fiche
}

// Le journal d'audit ne recoit jamais le nom ni le diagnostic : il est lu par
// l'administration, qui n'a pas a connaitre les patients d'un praticien.
const journal = (req, action, fiche) =>
  logAction({ userId: req.userId, action, entityType: 'PatientRegistre', entityId: fiche.id, ipAddress: req.ip })

async function lister(req, res) {
  const medecin = await praticienTraditionnel(req, res)
  if (!medecin) return
  const { page, pageSize, q } = req.query
  const where = {
    medecinLocalId: medecin.id,
    ...(q ? { nom: { contains: q, mode: 'insensitive' } } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.patientRegistre.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.patientRegistre.count({ where }),
  ])
  res.json({ items, total, page, pageSize })
}

async function creer(req, res) {
  const medecin = await praticienTraditionnel(req, res)
  if (!medecin) return
  const fiche = await prisma.patientRegistre.create({ data: { ...req.body, medecinLocalId: medecin.id } })
  await journal(req, 'REGISTRE_PATIENT_CREE', fiche)
  res.status(201).json(fiche)
}

async function modifier(req, res) {
  const medecin = await praticienTraditionnel(req, res)
  if (!medecin) return
  const fiche = await chargerFiche(req, res, medecin)
  if (!fiche) return
  const maj = await prisma.patientRegistre.update({ where: { id: fiche.id }, data: req.body })
  await journal(req, 'REGISTRE_PATIENT_MODIFIE', fiche)
  res.json(maj)
}

async function referer(req, res) {
  const medecin = await praticienTraditionnel(req, res)
  if (!medecin) return
  const fiche = await chargerFiche(req, res, medecin)
  if (!fiche) return
  const { referenceVers, referenceDestinataire, referenceMotif } = req.body
  const maj = await prisma.patientRegistre.update({
    where: { id: fiche.id },
    data: { referenceVers, referenceDestinataire, referenceMotif: referenceMotif || null, referenceLe: new Date() },
  })
  await journal(req, 'REGISTRE_PATIENT_REFERE', fiche)
  res.json(maj)
}

async function annulerReference(req, res) {
  const medecin = await praticienTraditionnel(req, res)
  if (!medecin) return
  const fiche = await chargerFiche(req, res, medecin)
  if (!fiche) return
  const maj = await prisma.patientRegistre.update({
    where: { id: fiche.id },
    data: { referenceVers: null, referenceDestinataire: null, referenceMotif: null, referenceLe: null },
  })
  await journal(req, 'REGISTRE_REFERENCE_ANNULEE', fiche)
  res.json(maj)
}

async function supprimer(req, res) {
  const medecin = await praticienTraditionnel(req, res)
  if (!medecin) return
  const fiche = await chargerFiche(req, res, medecin)
  if (!fiche) return
  await prisma.patientRegistre.delete({ where: { id: fiche.id } })
  await journal(req, 'REGISTRE_PATIENT_SUPPRIME', fiche)
  res.status(204).end()
}

module.exports = { lister, creer, modifier, referer, annulerReference, supprimer }
