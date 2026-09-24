const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const env = require('../config/env')
const { prisma } = require('../lib/prisma')

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

// Un jeton d'accès vit 15 minutes : sans cette relecture, un compte désactivé
// gardait l'accès jusqu'à l'expiration du jeton en cours. Pour des dossiers
// médicaux, la coupure doit être immédiate — d'où une lecture en base à chaque
// requête, sur la clé primaire, deux colonnes. Le coût est négligeable devant
// ce que fait ensuite n'importe quel contrôleur.
async function authenticate(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Authentification requise' })

  let payload
  try {
    payload = jwt.verify(token, env.jwt.accessSecret)
  } catch (err) {
    return res.status(401).json({ message: 'Session expirée ou invalide' })
  }

  const compte = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { active: true, role: true },
  })
  if (!compte) return res.status(401).json({ message: 'Session expirée ou invalide' })
  if (!compte.active) return res.status(403).json({ message: 'Ce compte a été désactivé' })

  req.userId = payload.sub
  // Le rôle en base, pas celui du jeton : un changement de rôle prend effet
  // sans attendre la fin de la session.
  req.userRole = compte.role
  next()
}

// Pour les routes ouvertes à tous mais qui savent tirer parti d'une session si
// elle existe (la recherche d'annuaire rattache la recherche au compte quand il
// y en a un). Un jeton absent ou invalide ne bloque pas : on continue anonyme.
function authenticateOptional(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next()
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret)
    req.userId = payload.sub
    req.userRole = payload.role
  } catch {
    // Jeton périmé ou forgé : on ne renvoie pas 401, on traite en anonyme.
  }
  next()
}

module.exports = { signAccessToken, signRefreshToken, authenticate, authenticateOptional }
