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

// Message vocal décrivant des symptômes. Stocké en mémoire comme le reste, et
// jamais écrit sur disque : il n'est conservé que le temps de la transcription,
// puis le texte seul subsiste.
//
// Les formats dépendent du navigateur et non d'un choix de notre part :
// Chrome et Android enregistrent en WebM/Opus, Safari et iOS en MP4/AAC,
// Firefox en Ogg. Le type arrive souvent suffixé (« audio/webm;codecs=opus »),
// d'où la comparaison sur la partie qui précède le point-virgule.
const AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/aac',
])

// 8 Mo : environ dix minutes d'Opus, soit bien au-delà d'une description de
// symptômes. La durée réelle est bornée côté navigateur, cette limite-ci ne
// sert qu'à ce qu'un envoi forgé ne remplisse pas la mémoire du serveur.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const base = (file.mimetype || '').split(';')[0].trim().toLowerCase()
    if (!AUDIO_MIME_TYPES.has(base)) {
      const err = new Error("Format audio non autorisé")
      err.status = 400
      return cb(err)
    }
    cb(null, true)
  },
})

// Candidature : deux fichiers de natures différentes dans le même envoi. La
// photo s'affiche dans une balise <img> (donc les formats du navigateur), le CV
// se lit et s'imprime (donc PDF). Le contrôle porte sur le champ, pas sur une
// liste commune qui laisserait passer un PDF en guise de portrait.
const CANDIDATURE_MIME = {
  photo: new Set(['image/jpeg', 'image/png', 'image/webp']),
  cv: new Set(['application/pdf']),
}

const candidatureUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const autorises = CANDIDATURE_MIME[file.fieldname]
    if (!autorises || !autorises.has(file.mimetype)) {
      const err = new Error(
        file.fieldname === 'cv'
          ? 'Le CV doit être un fichier PDF'
          : "Format d'image non autorisé (JPEG, PNG ou WebP uniquement)",
      )
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

module.exports = { upload, avatarUpload, candidatureUpload, audioUpload, handleUploadErrors }
