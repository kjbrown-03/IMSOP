const bcrypt = require('bcrypt')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { prisma } = require('../lib/prisma')
const { signAccessToken, signRefreshToken } = require('../middleware/auth')
const { notify } = require('../services/notificationService')
const { genererPatientRef } = require('../services/referenceService')
const env = require('../config/env')

const ROLES_REQUIRING_2FA = new Set(['SPECIALISTE', 'MEDECIN_LOCAL', 'COORDINATEUR', 'ADMIN'])

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function serializeUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    patientRef: user.patient?.patientRef,
    dob: user.patient?.dob,
    nationality: user.patient?.nationality,
    country: user.patient?.country,
    city: user.patient?.city,
    preferredLanguage: user.patient?.preferredLanguage,
    identityVerified: user.patient?.identityVerified,
    identityDocumentSubmitted: !!user.patient?.identityDocumentKey,
    identityRejectedReason: user.patient?.identityRejectedReason,
    specialite: user.specialiste?.specialite ?? user.medecinLocal?.specialite,
    disponible: user.specialiste?.disponible,
    etablissement: user.medecinLocal?.etablissement ?? user.specialiste?.etablissement,
    numeroOrdre: user.medecinLocal?.numeroOrdre,
    // CDC §16 : EN_VERIFICATION | VALIDE | SUSPENDU | EXPIRE | REVOQUE.
    // Le front s'en sert pour afficher l'état de l'habilitation et, le cas
    // échéant, le motif d'un refus ou d'une suspension.
    verificationStatus: user.specialiste?.verificationStatus ?? user.medecinLocal?.verificationStatus,
    verificationMotif: user.specialiste?.verificationMotif ?? user.medecinLocal?.verificationMotif,
    habilitationExpireLe: user.specialiste?.habilitationExpireLe ?? user.medecinLocal?.habilitationExpireLe,
  }
}

async function sendEmailVerificationCode(user) {
  const code = crypto.randomInt(100000, 999999).toString()
  const codeHash = hashToken(code)

  await prisma.twoFactorChallenge.create({
    data: {
      userId: user.id,
      purpose: 'EMAIL_VERIFICATION',
      codeHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    },
  })

  console.log(`[EMAIL_VERIFICATION] Code for ${user.email}: ${code}`)

  // notify() records the notification then hands the SMTP round-trip off to the
  // background, so awaiting it does not slow registration down.
  await notify(user.id, user.email, 'VERIFICATION_EMAIL', { name: user.fullName, code })
}

async function issueTwoFactorChallenge(user) {
  const code = crypto.randomInt(100000, 999999).toString()
  const codeHash = hashToken(code)

  await prisma.twoFactorChallenge.create({
    data: { userId: user.id, codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  })

  await notify(user.id, user.email, 'MESSAGE_RECU', { name: user.fullName, reference: 'Code de vérification' })
  console.log(`[2FA] Code for ${user.email}: ${code}`)

  return jwt.sign({ sub: user.id, purpose: '2fa' }, env.jwt.accessSecret, { expiresIn: '10m' })
}

async function issueSession(user) {
  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  })

  return { accessToken, refreshToken, user: serializeUser(user) }
}

async function registerPatient(req, res) {
  const {
    fullName, email, password, dob, gender, phone,
    nationality, country, city, preferredLanguage,
    emergencyContactName, emergencyContactPhone,
    consentDataProcessing, twoFactorLater,
  } = req.body

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ message: 'Un compte existe déjà avec cet email' })

  const passwordHash = await bcrypt.hash(password, 12)
  const patientRef = await genererPatientRef()

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone,
      role: 'PATIENT',
      twoFactorEnabled: twoFactorLater === false,
      patient: {
        create: {
          patientRef,
          dob: dob ? new Date(dob) : null,
          gender,
          nationality,
          country,
          city,
          preferredLanguage,
          emergencyContactName,
          emergencyContactPhone,
        },
      },
    },
    include: { patient: true },
  })

  if (consentDataProcessing) {
    await prisma.consentement.create({
      data: {
        patientId: user.patient.id,
        type: 'TRAITEMENT_DONNEES',
        accepted: true,
        ipAddress: req.ip,
      },
    })
  }

  await sendEmailVerificationCode(user)

  const session = await issueSession(user)
  res.status(201).json(session)
}

// Self-service registration, deliberately mirroring the patient flow: the
// account is usable straight away but stays unverified until a coordinator
// checks the numéro d'ordre. A patient can designate it either way - the
// consent that grants record access is the patient's, not the platform's.
async function registerMedecinLocal(req, res) {
  const { fullName, email, password, phone, specialite, etablissement, pays, numeroOrdre } = req.body

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) return res.status(409).json({ message: 'Un compte existe déjà avec cet email' })

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName,
      phone,
      role: 'MEDECIN_LOCAL',
      twoFactorEnabled: true,
      medecinLocal: { create: { specialite, etablissement, pays, numeroOrdre } },
    },
    include: { medecinLocal: true },
  })

  await sendEmailVerificationCode(user)

  const session = await issueSession(user)
  res.status(201).json(session)
}

