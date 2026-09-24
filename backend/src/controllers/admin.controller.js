const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { prisma } = require('../lib/prisma')
const { calculerStatistiques } = require('../services/statistiquesService')
const { calculerStatistiquesMensuelles } = require('../services/statistiquesMensuellesService')
const { logAction } = require('../services/auditService')
const { safeUserSelect } = require('../lib/selectors')

const MANAGEABLE_ROLES = new Set(['SPECIALISTE', 'MEDECIN_LOCAL', 'COORDINATEUR'])

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

// CDC §62 (BI) et §63 (13 indicateurs). Les bornes de période sont optionnelles :
// sans elles, l'indicateur porte sur toute la vie de la plateforme.
// DÉROGATION ASSUMÉE AU §32.
//
// La table RBAC du cahier des charges réserve les indicateurs financiers à
// l'administration. La direction a tranché l'inverse : le coordinateur pilote le
// réseau d'experts et doit voir le revenu par dossier pour arbitrer ses
// affectations. L'écart est donc volontaire et documenté ici plutôt que
// silencieux — c'est le genre de décision qu'une relecture du CDC signalerait
// comme un bug si personne ne l'avait écrite.
//
// Les rôles hors coordination restent exclus.
const ROLES_ACCES_FINANCIER = new Set(['ADMIN', 'COORDINATEUR'])

const KPIS_FINANCIERS = new Set(['revenuMoyenParDossier', 'coutMoyenParDossier'])

async function statistiques(req, res) {
  const { depuis, jusquA } = req.query
  const donnees = await calculerStatistiques({
    depuis: depuis ? new Date(depuis) : null,
    jusquA: jusquA ? new Date(jusquA) : null,
  })

  if (!ROLES_ACCES_FINANCIER.has(req.userRole)) {
    delete donnees.finance
    donnees.kpis = donnees.kpis.map((k) =>
      KPIS_FINANCIERS.has(k.cle)
        ? { numero: k.numero, cle: k.cle, disponible: false, raison: "Réservé à l'administration (CDC §32)." }
        : k,
    )
  }

  res.json(donnees)
}

// Les dix indicateurs du MVP (§8), mois par mois. Réservé aux mêmes rôles que
// l'instantané : la route est déjà derrière requireRole('COORDINATEUR','ADMIN').
async function statistiquesMensuelles(req, res) {
  const mois = Math.min(Math.max(parseInt(req.query.mois, 10) || 12, 1), 36)
  res.json(await calculerStatistiquesMensuelles({ mois }))
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

// Animer le réseau d'experts est le métier même du coordinateur : il doit
// pouvoir enrôler un spécialiste, corriger sa fiche et désactiver un compte
// sans passer par un administrateur. Il n'a en revanche aucune raison de
// toucher aux comptes de coordination — d'où ce sous-ensemble, qui ne
// s'applique qu'à lui. L'administrateur garde MANAGEABLE_ROLES en entier.
// Le medecin traitant de proximite fait partie du reseau que la coordination
// anime, au meme titre que le specialiste : c'est elle qui l'enrole depuis une
// candidature, corrige sa fiche et suspend son acces. Il n'y avait jusqu'ici
// aucun ecran pour le faire.
const ROLES_GERES_PAR_COORDINATEUR = new Set(['SPECIALISTE', 'MEDECIN_LOCAL'])

function assertManageableRole(role, res, req) {
  if (!MANAGEABLE_ROLES.has(role)) {
    res.status(400).json({ message: 'Rôle non géré depuis cet écran' })
    return false
  }
  if (req?.userRole === 'COORDINATEUR' && !ROLES_GERES_PAR_COORDINATEUR.has(role)) {
    res.status(403).json({ message: 'Un coordinateur ne gère que les comptes spécialistes' })
    return false
  }
  return true
}

async function listUsers(req, res) {
  const { role, active, q } = req.query
  if (!assertManageableRole(role, res, req)) return

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
    select: { ...safeUserSelect, active: true, emailVerified: true, createdAt: true, specialiste: true, medecinLocal: true },
    orderBy: { createdAt: 'desc' },
  })

  res.json(users)
}

async function createUser(req, res) {
  const { role, fullName, email, password, phone, specialite, pays, etablissement, langues, bio, ville, numeroOrdre } = req.body
  if (!assertManageableRole(role, res, req)) return

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
  if (role === 'MEDECIN_LOCAL') {
    // Meme regle que pour le specialiste : creer le compte ne vaut pas
    // habilitation, c'est le controle du numero d'ordre qui la fonde.
    data.medecinLocal = { create: { specialite, pays, etablissement, ville, numeroOrdre } }
  }

  const user = await prisma.user.create({ data, include: { specialiste: true, medecinLocal: true } })

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
  const user = await prisma.user.findUnique({ where: { id }, include: { specialiste: true, medecinLocal: true } })
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })
  if (!assertManageableRole(user.role, res, req)) return

  const { fullName, email, phone, specialite, pays, etablissement, langues, bio, disponible, ville, numeroOrdre } = req.body

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

  if (user.role === 'MEDECIN_LOCAL' && user.medecinLocal) {
    const medecinData = {}
    if (specialite !== undefined) medecinData.specialite = specialite
    if (pays !== undefined) medecinData.pays = pays
    if (etablissement !== undefined) medecinData.etablissement = etablissement
    if (ville !== undefined) medecinData.ville = ville
    if (numeroOrdre !== undefined) medecinData.numeroOrdre = numeroOrdre
    if (Object.keys(medecinData).length > 0) {
      data.medecinLocal = { update: medecinData }
    }
  }

  const updated = await prisma.user.update({ where: { id }, data, include: { specialiste: true, medecinLocal: true } })

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
  if (!assertManageableRole(user.role, res, req)) return
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

module.exports = {
  statistiques,
  statistiquesMensuelles, listAuditLogs, dashboardStats, listUsers, createUser, updateUser, setUserActive }
