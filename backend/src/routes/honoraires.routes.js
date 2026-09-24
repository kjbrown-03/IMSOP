const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/honoraires.schema')
const ctrl = require('../controllers/honoraires.controller')

// Le relevé et les reversements sont du ressort de l'administration et de la
// coordination (même dérogation au §32 que pour les indicateurs financiers).
const router = express.Router()
router.use(authenticate, requireRole('COORDINATEUR', 'ADMIN'))

router.get('/', validate(schema.lister), ctrl.lister)
router.get('/synthese', ctrl.synthese)
router.post('/:id/reverser', validate(schema.reverser), ctrl.reverser)

module.exports = router
