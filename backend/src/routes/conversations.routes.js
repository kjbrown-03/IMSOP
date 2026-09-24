const express = require('express')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/conversations.schema')
const ctrl = require('../controllers/conversations.controller')

const router = express.Router()
router.use(authenticate)

// Déclaré avant /:id : sinon « destinataires » serait lu comme un identifiant.
router.get('/destinataires', validate(schema.rechercher), ctrl.rechercherDestinataires)

router.get('/', validate(schema.lister), ctrl.lister)
router.post('/', validate(schema.ouvrir), ctrl.ouvrir)
router.get('/:id/messages', validate(schema.idParam), ctrl.listerMessages)
router.post('/:id/messages', validate(schema.envoyerMessage), ctrl.envoyerMessage)

module.exports = router
