const express = require('express')
const { z } = require('zod')
const { authenticate } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const { essaiNotificationLimiter } = require('../middleware/rateLimit')
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

/**
 * Envoie une notification d'essai a SOI-MEME.
 *
 * C'est le seul moyen honnete de verifier la chaine complete : les cles du
 * serveur, l'abonnement de l'appareil, le relais d'Apple ou de Google, le
 * service worker, et l'affichage. Tout le reste ne verifie que des morceaux.
 *
 * `req.userId` est impose : on ne peut pas s'en servir pour notifier autrui.
 */
router.post('/essai', authenticate, essaiNotificationLimiter, async (req, res) => {
  const r = await push.envoyer(req.userId, 'ESSAI', {})
  if (r.envoyes === 0) {
    // Aucun appareil joignable. Les causes possibles sont nombreuses — abonnement
    // revoque, application desinstallee, autorisation retiree — et l'utilisateur
    // n'a pas a les demeler : on lui dit que rien n'est parti, il reactivera.
    return res.status(409).json({
      ok: false,
      message: "Aucun appareil joignable. Réactivez les notifications sur cet appareil.",
    })
  }
  res.json({ ok: true, appareils: r.envoyes })
})

module.exports = router
