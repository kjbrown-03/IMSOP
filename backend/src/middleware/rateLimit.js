const rateLimit = require('express-rate-limit')

// Baseline protection on every route - generous enough not to bother a real
// user, tight enough that one runaway client (buggy script, scraping,
// misbehaving frontend retry loop) can't starve everyone else on this
// single process of CPU/DB connections.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de requêtes, veuillez ralentir' },
})

// Login/register/2FA are the classic brute-force and credential-stuffing
// surface, and the ones most likely to be hammered once the platform is
// public. Capped per IP so a single abusive client can't degrade the API
// for everyone else.
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de tentatives, réessayez dans quelques minutes' },
})

// CinetPay may retry a notification a few times; this only guards against a
// flood, not normal retry behavior.
const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
})

module.exports = { apiLimiter, authLimiter, webhookLimiter }
