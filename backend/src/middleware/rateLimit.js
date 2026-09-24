const rateLimit = require('express-rate-limit')

// The automated suite drives hundreds of requests through supertest from a
// single loopback address, which is exactly the shape these limiters exist to
// block - without this, tests start failing at the 21st login for a reason
// that has nothing to do with the behaviour under test. Keyed on NODE_ENV
// rather than a dedicated flag so it can never be switched on in production
// by a stray environment variable.
const enTest = () => process.env.NODE_ENV === 'test'

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
  skip: enTest,
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
  skip: enTest,
})

// CinetPay may retry a notification a few times; this only guards against a
// flood, not normal retry behavior.
const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: enTest,
})

// La recherche d'annuaire est publique et écrit en base (une ligne par
// recherche, plus ses résultats figés) : sans plafond dédié, un script
// pourrait la remplir de recherches vides. Un vrai patient n'en lance pas dix
// par minute.
const rechercheAnnuaireLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Trop de recherches, réessayez dans quelques minutes' },
  skip: enTest,
})

module.exports = { apiLimiter, authLimiter, webhookLimiter, rechercheAnnuaireLimiter }
