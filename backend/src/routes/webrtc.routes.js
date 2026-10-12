const express = require('express')
const { authenticate } = require('../middleware/auth')
const ctrl = require('../controllers/webrtc.controller')

const router = express.Router()

// Authentifiée sans exception : la réponse contient de quoi faire relayer du
// trafic par notre serveur TURN. Un point d'entrée ouvert reviendrait à offrir
// la bande passante du VPS au premier venu.
router.use(authenticate)

router.get('/ice', ctrl.listerServeursIce)

module.exports = router
