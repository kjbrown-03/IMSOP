const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { candidatureUpload, handleUploadErrors } = require('../middleware/upload')
const { authLimiter } = require('../middleware/rateLimit')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/candidatures.schema')
const ctrl = require('../controllers/candidatures.controller')

const router = express.Router()

// Dépôt public : aucun compte n'existe encore. Sous le limiteur d'authentification
// — même surface d'abus qu'une inscription. multer avant validate : c'est lui
// qui transforme le multipart en req.body.
router.post(
  '/',
  authLimiter,
  candidatureUpload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'cv', maxCount: 1 },
  ]),
  handleUploadErrors,
  validate(schema.deposer),
  ctrl.deposer,
)

// Tout le reste est réservé au comité et à la coordination.
const CONTROLEURS = ['COORDINATEUR', 'ADMIN']
router.use(authenticate, requireRole(...CONTROLEURS))

router.get('/', validate(schema.lister), ctrl.lister)
router.get('/:id', validate(schema.idParam), ctrl.detail)
router.get('/:id/photo', validate(schema.idParam), ctrl.photo)
router.get('/:id/cv', validate(schema.idParam), ctrl.cv)
router.post('/:id/ecarter', validate(schema.ecarter), ctrl.ecarter)
router.post('/:id/creer-compte', validate(schema.idParam), ctrl.creerCompte)
router.post('/:id/renvoyer-identifiants', validate(schema.idParam), ctrl.renvoyerIdentifiants)

module.exports = router
