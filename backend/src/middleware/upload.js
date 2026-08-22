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

// multer's own limit errors (LIMIT_FILE_SIZE, etc.) are MulterError instances
// without a .status, so they'd otherwise fall through to the generic 500.
function handleUploadErrors(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    err.status = 400
    err.message = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux (25 Mo maximum)' : err.message
  }
  next(err)
}

module.exports = { upload, handleUploadErrors }
