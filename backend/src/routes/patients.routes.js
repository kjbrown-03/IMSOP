const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { upload, handleUploadErrors } = require('../middleware/upload')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/patients.schema')
const ctrl = require('../controllers/patients.controller')

const router = express.Router()
router.use(authenticate)

router.post(
  '/me/identity-document',
  requireRole('PATIENT'),
  upload.single('file'),
  handleUploadErrors,
  validate(schema.uploadIdentityDocument),
  ctrl.uploadIdentityDocument,
)
router.get('/identity-reviews', requireRole('COORDINATEUR', 'ADMIN'), validate(schema.listIdentityReviews), ctrl.listIdentityReviews)
router.get('/:patientId/identity-document', requireRole('COORDINATEUR', 'ADMIN'), validate(schema.patientIdParam), ctrl.getIdentityDocumentUrl)
router.post('/:patientId/identity-review', requireRole('COORDINATEUR', 'ADMIN'), validate(schema.reviewIdentityDocument), ctrl.reviewIdentityDocument)

module.exports = router
