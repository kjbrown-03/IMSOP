const multer = require('multer')

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/dicom',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const err = new Error('Format de fichier non autorisé (PDF, JPEG, PNG ou DICOM uniquement)')
      err.status = 400
      return cb(err)
    }
    cb(null, true)
  },
})

// Profile pictures are displayed inline in <img> tags, so the formats are
// restricted to what every browser renders natively - no PDF, no DICOM.
const AVATAR_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!AVATAR_MIME_TYPES.has(file.mimetype)) {
      const err = new Error("Format d'image non autorisé (JPEG, PNG ou WebP uniquement)")
      err.status = 400
      return cb(err)
    }
    cb(null, true)
  },
})

// multer's own limit errors (LIMIT_FILE_SIZE, etc.) are MulterError instances
// without a .status, so they'd otherwise fall through to the generic 500.
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    err.status = 400
    // Each upload route sets its own ceiling, so the message has to follow it
    // rather than quote the 25 Mo of the document uploader everywhere.
    const limitLabel = req.maxUploadLabel || '25 Mo'
    err.message = err.code === 'LIMIT_FILE_SIZE' ? `Fichier trop volumineux (${limitLabel} maximum)` : err.message
  }
  next(err)
}

module.exports = { upload, avatarUpload, handleUploadErrors }
