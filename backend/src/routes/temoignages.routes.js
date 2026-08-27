const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/temoignages.schema')
const ctrl = require('../controllers/temoignages.controller')

const router = express.Router()

// Public - powers the testimonials section on the marketing homepage, no
// login required to read it.
router.get('/publics', ctrl.listerTemoignagesPublics)

// Authenticated - a patient or médecin traitant leaving a comment from their
// own dashboard.
router.post('/', authenticate, validate(schema.creerTemoignage), ctrl.creerTemoignage)

// Moderation is the medical coordinator's call, not admin's - témoignages are
// part of day-to-day patient/doctor relationship management, the same reason
// they review identity documents and habilitations.
router.get('/', authenticate, requireRole('COORDINATEUR'), validate(schema.listerAdmin), ctrl.listerTemoignagesAdmin)
router.patch('/:id', authenticate, requireRole('COORDINATEUR'), validate(schema.modererTemoignage), ctrl.modererTemoignage)

module.exports = router
