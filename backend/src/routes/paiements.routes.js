const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { webhookLimiter } = require('../middleware/rateLimit')
const schema = require('../schemas/paiements.schema')
const ctrl = require('../controllers/paiements.controller')

const dossierScoped = express.Router({ mergeParams: true })
dossierScoped.use(authenticate)
dossierScoped.get('/tarif', validate(schema.dossierScoped), ctrl.getTarif)
dossierScoped.post('/init', validate(schema.dossierScoped), ctrl.initPaiement)
dossierScoped.get('/status', validate(schema.dossierScoped), ctrl.getPaiementStatus)
dossierScoped.post('/simulate', validate(schema.dossierScoped), ctrl.simulatePaiement)

const webhookRouter = express.Router()
webhookRouter.post('/webhook', webhookLimiter, validate(schema.webhook), ctrl.webhook)
// À déclarer dans le tableau de bord Fapshi, avec le secret FAPSHI_WEBHOOK_SECRET.
webhookRouter.post('/webhook/fapshi', webhookLimiter, validate(schema.webhookFapshi), ctrl.webhookFapshi)

module.exports = { dossierScoped, webhookRouter }
