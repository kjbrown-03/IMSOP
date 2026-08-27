require('dotenv').config()

function required(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

// Un secret HS256 court se casse hors ligne : quiconque le retrouve peut forger
// un jeton pour n'importe quel compte, ADMIN compris, sans jamais toucher a la
// base. On vise au moins 32 caracteres aleatoires (~192 bits).
// En developpement on se contente d'avertir pour ne pas bloquer le travail ;
// en production le demarrage echoue, car un secret faible y est indefendable.
const LONGUEUR_MINIMALE_SECRET = 32

function secretFort(name, nodeEnv) {
  const value = required(name)
  if (value.length < LONGUEUR_MINIMALE_SECRET) {
    const probleme = `${name} fait ${value.length} caracteres, minimum recommande ${LONGUEUR_MINIMALE_SECRET}.`
    if (nodeEnv === 'production') {
      throw new Error(
        `${probleme} Generez-en un avec : node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`,
      )
    }
    console.warn(
      `[securite] ${probleme} A remplacer avant toute mise en production.`,
    )
  }
  return value
}

const nodeEnv = process.env.NODE_ENV || 'development'

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  jwt: {
    accessSecret: secretFort('JWT_ACCESS_SECRET', nodeEnv),
    refreshSecret: secretFort('JWT_REFRESH_SECRET', nodeEnv),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET || 'imsop-documents',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  },

  cinetpay: {
    apiKey: process.env.CINETPAY_API_KEY,
    siteId: process.env.CINETPAY_SITE_ID,
    secretKey: process.env.CINETPAY_SECRET_KEY,
    notifyUrl: process.env.CINETPAY_NOTIFY_URL,
    returnUrl: process.env.CINETPAY_RETURN_URL,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.MAIL_FROM || 'IMSOP <no-reply@imsop.org>',
  },

  messaging: {
    autoCloseDays: parseInt(process.env.MESSAGING_AUTO_CLOSE_DAYS || '14', 10),
  },

  // Optional: "Sign in with Google" only appears functional once these are
  // set. Without them the button still renders (existing frontend design)
  // but oauth.controller rejects the attempt with a clear message instead
  // of crashing, so a partial/dev deployment stays usable.
  oauth: {
    backendBaseUrl: process.env.BACKEND_BASE_URL || `http://localhost:${process.env.PORT || '4000'}`,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
}