async function login(req, res) {
  const { email, password, role } = req.body
  const user = await prisma.user.findUnique({ where: { email }, include: { patient: true, specialiste: true, medecinLocal: true } })
  if (!user || (role && user.role !== role)) {
    return res.status(401).json({ message: 'Identifiants incorrects' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) return res.status(401).json({ message: 'Identifiants incorrects' })

  if (!user.active) {
    return res.status(403).json({ message: 'Ce compte a été désactivé. Contactez un administrateur.' })
  }

  if (ROLES_REQUIRING_2FA.has(user.role) || user.twoFactorEnabled) {
    const challengeToken = await issueTwoFactorChallenge(user)
    return res.json({ twoFactorRequired: true, challengeToken })
  }

  const session = await issueSession(user)
  res.json(session)
}

async function verifyTwoFactor(req, res) {
  const { challengeToken, code } = req.body
  let payload
  try {
    payload = jwt.verify(challengeToken, env.jwt.accessSecret)
    if (payload.purpose !== '2fa') throw new Error('invalid purpose')
  } catch (err) {
    return res.status(401).json({ message: 'Session de vérification expirée' })
  }

  const challenge = await prisma.twoFactorChallenge.findFirst({
    where: { userId: payload.sub, purpose: 'LOGIN_2FA', consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  if (!challenge || challenge.codeHash !== hashToken(code)) {
    return res.status(401).json({ message: 'Code invalide ou expiré' })
  }

  await prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } })

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { patient: true, specialiste: true, medecinLocal: true } })
  const session = await issueSession(user)
  res.json(session)
}

async function verifyEmail(req, res) {
  const { code } = req.body

  const challenge = await prisma.twoFactorChallenge.findFirst({
    where: { userId: req.userId, purpose: 'EMAIL_VERIFICATION', consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  if (!challenge || challenge.codeHash !== hashToken(code)) {
    return res.status(401).json({ message: 'Code invalide ou expiré' })
  }

  await prisma.twoFactorChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date() } })
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { emailVerified: true },
    include: { patient: true },
  })

  res.json(serializeUser(user))
}

async function resendEmailVerification(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })
  if (user.emailVerified) return res.status(400).json({ message: 'Cet e-mail est déjà vérifié' })

  await sendEmailVerificationCode(user)
  res.json({ message: 'Un nouveau code de vérification a été envoyé.' })
}

async function refresh(req, res) {
  const { refreshToken } = req.body

  let payload
  try {
    payload = jwt.verify(refreshToken, env.jwt.refreshSecret)
  } catch (err) {
    return res.status(401).json({ message: 'Refresh token invalide' })
  }

  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } })
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return res.status(401).json({ message: 'Session expirée, veuillez vous reconnecter' })
  }

  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })

  const user = await prisma.user.findUnique({ where: { id: payload.sub }, include: { patient: true, specialiste: true, medecinLocal: true } })
  if (!user) return res.status(401).json({ message: 'Utilisateur introuvable' })

  const session = await issueSession(user)
  res.json(session)
}

async function logout(req, res) {
  const { refreshToken } = req.body
  if (refreshToken) {
    await prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken) },
      data: { revokedAt: new Date() },
    })
  }
  res.status(204).send()
}

async function forgotPassword(req, res) {
  const { email } = req.body
  const user = await prisma.user.findUnique({ where: { email } })

  // Always respond the same way whether or not the account exists, to avoid
  // leaking which emails are registered.
  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })

    const resetUrl = `${env.corsOrigin}/reinitialiser-mot-de-passe?token=${rawToken}`
    await notify(user.id, user.email, 'MOT_DE_PASSE_RESET', { name: user.fullName, resetUrl })
  }

  res.json({ message: 'Si cet e-mail est associé à un compte, un lien de réinitialisation vient d\'être envoyé.' })
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body
  const tokenHash = hashToken(token)

  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } })
  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Ce lien de réinitialisation est invalide ou a expiré' })
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.$transaction([
    prisma.user.update({ where: { id: resetToken.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: resetToken.id }, data: { usedAt: new Date() } }),
    prisma.refreshToken.updateMany({
      where: { userId: resetToken.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  res.json({ message: 'Mot de passe réinitialisé avec succès. Vous pouvez vous reconnecter.' })
}

async function me(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId }, include: { patient: true, specialiste: true, medecinLocal: true } })
  if (!user) return res.status(404).json({ message: 'Utilisateur introuvable' })
  res.json(serializeUser(user))
}

module.exports = {
  registerMedecinLocal,
  registerPatient, login, verifyTwoFactor, refresh, logout, me,
  forgotPassword, resetPassword, verifyEmail, resendEmailVerification,
  issueSession, issueTwoFactorChallenge, ROLES_REQUIRING_2FA,
}
