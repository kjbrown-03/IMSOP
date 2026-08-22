const express = require('express')
const { authenticate } = require('../middleware/auth')
const { upload, handleUploadErrors } = require('../middleware/upload')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/documents.schema')
const ctrl = require('../controllers/documents.controller')

const router = express.Router({ mergeParams: true })
router.use(authenticate)

router.post('/', upload.single('file'), handleUploadErrors, validate(schema.uploadDocument), ctrl.uploadDocument)
router.get('/', validate(schema.dossierScoped), ctrl.listDocuments)

module.exports = router
