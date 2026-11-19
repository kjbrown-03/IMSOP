const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/registre.schema')
const ctrl = require('../controllers/registre.controller')

// Registre des patients du tradipraticien, et de lui seul : le medecin
// conventionnel a ses dossiers de second avis, il n'a pas ce carnet.
const router = express.Router()
router.use(authenticate, requireRole('TRADIPRATICIEN'))

router.get('/', validate(schema.lister), ctrl.lister)
router.post('/', validate(schema.creer), ctrl.creer)
router.patch('/:id', validate(schema.modifier), ctrl.modifier)
router.delete('/:id', validate(schema.parId), ctrl.supprimer)
router.post('/:id/reference', validate(schema.referer), ctrl.referer)
router.delete('/:id/reference', validate(schema.parId), ctrl.annulerReference)

module.exports = router
