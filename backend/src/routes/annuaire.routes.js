const express = require('express')
const { authenticate, authenticateOptional } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const { rechercheAnnuaireLimiter, transcriptionLimiter } = require('../middleware/rateLimit')
const { audioUpload, handleUploadErrors } = require('../middleware/upload')
const schema = require('../schemas/annuaire.schema')
const ctrl = require('../controllers/annuaire.controller')

const router = express.Router()

// Référentiels (pays, villes, spécialités, tarif) : publics, le formulaire de
// recherche en a besoin avant toute connexion.
router.get('/referentiels', ctrl.referentiels)

// La recherche est ouverte à tous - c'est ce qui donne envie - mais plafonnée
// en débit, et elle se rattache au compte s'il y en a un.
// Description vocale des symptomes. Publique comme la recherche qu'elle alimente
// — on ne demande pas de compte pour dire ou on a mal — mais c'est le seul point
// d'entree qui occupe un coeur entier pendant plusieurs secondes, d'ou son
// plafond propre et le verrou de concurrence dans transcriptionService.
router.post(
  '/transcription',
  transcriptionLimiter,
  // Sans ça, un envoi trop lourd parlerait des 25 Mo du téléversement de
  // documents, qui n'est pas la limite appliquée ici.
  (req, res, next) => {
    req.maxUploadLabel = '8 Mo'
    next()
  },
  audioUpload.single('audio'),
  handleUploadErrors,
  ctrl.transcrireSymptomes,
)

router.post('/recherches', rechercheAnnuaireLimiter, authenticateOptional, validate(schema.rechercher), ctrl.rechercher)

// Lecture d'une recherche : anonyme tant qu'elle n'est rattachée à personne
// (fiches floutées seulement), réservée à son compte ensuite.
router.get('/recherches/:id', authenticateOptional, validate(schema.rechercheParId), ctrl.consulter)

// Payer ne demande pas de compte : un e-mail suffit (voir le schéma). Une
// session, si elle existe, rattache simplement la recherche au compte.
router.post('/recherches/:id/paiement', authenticateOptional, validate(schema.initierPaiement), ctrl.initierPaiement)
router.post('/recherches/:id/paiement/simulate', authenticateOptional, validate(schema.rechercheParId), ctrl.simulerPaiement)

// Réglages du médecin pour l'annuaire.
router.get('/medecin/moi', authenticate, requireRole('MEDECIN_LOCAL'), ctrl.monAnnuaire)
router.put('/medecin/moi', authenticate, requireRole('MEDECIN_LOCAL'), validate(schema.mettreAJourAnnuaire), ctrl.mettreAJourAnnuaire)

module.exports = router
