const express = require('express')
const { authenticate } = require('../middleware/auth')
const { avatarUpload, handleUploadErrors } = require('../middleware/upload')
const { requireRole } = require('../middleware/rbac')
const { validate } = require('../middleware/validate')
const { z } = require('zod')
const ctrl = require('../controllers/users.controller')

// Au moins huit chiffres : c'est le numéro que le patient composera après avoir
// payé la mise en relation. Espaces, tirets, parenthèses et « + » tolérés.
const changerTelephone = {
  body: z.object({
    phone: z.string().trim().min(8).max(30)
      .regex(/^\+?[0-9 ().-]+$/, 'Numéro de téléphone invalide')
      .refine((v) => v.replace(/\D/g, '').length >= 8, 'Numéro de téléphone invalide'),
  }).strict(),
}

const router = express.Router()

// Serving comes first and without `authenticate`: the browser loads these from
// an <img> tag, which carries no Authorization header.
router.get('/avatar/:file', ctrl.serveAvatar)

// Available to every role - the avatar lives on User, not on a role profile.
router.post(
  '/me/avatar',
  authenticate,
  (req, res, next) => {
    req.maxUploadLabel = '5 Mo'
    next()
  },
  avatarUpload.single('file'),
  handleUploadErrors,
  ctrl.updateMyAvatar,
)
router.delete('/me/avatar', authenticate, ctrl.deleteMyAvatar)

// Le tradipraticien tient lui-même son numéro à jour : c'est le seul moyen pour
// un patient de le joindre, et il en change plus souvent que de cabinet.
router.patch('/me/telephone', authenticate, requireRole('TRADIPRATICIEN'), validate(changerTelephone), ctrl.changerMonTelephone)

module.exports = router
