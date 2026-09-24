const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/specialites.schema')
const ctrl = require('../controllers/specialites.controller')

const router = express.Router()

// Lecture publique : le formulaire de candidature en a besoin, et personne
// n'est connecté à ce moment-là.
router.get('/', validate(schema.lister), ctrl.lister)

router.use(authenticate, requireRole('COORDINATEUR', 'ADMIN'))
router.post('/', validate(schema.creer), ctrl.creer)
router.patch('/:id', validate(schema.modifier), ctrl.modifier)

module.exports = router
