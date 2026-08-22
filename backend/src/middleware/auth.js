const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const env = require('../config/env')

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn,
  })
}

function signRefreshToken(user) {
  // jti makes every token unique even when the same user logs in twice within
  // the same second (concurrent tabs/devices, a retried request): without it,
  // jwt.sign() is deterministic on { sub, iat, exp }, so two such tokens are
  // byte-for-byte identical and collide on RefreshToken.tokenHash's unique
  // constraint, which surfaces as a 500 instead of two valid sessions.
  return jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn,
  })
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentification requise' })

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret)
    req.userId = payload.sub
    req.userRole = payload.role
    next()
  } catch (err) {
    return res.status(401).json({ message: 'Session expirée ou invalide' })
  }
}

module.exports = { signAccessToken, signRefreshToken, authenticate }
