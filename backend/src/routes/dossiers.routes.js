const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/dossiers.schema')
const ctrl = require('../controllers/dossiers.controller')

const router = express.Router()
router.use(authenticate)

router.post('/', requireRole('PATIENT'), validate(schema.createDossier), ctrl.createDossier)
router.get('/', validate(schema.listDossiers), ctrl.listDossiers)
router.get('/:id', validate(schema.idParam), ctrl.getDossier)
router.patch('/:id', validate(schema.updateDossier), ctrl.updateDossier)
router.post('/:id/soumettre', requireRole('PATIENT'), validate(schema.idParam), ctrl.soumettreDossier)
router.post('/:id/assigner', requireRole('COORDINATEUR', 'ADMIN'), validate(schema.assignerSpecialiste), ctrl.assignerSpecialiste)
router.post('/:id/accepter', requireRole('SPECIALISTE'), validate(schema.idParam), ctrl.accepterDossier)
router.post('/:id/refuser', requireRole('SPECIALISTE'), validate(schema.refuserDossier), ctrl.refuserDossier)
router.post('/:id/medecin-local', requireRole('PATIENT'), validate(schema.designerMedecinLocal), ctrl.designerMedecinLocal)
router.delete('/:id/medecin-local', requireRole('PATIENT'), validate(schema.idParam), ctrl.retirerMedecinLocal)

module.exports = router
