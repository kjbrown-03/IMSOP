require('./env')
const request = require('supertest')
const app = require('../../src/app')
const { signAccessToken } = require('../../src/middleware/auth')

// L'application Express est testée telle quelle, sans `listen()` : supertest
// ouvre un port éphémère par requête. On traverse donc la vraie chaîne
// authenticate -> requireRole -> validate -> contrôleur, sans rien simuler.
const api = () => request(app)

// Les comptes autres que patient exigent une 2FA dont le code n'est lisible
// que dans les logs. Plutôt que de le récupérer par un détour fragile, on
// signe le jeton avec la fonction de l'application elle-même : c'est
// exactement ce que produirait une connexion complète, et le middleware
// `authenticate` le vérifie sans traitement de faveur. Le parcours de
// connexion, lui, est couvert de bout en bout dans auth.test.js.
const entete = (user) => `Bearer ${signAccessToken(user)}`

module.exports = { api, app, entete }
