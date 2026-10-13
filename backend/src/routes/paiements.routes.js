const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const { webhookLimiter } = require('../middleware/rateLimit')
const schema = require('../schemas/paiements.schema')
const ctrl = require('../controllers/paiements.controller')

const dossierScoped = express.Router({ mergeParams: true })
dossierScoped.use(authenticate)

// Le volet financier d'un dossier ne regarde que le patient qui paie, et la
// coordination qui en repond.
//
// Ces quatre routes ne posaient AUCUN contrôle de rôle : elles se contentaient
// de vérifier l'accès au dossier, lequel autorise le médecin traitant désigné.
// Celui-ci voyait donc où en était le paiement de son patient, alors que
// docs/ecarts-implementation.md (§32) et backend/README.md promettaient
// l'inverse. Un test (`paiement.test.js`) tenait l'écart visible en `todo`
// plutôt que de le laisser dormir dans un document.
//
// Arbitrage rendu : le médecin traitant accompagne le parcours médical, pas la
// transaction. Il garde l'accès au dossier, aux pièces et à la messagerie.
dossierScoped.use(requireRole('PATIENT', 'COORDINATEUR', 'ADMIN'))

dossierScoped.get('/tarif', validate(schema.dossierScoped), ctrl.getTarif)
dossierScoped.post('/init', validate(schema.dossierScoped), ctrl.initPaiement)
dossierScoped.get('/status', validate(schema.dossierScoped), ctrl.getPaiementStatus)
dossierScoped.post('/simulate', validate(schema.dossierScoped), ctrl.simulatePaiement)

const webhookRouter = express.Router()
webhookRouter.post('/webhook', webhookLimiter, validate(schema.webhook), ctrl.webhook)
// À déclarer dans le tableau de bord Fapshi, avec le secret FAPSHI_WEBHOOK_SECRET.
webhookRouter.post('/webhook/fapshi', webhookLimiter, validate(schema.webhookFapshi), ctrl.webhookFapshi)

module.exports = { dossierScoped, webhookRouter }
