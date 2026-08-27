# Tests automatisés IMSOP

Deux suites, deux outils, deux commandes :

| Suite | Emplacement | Lancer | Ce qu'elle couvre |
| --- | --- | --- | --- |
| Backend | `backend/tests/` | `cd backend && npm test` | L'API Express réelle, via supertest, contre une vraie base PostgreSQL |
| Frontend | `src/**/*.test.js` | `npm test` (à la racine) | La logique de session cloisonnée par rôle, sous jsdom (Vitest) |

## Backend — préparation (une seule fois)

La suite backend écrit dans une base **dédiée**, `imsop_test`, jamais dans la base de développement.

```bash
docker compose up -d                                    # depuis backend/
docker exec backend-postgres-1 psql -U imsop -d postgres -c "CREATE DATABASE imsop_test"
DATABASE_URL="postgresql://imsop:imsop@localhost:5432/imsop_test?schema=public" npx prisma migrate deploy
```

La dernière commande est à rejouer après toute nouvelle migration : le schéma de
`imsop_test` doit suivre celui de développement, sinon les tests échouent sur des
colonnes manquantes.

La configuration des tests vit dans `backend/.env.test`, **versionné et sans
aucun secret réel** : la suite doit être reproductible sur n'importe quelle
machine. Les vrais secrets restent dans `backend/.env`, hors dépôt.

### Le garde-fou à ne pas contourner

`tests/helpers/env.js` refuse de démarrer si `DATABASE_URL` ne se termine pas par
`/imsop_test`, et si `NODE_ENV` ne vaut pas `test`. Ce n'est pas de la
paperasse : `viderBase()` fait un `TRUNCATE ... CASCADE` sur **toutes** les
tables applicatives entre chaque test. Pointée par erreur sur la base de
développement, la suite effacerait dossiers, documents, messages et journal
d'audit sans confirmation ni retour possible.

### Ce que `NODE_ENV=test` change dans le code applicatif

Trois endroits, tous volontairement conditionnés à `test` et jamais à un drapeau
maison qu'une variable d'environnement égarée pourrait activer en production :

- `src/middleware/rateLimit.js` — les limiteurs sont désactivés. La suite envoie
  des centaines de requêtes depuis une seule adresse de bouclage, ce que ces
  limiteurs existent précisément pour bloquer.
- `src/lib/mailer.js` — `sendMail` devient un no-op silencieux (en
  développement, il continue d'écrire dans `.dev-mailbox.log`).
- `src/app.js` — le journal d'accès morgan est coupé, sinon une ligne par
  requête enterre l'assertion qui a réellement échoué.

## Backend — exécution

```bash
cd backend
npm test
```

Environ une minute. Le runner est celui de Node (`node:test`), sans dépendance
supplémentaire ; seul supertest est ajouté.

`--test-concurrency=1` n'est pas une précaution de confort : les fichiers de
test partagent une base unique qu'ils vident entre chaque cas. En parallèle, un
fichier tronquerait les données d'un autre en pleine exécution.

Pour un seul fichier :

```bash
node --test tests/paiement.test.js
```

## Frontend

```bash
npm test          # une passe
npm run test:watch
```

Configuration dans `vitest.config.js`, séparée de `vite.config.js` à dessein :
ce dernier porte le durcissement du serveur de développement (`fs.deny`, CORS,
proxy), qu'on ne veut pas risquer de modifier en touchant aux tests.

## Le test `todo` de `paiement.test.js`

Un test est marqué `todo` et apparaît comme tel à chaque exécution :
*« le médecin traitant désigné est tenu à l'écart du volet financier »*.

C'est un écart réel entre le code et la documentation, pas un test inachevé.
`docs/ecarts-implementation.md` (§32) et `backend/README.md` affirment que le
médecin local n'a aucun accès au paiement ; or `GET /api/dossiers/:id/paiement/status`
ne pose aucun `requireRole` et autorise le médecin traitant désigné, qui reçoit
donc 200 là où la documentation promet 403.

Trancher demande un arbitrage produit — on peut défendre que le médecin traitant
suive l'avancement du paiement de son patient. Tant qu'il n'est pas rendu,
l'écart reste visible à chaque exécution plutôt que de dormir dans un document.
Le jour où la décision tombe : soit ajouter le contrôle de rôle et retirer le
`todo`, soit corriger les deux documents et supprimer le test.
