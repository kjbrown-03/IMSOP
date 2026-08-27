const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/notifications.schema')
const ctrl = require('../controllers/notifications.controller')

const router = express.Router()
router.use(authenticate)

router.get('/', validate(schema.list), ctrl.listNotifications)
router.post('/read-all', ctrl.markAllRead)
router.post('/dossier/:dossierId/read', validate(schema.dossierIdParam), ctrl.markReadByDossier)
router.post('/:id/read', validate(schema.idParam), ctrl.markRead)

module.exports = router
