const express = require('express')
const { z } = require('zod')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const push = require('../services/pushService')
const env = require('../config/env')

const router = express.Router()

/**
 * La clé publique, que le navigateur réclame avant de s'abonner.
 *
 * Publique au sens propre : elle identifie le serveur, elle ne déchiffre rien.
 * Accessible sans authentification, parce que la page la demande avant même de
 * savoir si l'utilisateur acceptera.
 */
router.get('/cle', (req, res) => {
  const cle = env.push.publicKey
  if (!cle) {
    // Pas une erreur : les notifications sont simplement inactives sur cette
    // installation. La page le lira et n'affichera pas le bouton.
    return res.json({ disponible: false, cle: null })
  }
  res.json({ disponible: true, cle })
})

const abonnement = {
  body: z.object({
    endpoint: z.string().url().max(2000),
    keys: z.object({
      p256dh: z.string().min(10).max(200),
      auth: z.string().min(4).max(200),
    }),
  }).strict(),
}

router.post('/abonnements', authenticate, validate(abonnement), async (req, res) => {
  await push.abonner(req.userId, req.body, req.get('user-agent'))
  res.status(201).json({ ok: true })
})

const desabonnement = {
  body: z.object({ endpoint: z.string().url().max(2000) }).strict(),
}

router.delete('/abonnements', authenticate, validate(desabonnement), async (req, res) => {
  // Ne supprime que les abonnements DE CET UTILISATEUR : sans le filtre, il
  // suffirait de connaître l'endpoint d'un tiers pour le faire taire.
  await push.desabonner(req.userId, req.body.endpoint)
  res.json({ ok: true })
})

module.exports = router
