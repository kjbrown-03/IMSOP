const express = require('express')
const ctrl = require('../controllers/oauth.controller')

// No `authenticate` here on purpose - this is the entry point for someone
// who isn't logged in yet. CSRF is covered by the signed `state` param
// (see oauth.controller) rather than a session that doesn't exist yet.
const router = express.Router()
router.get('/:provider', ctrl.startOAuth)
router.get('/:provider/callback', ctrl.oauthCallback)

module.exports = router
