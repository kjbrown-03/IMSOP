const path = require('path')
const dotenv = require('dotenv')

// À requérir en TOUT PREMIER dans chaque fichier de test, avant le moindre
// require de src/. `config/env.js` appelle `dotenv.config()` sur backend/.env ;
// or dotenv n'écrase jamais une variable déjà définie. Charger .env.test ici
// gagne donc sur .env sans avoir à le modifier ni à le déplacer.
dotenv.config({ path: path.join(__dirname, '..', '..', '.env.test') })

// Garde-fou non négociable.
//
// La suite vide TOUTES les tables entre chaque test. Pointée par erreur sur la
// base de développement — un .env.test absent, une variable d'environnement
// héritée du shell — elle effacerait les dossiers, les documents, les messages
// et le journal d'audit, sans confirmation et sans retour possible. On refuse
// donc de démarrer tant que la base ne s'appelle pas explicitement imsop_test.
const url = process.env.DATABASE_URL || ''
if (!/\/imsop_test(\?|$)/.test(url)) {
  throw new Error(
    'Tests interrompus : DATABASE_URL ne pointe pas sur la base imsop_test.\n' +
      `  Reçu : ${url || '(vide)'}\n` +
      "  Ces tests effacent toutes les tables — ils ne doivent jamais tourner sur une autre base.\n" +
      '  Vérifiez backend/.env.test, et créez la base si besoin :\n' +
      '    docker exec backend-postgres-1 psql -U imsop -d postgres -c "CREATE DATABASE imsop_test"',
  )
}

// NODE_ENV=test désactive aussi les limiteurs de débit (src/middleware/rateLimit.js)
// et met le mailer en mode silencieux (src/lib/mailer.js).
if (process.env.NODE_ENV !== 'test') {
  throw new Error(`Tests interrompus : NODE_ENV vaut "${process.env.NODE_ENV}" au lieu de "test".`)
}

module.exports = {}
