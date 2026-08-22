const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { webhookLimiter } = require('../middleware/rateLimit')
const schema = require('../schemas/paiements.schema')
const ctrl = require('../controllers/paiements.controller')

const dossierScoped = express.Router({ mergeParams: true })
dossierScoped.use(authenticate)
dossierScoped.post('/init', validate(schema.dossierScoped), ctrl.initPaiement)
dossierScoped.get('/status', validate(schema.dossierScoped), ctrl.getPaiementStatus)
dossierScoped.post('/simulate', validate(schema.dossierScoped), ctrl.simulatePaiement)

const webhookRouter = express.Router()
webhookRouter.post('/webhook', webhookLimiter, validate(schema.webhook), ctrl.webhook)

module.exports = { dossierScoped, webhookRouter }
