const express = require('express')
const { authenticate } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const schema = require('../schemas/dossiers.schema')
const ctrl = require('../controllers/dossiers.controller')

const router = express.Router()
router.use(authenticate)

router.post('/', requireRole('PATIENT'), validate(schema.createDossier), ctrl.createDossier)

// Parcours medecin : le praticien ouvre lui-meme une demande de second avis.
router.post('/demande-medecin', requireRole('MEDECIN_LOCAL'), validate(schema.creerDemandeMedecin), ctrl.creerDemandeMedecin)
router.post('/:id/transmettre', requireRole('MEDECIN_LOCAL'), validate(schema.idParam), ctrl.transmettreDemandeMedecin)
router.get('/', validate(schema.listDossiers), ctrl.listDossiers)
// Avant les routes `/:id` : « en-cours » serait sinon interprété comme un
// identifiant de dossier.
router.get('/en-cours', requireRole('COORDINATEUR', 'ADMIN'), ctrl.listDossiersEnCours)
router.get('/:id', validate(schema.idParam), ctrl.getDossier)
router.patch('/:id', validate(schema.updateDossier), ctrl.updateDossier)
router.post('/:id/soumettre', requireRole('PATIENT'), validate(schema.idParam), ctrl.soumettreDossier)
router.post('/:id/assigner', requireRole('COORDINATEUR', 'ADMIN'), validate(schema.assignerSpecialiste), ctrl.assignerSpecialiste)
router.post('/:id/accepter', requireRole('SPECIALISTE'), validate(schema.idParam), ctrl.accepterDossier)
router.post('/:id/refuser', requireRole('SPECIALISTE'), validate(schema.refuserDossier), ctrl.refuserDossier)
router.post('/:id/conflit-interets', requireRole('SPECIALISTE'), validate(schema.declarerConflitInterets), ctrl.declarerConflitInterets)
router.post('/:id/analyser', requireRole('SPECIALISTE'), validate(schema.idParam), ctrl.demarrerAnalyse)
router.post('/:id/demander-complement', requireRole('SPECIALISTE'), validate(schema.demanderComplement), ctrl.demanderComplement)
router.post('/:id/complement-fourni', requireRole('PATIENT', 'MEDECIN_LOCAL', 'COORDINATEUR', 'ADMIN'), validate(schema.idParam), ctrl.complementFourni)
router.post('/:id/statut', requireRole('COORDINATEUR', 'ADMIN'), validate(schema.changerStatut), ctrl.changerStatut)
router.post('/:id/medecin-local', requireRole('PATIENT'), validate(schema.designerMedecinLocal), ctrl.designerMedecinLocal)
router.delete('/:id/medecin-local', requireRole('PATIENT'), validate(schema.idParam), ctrl.retirerMedecinLocal)
router.post('/:id/question-medecin-local', requireRole('MEDECIN_LOCAL'), validate(schema.poserQuestionMedecinLocal), ctrl.poserQuestionMedecinLocal)

module.exports = router
