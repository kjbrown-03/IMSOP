const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const { piecesPriseEnChargeUpload, handleUploadErrors } = require('../middleware/upload')
const schema = require('../schemas/prisesEnCharge.schema')
const ctrl = require('../controllers/prisesEnCharge.controller')

// Demandes d'ajout de maladies prises en charge : déposées par le
// tradipraticien, tranchées par la coordination.
const router = express.Router()
router.use(authenticate)

const CONTROLEURS = ['COORDINATEUR', 'ADMIN']

router.post(
  '/',
  requireRole('TRADIPRATICIEN'),
  (req, res, next) => {
    req.maxUploadLabel = '10 Mo'
    next()
  },
  piecesPriseEnChargeUpload.array('pieces', 5),
  handleUploadErrors,
  validate(schema.creer),
  ctrl.creer,
)
router.get('/moi', requireRole('TRADIPRATICIEN'), ctrl.mesDemandes)

router.get('/', requireRole(...CONTROLEURS), validate(schema.lister), ctrl.lister)
router.post('/:id/decision', requireRole(...CONTROLEURS), validate(schema.decider), ctrl.decider)

// Propriétaire ou coordination : contrôlé dans le contrôleur.
router.get('/pieces/:id', requireRole('TRADIPRATICIEN', ...CONTROLEURS), validate(schema.parId), ctrl.telechargerPiece)

module.exports = router
