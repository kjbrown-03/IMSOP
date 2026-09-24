const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/consentements.schema')
const ctrl = require('../controllers/consentements.controller')

const router = express.Router({ mergeParams: true })
router.use(authenticate)

router.post('/', validate(schema.createConsentement), ctrl.createConsentement)
router.get('/', validate(schema.dossierScoped), ctrl.listConsentements)
// L'historique complet reste sur '/', qui sert l'audit. '/courants' donne l'état
// qui fait foi, un enregistrement par type.
router.get('/courants', validate(schema.dossierScoped), ctrl.listConsentementsCourants)

module.exports = router
