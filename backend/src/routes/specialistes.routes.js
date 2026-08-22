const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/specialistes.schema')
const ctrl = require('../controllers/specialistes.controller')

const router = express.Router()
router.use(authenticate)

router.get('/', validate(schema.listSpecialistes), ctrl.listSpecialistes)
router.get('/recommandations/:dossierId', validate(schema.getRecommandations), ctrl.getRecommandations)
router.patch('/me/disponibilite', requireRole('SPECIALISTE'), validate(schema.updateMyAvailability), ctrl.updateMyAvailability)

module.exports = router
