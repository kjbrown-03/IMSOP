const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/messages.schema')
const ctrl = require('../controllers/messages.controller')

const router = express.Router({ mergeParams: true })
router.use(authenticate)

router.get('/', validate(schema.dossierScoped), ctrl.listMessages)
router.post('/', validate(schema.sendMessage), ctrl.sendMessage)

module.exports = router
