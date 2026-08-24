const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { safeUserSelect } = require('../lib/selectors')

const MANAGEABLE_ROLES = new Set(['SPECIALISTE', 'COORDINATEUR'])

async function listAuditLogs(req, res) {
  const { dossierId, entityType, take = 100 } = req.query
  const where = {}
  if (dossierId) where.dossierId = dossierId
  if (entityType) where.entityType = entityType

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(parseInt(take, 10) || 100, 500),
    include: { user: { select: { id: true, fullName: true, role: true } } },
  })

  res.json(logs)
}

async function dashboardStats(req, res) {
  const [nouveaux, incomplets, aAffecter, urgents, totalPatients, totalSpecialistes, totalCoordinateurs, rapportsValides] =
    await Promise.all([
      prisma.dossier.count({ where: { status: 'SOUMIS' } }),
      prisma.dossier.count({ where: { status: 'EN_VERIFICATION' } }),
      prisma.dossier.count({ where: { status: 'EN_ATTENTE_AFFECTATION' } }),
      prisma.dossier.count({ where: { urgence: 'URGENT', status: { notIn: ['CLOTURE', 'RAPPORT_TRANSMIS', 'ANNULE'] } } }),
      prisma.patient.count(),
      prisma.user.count({ where: { role: 'SPECIALISTE' } }),
      prisma.user.count({ where: { role: 'COORDINATEUR' } }),
      prisma.rapport.count({ where: { status: 'VALIDE' } }),
    ])

  res.json({ nouveaux, incomplets, aAffecter, urgents, totalPatients, totalSpecialistes, totalCoordinateurs, rapportsValides })
}

// --- User management (specialistes & coordinateurs only) -----------------
// Deliberately excludes PATIENT (managed through the patient/coordinator
// flows, not here) and ADMIN (creating admins is a higher-privilege action
// this screen doesn't grant). Accounts are deactivated, never hard-deleted:
// a specialist/coordinator can be tied to years of dossiers, messages and
// audit history that must stay intact for medical/legal traceability.

function assertManageableRole(role, res) {
  if (!MANAGEABLE_ROLES.has(role)) {
    res.status(400).json({ message: 'Rôle non géré depuis cet écran' })
    return false
  }
  return true
}

async function listUsers(req, res) {
  const { role, active, q } = req.query
  if (!assertManageableRole(role, res)) return

  const where = { role }
  if (active !== undefined) where.active = active === 'true'
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
    ]
  }

  const users = await prisma.user.findMany({
    where,
    select: { ...safeUserSelect, active: true, emailVerified: true, createdAt: true, specialiste: true },
    orderBy: { createdAt: 'desc' },
  })

  res.json(users)
}

async function createUser(req, res) {
  const { role, fullName, email, password, phone, specialite, pays, etablissement, langues, bio } = req.body
  if (!assertManageableRole(role, res)) return

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ message: 'Un compte existe déjà avec cet email' })

  const finalPassword = password || crypto.randomBytes(9).toString('base64url')
  const passwordHash = await bcrypt.hash(finalPassword, 12)

  const data = {
    email,
    passwordHash,
    fullName,
    phone,
    role,
    twoFactorEnabled: true,
    emailVerified: true,
  }
  if (role === 'SPECIALISTE') {
    // CDC §16 : un compte créé par l'administration n'est pas habilité pour
    // autant. Il naît EN_VERIFICATION et attend le dépôt puis le contrôle de ses
    // justificatifs, comme un compte créé par le praticien lui-même.
    data.specialiste = { create: { specialite, pays, etablissement, langues, bio } }
  }

  const user = await prisma.user.create({ data, include: { specialiste: true } })

  await logAction({
    userId: req.userId,
    action: 'ADMIN_USER_CREATED',
    entityType: 'User',
    entityId: user.id,
    metadata: { role, email },
    ipAddress: req.ip,
  })

  const { passwordHash: _omit, ...safeUser } = user
  res.status(201).json({ user: safeUser, temporaryPassword: password ? undefined : finalPassword })
}

async function updateUser(req, res) {
  const { id } = req.params
  const user = await prisma.user.findUnique({ where: { id }, include: { specialiste: true } })
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })
  if (!assertManageableRole(user.role, res)) return

  const { fullName, email, phone, specialite, pays, etablissement, langues, bio, disponible } = req.body

  const data = {}
  if (fullName !== undefined) data.fullName = fullName
  if (email !== undefined) data.email = email
  if (phone !== undefined) data.phone = phone

  if (user.role === 'SPECIALISTE' && user.specialiste) {
    const specialisteData = {}
    if (specialite !== undefined) specialisteData.specialite = specialite
    if (pays !== undefined) specialisteData.pays = pays
    if (etablissement !== undefined) specialisteData.etablissement = etablissement
    if (langues !== undefined) specialisteData.langues = langues
    if (bio !== undefined) specialisteData.bio = bio
    if (disponible !== undefined) specialisteData.disponible = disponible
    if (Object.keys(specialisteData).length > 0) {
      data.specialiste = { update: specialisteData }
    }
  }

  const updated = await prisma.user.update({ where: { id }, data, include: { specialiste: true } })

  await logAction({
    userId: req.userId,
    action: 'ADMIN_USER_UPDATED',
    entityType: 'User',
    entityId: id,
    metadata: req.body,
    ipAddress: req.ip,
  })

  const { passwordHash: _omit, ...safeUser } = updated
  res.json(safeUser)
}

async function setUserActive(req, res) {
  const { id } = req.params
  const { active } = req.body

  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })
  if (!assertManageableRole(user.role, res)) return
  if (id === req.userId) return res.status(400).json({ message: 'Vous ne pouvez pas désactiver votre propre compte' })

  const updated = await prisma.user.update({ where: { id }, data: { active } })

  if (!active) {
    await prisma.refreshToken.deleteMany({ where: { userId: id } })
  }

  await logAction({
    userId: req.userId,
    action: active ? 'ADMIN_USER_REACTIVATED' : 'ADMIN_USER_DEACTIVATED',
    entityType: 'User',
    entityId: id,
    ipAddress: req.ip,
  })

  const { passwordHash: _omit, ...safeUser } = updated
  res.json(safeUser)
}

module.exports = { listAuditLogs, dashboardStats, listUsers, createUser, updateUser, setUserActive }
