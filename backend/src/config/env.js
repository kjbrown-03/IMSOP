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

// Adresse d'écoute du backend. En production il vit DERRIÈRE nginx sur le même
// VPS : il n'écoute que la boucle locale (127.0.0.1), donc rien sur Internet ni
// sur le LAN ne l'atteint en direct - seul nginx lui parle. En dev on écoute
// partout (0.0.0.0) pour pouvoir tester depuis un téléphone sur le Wi-Fi.
const host = process.env.HOST || (nodeEnv === 'production' ? '127.0.0.1' : '0.0.0.0')

// Réglage `trust proxy` d'Express : décide à quel `X-Forwarded-For` on se fie
// pour connaître l'IP réelle (logs, rate-limit). Un mauvais réglage rend le
// rate-limit contournable en usurpant l'en-tête.
//  - dev : `false`, aucun proxy devant, on prend l'IP de la socket. Un client
//    ne peut donc PAS remettre son compteur à zéro en changeant l'en-tête.
//  - prod : `loopback`, nginx tourne sur le même hôte et écrase le XFF (voir
//    deploy/nginx/imsop.conf) ; on ne fait confiance qu'à 127.0.0.1.
// Surcharge possible via TRUST_PROXY (nombre de sauts, 'loopback', liste d'IP…).
function parseTrustProxy(raw, env) {
  if (raw === undefined || raw === '') return env === 'production' ? 'loopback' : false
  if (raw === 'false') return false
  if (raw === 'true') return true
  if (/^\d+$/.test(raw)) return parseInt(raw, 10)
  return raw
}

