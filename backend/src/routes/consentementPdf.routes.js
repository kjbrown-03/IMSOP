const express = require('express')
const { authenticate } = require('../middleware/auth')
const ctrl = require('../controllers/consentements.controller')

const router = express.Router()

// Formulaire vierge à lire avant d'accepter et de signer - aucune donnée
// de dossier, donc accessible à tout utilisateur connecté (patient comme
// médecin traitant en ont besoin avant même que leur dossier existe).
router.get('/', authenticate, ctrl.downloadBlankConsentementPdf)

module.exports = router
