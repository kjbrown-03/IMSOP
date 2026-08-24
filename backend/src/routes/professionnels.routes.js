const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { upload, handleUploadErrors } = require('../middleware/upload')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/professionnels.schema')
const ctrl = require('../controllers/professionnels.controller')

const router = express.Router()
router.use(authenticate)

const PRATICIENS = ['SPECIALISTE', 'MEDECIN_LOCAL']
const CONTROLEURS = ['COORDINATEUR', 'ADMIN']

// Dépôt et relecture de ses propres justificatifs (CDC §16).
router.post(
  '/me/justificatifs',
  requireRole(...PRATICIENS),
  upload.single('file'),
  handleUploadErrors,
  validate(schema.uploadJustificatif),
  ctrl.uploadJustificatif,
)
router.get('/me/justificatifs', requireRole(...PRATICIENS), ctrl.listerMesJustificatifs)

// Instruction par la coordination.
router.get('/verifications', requireRole(...CONTROLEURS), validate(schema.listerDemandes), ctrl.listerDemandes)
router.get('/:userId/justificatifs', requireRole(...CONTROLEURS), validate(schema.userIdParam), ctrl.listerJustificatifsDe)
router.post('/:userId/habilitation', requireRole(...CONTROLEURS), validate(schema.statuerHabilitation), ctrl.statuerHabilitation)

// Le contrôle d'accès est fait dans le contrôleur : propriétaire OU contrôleur.
router.get('/justificatifs/:id/download', validate(schema.idParam), ctrl.telechargerJustificatif)

module.exports = router
