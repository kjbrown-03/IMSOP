require('express-async-errors')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const env = require('./config/env')

const authRoutes = require('./routes/auth.routes')
const dossiersRoutes = require('./routes/dossiers.routes')
const documentsRoutes = require('./routes/documents.routes')
const documentDownloadRoutes = require('./routes/documentDownload.routes')
const consentementsRoutes = require('./routes/consentements.routes')
const consentementPdfRoutes = require('./routes/consentementPdf.routes')
const { dossierScoped: paiementDossierRoutes, webhookRouter: paiementWebhookRoutes } = require('./routes/paiements.routes')
const messagesRoutes = require('./routes/messages.routes')
const { dossierScoped: rapportDossierRoutes, idScoped: rapportIdRoutes } = require('./routes/rapports.routes')
const specialistesRoutes = require('./routes/specialistes.routes')
const candidaturesRoutes = require('./routes/candidatures.routes')
const conversationsRoutes = require('./routes/conversations.routes')
const specialitesRoutes = require('./routes/specialites.routes')
const honorairesRoutes = require('./routes/honoraires.routes')
const adminRoutes = require('./routes/admin.routes')
const patientsRoutes = require('./routes/patients.routes')
const professionnelsRoutes = require('./routes/professionnels.routes')
const notificationsRoutes = require('./routes/notifications.routes')
const usersRoutes = require('./routes/users.routes')
const oauthRoutes = require('./routes/oauth.routes')
const temoignagesRoutes = require('./routes/temoignages.routes')
const annuaireRoutes = require('./routes/annuaire.routes')

const { notFoundHandler, errorHandler } = require('./middleware/errorHandler')
const { apiLimiter } = require('./middleware/rateLimit')

const app = express()

// Piloté par l'environnement (voir config/env.js) : false en dev pour qu'un
// client ne puisse pas usurper X-Forwarded-For et contourner le rate-limit,
// 'loopback' en prod où seul nginx (127.0.0.1) est de confiance.
app.set('trust proxy', env.trustProxy)
app.use(helmet())
app.use(cors({ origin: env.corsOrigin, credentials: true }))
// Silenced under test: the suite issues hundreds of requests, and an access
// log line per request buries the assertion that actually failed.
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined', { skip: () => env.nodeEnv === 'test' }))

// CinetPay webhook must read the raw body before JSON parsing is scoped elsewhere,
// but express.json() as a global parser is fine since CinetPay posts JSON too.
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv, time: new Date().toISOString() })
})

// Applied after /api/health (uptime checks must never be throttled) and
// before every other route - the CinetPay webhook has its own dedicated
// limiter tuned for retry behavior, so it's excluded here.
// Monté sur une chaîne, pas une RegExp : en Express 4, app.use(regexp, ...) ne
// matche jamais, donc ce limiteur de base ne se déclenchait pas du tout. Le
// webhook CinetPay/Fapshi garde son propre limiteur adapté aux retries, exclu
// ici ; /api/health est traité au-dessus et n'atteint jamais ce point.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/paiements/webhook')) return next()
  return apiLimiter(req, res, next)
})

app.use('/api/auth', authRoutes)
app.use('/api/auth/oauth', oauthRoutes)
app.use('/api/dossiers', dossiersRoutes)
app.use('/api/dossiers/:dossierId/documents', documentsRoutes)
app.use('/api/documents', documentDownloadRoutes)
app.use('/api/dossiers/:dossierId/consentements', consentementsRoutes)
app.use('/api/consentement-pdf', consentementPdfRoutes)
app.use('/api/dossiers/:dossierId/paiement', paiementDossierRoutes)
app.use('/api/paiements', paiementWebhookRoutes)
app.use('/api/dossiers/:dossierId/messages', messagesRoutes)
app.use('/api/dossiers/:dossierId/rapport', rapportDossierRoutes)
app.use('/api/rapports', rapportIdRoutes)
app.use('/api/specialistes', specialistesRoutes)
app.use('/api/candidatures', candidaturesRoutes)
// Discussions directes, sans dossier : la coordination ouvre le fil.
app.use('/api/conversations', conversationsRoutes)
app.use('/api/specialites', specialitesRoutes)
app.use('/api/honoraires', honorairesRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/patients', patientsRoutes)
app.use('/api/professionnels', professionnelsRoutes)
app.use('/api/notifications', notificationsRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/temoignages', temoignagesRoutes)
app.use('/api/annuaire', annuaireRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

module.exports = app
