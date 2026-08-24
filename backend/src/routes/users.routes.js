const express = require('express')
const { authenticate } = require('../middleware/auth')
const { avatarUpload, handleUploadErrors } = require('../middleware/upload')
const ctrl = require('../controllers/users.controller')

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

module.exports = router
