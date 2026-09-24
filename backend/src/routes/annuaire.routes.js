const express = require('express')
const { authenticate, authenticateOptional } = require('../middleware/auth')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const { rechercheAnnuaireLimiter } = require('../middleware/rateLimit')
const schema = require('../schemas/annuaire.schema')
const ctrl = require('../controllers/annuaire.controller')

const router = express.Router()

// Référentiels (pays, villes, spécialités, tarif) : publics, le formulaire de
// recherche en a besoin avant toute connexion.
router.get('/referentiels', ctrl.referentiels)

// La recherche est ouverte à tous - c'est ce qui donne envie - mais plafonnée
// en débit, et elle se rattache au compte s'il y en a un.
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