module.exports = {
  port: parseInt(process.env.PORT || '4000', 10),
  host,
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY, nodeEnv),
  nodeEnv,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Adresse publique du site, telle qu'on l'écrit dans un courriel. Distincte
  // de corsOrigin : en développement celle-ci vaut http://localhost:5173, qui
  // ne mène nulle part pour le médecin qui reçoit ses identifiants.
  publicUrl: (process.env.PUBLIC_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').replace(/\/+$/, ''),

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

  // Comité scientifique : des personnes physiques, sans compte sur la
  // plateforme. Chaque candidature remplie leur est envoyée par e-mail, avec la
  // photo en pièce jointe ; ils décident hors de l'application et transmettent
  // leur décision à la coordination.
  comite: {
    emails: (process.env.COMITE_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean),
  },

  // Tarifs d'un second avis, en XAF, par niveau d'urgence.
  //
  // Les anciennes valeurs (175 / 250 / 350) étaient des euros étiquetés XAF :
  // l'écran patient affichait 175 €, le serveur facturait 175 XAF, soit 27
  // centimes. Elles sont converties au taux fixe du franc CFA (1 € = 655,957
  // XAF) et arrondies. Le CDC §40 prévoit une grille par spécialité et type de
  // prestation ; d'ici là, trois montants réglables sans redéploiement.
  tarifs: {
    STANDARD: parseInt(process.env.TARIF_STANDARD_XAF || '115000', 10),
    PRIORITAIRE: parseInt(process.env.TARIF_PRIORITAIRE_XAF || '165000', 10),
    URGENT: parseInt(process.env.TARIF_URGENT_XAF || '230000', 10),
    // Commission de mise en relation « Trouver un médecin » : ce que le
    // patient paie pour que la plateforme le relie aux médecins vérifiés de sa
    // zone qui peuvent le recevoir. Entièrement conservée par la plateforme
    // (aucun reversement au médecin). Prix arrêté par la direction : 3000 XAF.
    ANNUAIRE: parseInt(process.env.TARIF_ANNUAIRE_XAF || '2000', 10),
    devise: 'XAF',
  },

  annuaire: {
    // Pays ou la mise en relation est reellement vendable, c'est-a-dire ou un
    // fournisseur de paiement est branche. Fapshi ne couvre que le Cameroun ;
    // ailleurs le patient irait jusqu'au bout du parcours pour se heurter a une
    // erreur de paiement. On preferer ne pas lui proposer la recherche du tout.
    //
    // Ouvrir un pays supplementaire = brancher son paiement D'ABORD, puis
    // ajouter son code ici (ANNUAIRE_PAYS_OUVERTS=cm,ga,cg).
    paysOuverts: (process.env.ANNUAIRE_PAYS_OUVERTS || 'cm')
      .split(',')
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean),
  },

  // Modèle économique : le demandeur paie en XAF, la plateforme retient une
  // commission, le reste revient au spécialiste dans sa devise.
  honoraires: {
    // Part retenue par la plateforme sur chaque transaction, en pourcentage.
    // La valeur par défaut est un point de départ, pas une décision : elle se
    // règle sans redéploiement.
    commissionPourcent: parseFloat(process.env.COMMISSION_PLATEFORME_POURCENT || '30'),
    // Unités de devise pour 1 euro. Le franc CFA est arrimé (655,957) et n'a
    // pas besoin d'être ici ; les autres sont à tenir à jour à la main.
    tauxParEuro: {
      CHF: parseFloat(process.env.TAUX_EUR_CHF || '0.94'),
      GBP: parseFloat(process.env.TAUX_EUR_GBP || '0.85'),
      USD: parseFloat(process.env.TAUX_EUR_USD || '1.08'),
      MAD: parseFloat(process.env.TAUX_EUR_MAD || '10.8'),
      TND: parseFloat(process.env.TAUX_EUR_TND || '3.35'),
      DZD: parseFloat(process.env.TAUX_EUR_DZD || '145'),
    },
  },

  // Fapshi : Mobile Money au Cameroun. Sans apiUser/apiKey le fournisseur est
  // ignoré et tout passe par CinetPay (voir paiements.controller.js).
  fapshi: {
    apiUser: process.env.FAPSHI_API_USER,
    apiKey: process.env.FAPSHI_API_KEY,
    webhookSecret: process.env.FAPSHI_WEBHOOK_SECRET,
    environnement: process.env.FAPSHI_ENV || 'sandbox',
    redirectUrl: process.env.FAPSHI_REDIRECT_URL || process.env.CINETPAY_RETURN_URL,
    // Décaissement (reversement aux spécialistes). Accès DISTINCTS de
    // l'encaissement : chez Fapshi, un service qui décaisse ne peut plus
    // encaisser. Il faut donc deux services, donc deux jeux de clés.
    payoutApiUser: process.env.FAPSHI_PAYOUT_API_USER,
    payoutApiKey: process.env.FAPSHI_PAYOUT_API_KEY,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.MAIL_FROM || 'IMSOP <no-reply@imsop.org>',
  },

  // Aucune passerelle n'est imposée : l'URL reçoit un POST JSON, ce qui couvre
  // les agrégateurs locaux comme les fournisseurs internationaux. Sans URL, le
  // canal SMS reste inactif (voir lib/sms.js).
  sms: {
    apiUrl: process.env.SMS_API_URL,
    apiToken: process.env.SMS_API_TOKEN,
    expediteur: process.env.SMS_SENDER || 'IMSOP',
    // Indicatif appliqué aux numéros saisis en format local. 237 = Cameroun,
    // pays d'exploitation de la plateforme.
    indicatifParDefaut: process.env.SMS_DEFAULT_COUNTRY_CODE || '237',
  },

  // Engagement de délai : le patient ou le médecin demandeur doit avoir sa
  // réponse dans ce délai, compté depuis l'affectation du spécialiste et arrêté
  // à la mise à disposition du rapport.
  delaiReponse: {
    heures: parseInt(process.env.DELAI_REPONSE_HEURES || '48', 10),
    // Mi-parcours : le moment où il reste assez de temps pour agir.
    alerteHeures: parseInt(process.env.DELAI_ALERTE_HEURES || '24', 10),
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

// Passage de Fapshi en argent reel : deux reglages, s'ils sont oublies, ne se
// voient qu'au premier vrai paiement — le patient debite, la mise en relation
// jamais debloquee. Ils se verifient donc au demarrage plutot qu'en clientele.
//
//  - Sans secret de webhook, webhookAuthentique() rejette TOUTE notification en
//    live (voir fapshi.service.js) : aucun paiement ne se confirme.
//  - Une URL de retour en localhost ou en tunnel ngrok renvoie le patient vers
//    une adresse qui n'existe pas depuis son telephone.
if (module.exports.fapshi.environnement === 'live' && module.exports.fapshi.apiUser && module.exports.fapshi.apiKey) {
  if (!module.exports.fapshi.webhookSecret) {
    throw new Error(
      'FAPSHI_ENV=live sans FAPSHI_WEBHOOK_SECRET : les webhooks seraient tous rejetes et aucun paiement ne serait confirme. ' +
        'Renseignez le secret defini dans le tableau de bord Fapshi.',
    )
  }
  const retour = module.exports.fapshi.redirectUrl || ''
  if (/localhost|127\.0\.0\.1|ngrok/i.test(retour)) {
    throw new Error(
      `FAPSHI_ENV=live avec FAPSHI_REDIRECT_URL=${retour} : cette adresse n'est pas joignable depuis le telephone du patient. ` +
        'Indiquez l\'URL publique du site.',
    )
  }
}
