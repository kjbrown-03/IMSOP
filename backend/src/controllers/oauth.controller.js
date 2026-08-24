const jwt = require('jsonwebtoken')
const { prisma } = require('../lib/prisma')
const env = require('../config/env')
const { issueSession, issueTwoFactorChallenge, ROLES_REQUIRING_2FA } = require('./auth.controller')
const { logAction } = require('../services/auditService')
const { getProvider, isConfigured, buildAuthUrl, exchangeCodeForProfile } = require('../services/oauthProviders')

const VALID_ROLES = new Set(['PATIENT', 'SPECIALISTE', 'COORDINATEUR', 'ADMIN', 'MEDECIN_LOCAL'])

const LOGIN_PAGE_BY_ROLE = {
  PATIENT: 'patient',
  SPECIALISTE: 'specialiste',
  COORDINATEUR: 'coordinateur',
  ADMIN: 'admin',
  MEDECIN_LOCAL: 'medecin',
}

function redirectUriFor(provider) {
  return `${env.oauth.backendBaseUrl}/api/auth/oauth/${provider}/callback`
}

function toFrontendError(res, role, code) {
  const page = LOGIN_PAGE_BY_ROLE[role] || 'patient'
  res.redirect(`${env.corsOrigin}/connexion/${page}?oauthError=${encodeURIComponent(code)}`)
}

async function startOAuth(req, res) {
  const { provider: name } = req.params
  const role = VALID_ROLES.has(req.query.role) ? req.query.role : 'PATIENT'
  const provider = getProvider(name)
  if (!provider) return toFrontendError(res, role, 'unknown_provider')
  if (!isConfigured(provider)) return toFrontendError(res, role, 'not_configured')

  // Stateless CSRF guard: a short-lived signed token stands in for a stored
  // session nonce, consistent with how 2FA challenges and password reset
  // links already work in this codebase. It can't be forged without the
  // server's JWT secret and expires long before a captured URL could be
  // replayed. It also carries the role the button was clicked from, since
  // that's the only way the callback - a plain redirect from Google, not a
  // request our frontend controls - can know which login page to send
  // errors back to and which role to require a match against.
  const state = jwt.sign({ purpose: 'oauth_state', provider: name, role }, env.jwt.accessSecret, { expiresIn: '5m' })

  res.redirect(buildAuthUrl(provider, { redirectUri: redirectUriFor(name), state }))
}

async function oauthCallback(req, res) {
  const { provider: name } = req.params
  const { code, state, error: providerError } = req.query

  // Before the state verifies we don't know the intended role, so these
  // early failures necessarily fall back to the patient login page.
  if (providerError) return toFrontendError(res, 'PATIENT', 'access_denied')

  const provider = getProvider(name)
  if (!provider || !isConfigured(provider)) return toFrontendError(res, 'PATIENT', 'not_configured')

  let role
  try {
    const statePayload = jwt.verify(state, env.jwt.accessSecret)
    if (statePayload.purpose !== 'oauth_state' || statePayload.provider !== name) {
      throw new Error('state mismatch')
    }
    role = VALID_ROLES.has(statePayload.role) ? statePayload.role : 'PATIENT'
  } catch {
    return toFrontendError(res, 'PATIENT', 'invalid_state')
  }

  let profile
  try {
    profile = await exchangeCodeForProfile(provider, { code, redirectUri: redirectUriFor(name) })
  } catch (err) {
    console.error('OAuth exchange failed:', err)
    return toFrontendError(res, role, 'exchange_failed')
  }

  if (!profile.email) return toFrontendError(res, role, 'no_email')

  const user = await prisma.user.findUnique({
    where: { email: profile.email },
    include: { patient: true, specialiste: true, medecinLocal: true },
  })

  // No account for this email under the role the button was clicked from -
  // deliberately no auto-registration here (patients and local doctors have
  // their own signup forms with the fields those roles need; specialist/
  // coordinator/admin accounts are never self-service, Google or not). The
  // message differs by role: patients and local doctors are told to sign
  // up, everyone else is told to contact an administrator instead, since
  // they have no signup form to be sent to.
  if (!user || user.role !== role) {
    const errorCode =
      role === 'PATIENT' ? 'not_registered_patient'
      : role === 'MEDECIN_LOCAL' ? 'not_registered_medecin'
      : 'not_registered_professional'
    return toFrontendError(res, role, errorCode)
  }

  if (!user.active) return toFrontendError(res, role, 'account_disabled')

  await logAction({ userId: user.id, action: 'OAUTH_LOGIN', entityType: 'User', entityId: user.id, metadata: { provider: name } })

  // Google verifying the person's identity is not a substitute for this
  // platform's own second factor - a professional account must clear the
  // same 2FA challenge here as it would with a password.
  if (ROLES_REQUIRING_2FA.has(user.role) || user.twoFactorEnabled) {
    const challengeToken = await issueTwoFactorChallenge(user)
    const params = new URLSearchParams({ twoFactorRequired: 'true', challengeToken, role: user.role })
    return res.redirect(`${env.corsOrigin}/oauth/callback#${params.toString()}`)
  }

  const session = await issueSession(user)
  const params = new URLSearchParams({ accessToken: session.accessToken, refreshToken: session.refreshToken })
  res.redirect(`${env.corsOrigin}/oauth/callback#${params.toString()}`)
}

module.exports = { startOAuth, oauthCallback }
