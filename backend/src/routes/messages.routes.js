const express = require('express')
const { authenticate } = require('../middleware/auth')
const { upload, handleUploadErrors } = require('../middleware/upload')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/messages.schema')
const ctrl = require('../controllers/messages.controller')

const router = express.Router({ mergeParams: true })
router.use(authenticate)

router.get('/', validate(schema.dossierScoped), ctrl.listMessages)
router.post('/', validate(schema.sendMessage), ctrl.sendMessage)
// multer runs before validate: it is what turns the multipart payload into
// req.body, so the Zod schema would see an empty object otherwise.
router.post('/piece-jointe', upload.single('file'), handleUploadErrors, validate(schema.sendAttachment), ctrl.sendAttachment)

module.exports = router
