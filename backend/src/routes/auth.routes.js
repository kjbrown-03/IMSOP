const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { authLimiter } = require('../middleware/rateLimit')
const schema = require('../schemas/auth.schema')
const ctrl = require('../controllers/auth.controller')

const router = express.Router()

router.post('/register/patient', authLimiter, validate(schema.registerPatient), ctrl.registerPatient)
router.post('/register/medecin-local', authLimiter, validate(schema.registerMedecinLocal), ctrl.registerMedecinLocal)
router.post('/login', authLimiter, validate(schema.login), ctrl.login)
router.post('/2fa/verify', authLimiter, validate(schema.verifyTwoFactor), ctrl.verifyTwoFactor)
router.post('/refresh', validate(schema.refresh), ctrl.refresh)
router.post('/logout', validate(schema.logout), ctrl.logout)
router.post('/forgot-password', authLimiter, validate(schema.forgotPassword), ctrl.forgotPassword)
router.post('/reset-password', authLimiter, validate(schema.resetPassword), ctrl.resetPassword)
router.post('/verify-email', authenticate, validate(schema.verifyEmail), ctrl.verifyEmail)
router.post('/verify-email/resend', authenticate, authLimiter, ctrl.resendEmailVerification)
// Confirmation par code de la signature du consentement, juste avant le
// paiement. Sous authLimiter comme les autres envois de code.
router.post('/consentement/code', authenticate, authLimiter, ctrl.envoyerCodeConsentement)
router.post('/consentement/code/verify', authenticate, authLimiter, validate(schema.verifierCodeConsentement), ctrl.verifierCodeConsentement)
// Sous authLimiter : une tentative répétée sur « mot de passe actuel » est une
// attaque par force brute comme une autre.
router.post('/mot-de-passe', authenticate, authLimiter, validate(schema.changerMotDePasse), ctrl.changerMotDePasse)
router.get('/me', authenticate, ctrl.me)

module.exports = router
