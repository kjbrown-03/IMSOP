const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/rapports.schema')
const ctrl = require('../controllers/rapports.controller')

const dossierScoped = express.Router({ mergeParams: true })
dossierScoped.use(authenticate)
dossierScoped.get('/', validate(schema.dossierScoped), ctrl.getRapport)
dossierScoped.put('/', validate(schema.upsertBrouillon), ctrl.upsertBrouillon)
dossierScoped.post('/soumettre', validate(schema.dossierScoped), ctrl.soumettreRapport)

const idScoped = express.Router()
idScoped.use(authenticate)
idScoped.post('/:id/valider', requireRole('COORDINATEUR', 'ADMIN'), validate(schema.idScoped), ctrl.validerRapport)
idScoped.get('/:id/pdf', validate(schema.idScoped), ctrl.downloadRapportPdf)

module.exports = { dossierScoped, idScoped }
