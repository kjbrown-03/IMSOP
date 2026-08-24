# IMSOP Backend

> Document fonctionnel de référence : [`docs/cahier-des-charges.md`](../docs/cahier-des-charges.md)
> — écarts code ↔ CDC : [`docs/ecarts-implementation.md`](../docs/ecarts-implementation.md)

API Node.js/Express + PostgreSQL (Prisma) + MinIO (documents) pour le MVP IMSOP.

## Démarrage

```bash
docker compose up -d          # Postgres (5432) + MinIO (9000/9001)
npm install
npm run prisma:migrate        # nom de migration: init
npm run db:seed               # crée patient/specialiste/coordinateur/admin de test
npm run dev                   # http://localhost:4000
```

Comptes de test (mot de passe défini par `SEED_PASSWORD` dans `.env`, ou généré aléatoirement et affiché dans les logs si absent) :
- `patient@imsop.dev`
- `specialiste@imsop.dev` (2FA activée)
- `medecin@imsop.dev` (2FA activée) — médecin traitant local
- `coordinateur@imsop.dev` (2FA activée)
- `admin@imsop.dev` (2FA activée)

En développement, le code 2FA n'est pas réellement envoyé par email : il est affiché dans les logs du serveur (`[2FA] Code for ...`).

## Sécurité — points non négociables déjà en place

- **Médecin local** : le patient désigne lui-même son médecin traitant sur un dossier (`POST /api/dossiers/:id/medecin-local`, par e-mail) et peut lui retirer l'accès à tout moment (`DELETE`). Le consentement `COMMUNICATION_MEDECIN` est écrit dans la même transaction, et l'accès est cloisonné au dossier désigné exactement comme celui du spécialiste.
- **RBAC** : `src/middleware/rbac.js` + `loadDossierWithAccessCheck` dans `dossiers.controller.js` — un patient ne voit que son dossier, un spécialiste que les dossiers qui lui sont assignés.
- **Audit trail** : `src/services/auditService.js`, appelé à chaque accès/modification sensible (consultation dossier, upload/téléchargement document, consentement, paiement, message, rapport).
- **Paiement** : `src/controllers/paiements.controller.js#webhook` ne débloque jamais un dossier sur la seule foi du retour frontend — il ré-interroge l'API CinetPay (`verifyTransaction`) avant de faire passer le statut du paiement à `PAYE`.
- **Mots de passe** : bcrypt (12 rounds). **JWT** : access token courte durée (15 min) + refresh token rotatif stocké haché en base.
- **Documents** : stockés dans MinIO (S3-compatible), jamais sur le disque de l'API ; seules les métadonnées sont en base Postgres.
- **Pièces jointes en messagerie** : `POST /api/dossiers/:id/messages/piece-jointe` (multipart). Le fichier devient un `Document` du dossier à part entière — même bucket, même piste d'audit, même téléchargement par URL signée — et le message pointe dessus. Une pièce déposée dans la conversation apparaît donc aussi dans le dossier que lit le spécialiste.
- **Messagerie** : fermeture automatique 14 jours après l'affectation du dossier (`Dossier.messagingClosesAt`, vérifié à l'envoi + cron quotidien `messagingCloseService.js`).
- **Validation d'entrée** : chaque route valide `body`/`query`/`params` avec un schéma Zod strict (`src/schemas/`, appliqué via `src/middleware/validate.js`) avant d'atteindre le contrôleur — rejet des champs inconnus et des types invalides en 400 plutôt qu'une 500 Prisma.
- **Rate limiting** : `src/middleware/rateLimit.js` limite les tentatives sur `/api/auth/*` (brute force) et sur le webhook CinetPay (anti-flood).
- **Pagination** : `GET /api/dossiers` et `GET /api/specialistes` sont paginés (`page`/`pageSize`, réponse `{ items, total, page, pageSize }`) pour rester performants quand le volume de dossiers grandit.

## Contrat à synchroniser avec le frontend

Le frontend (`src/lib/api.js`, `src/store/useAuthStore.js`) attend :
- `POST /api/auth/login` → `{ accessToken, refreshToken, user }` ou `{ twoFactorRequired: true, challengeToken }`
- `POST /api/auth/2fa/verify` → `{ accessToken, refreshToken, user }`
- `POST /api/auth/register/patient` → `{ accessToken, refreshToken, user }`
- Stockage local : `imsop_access_token`, `imsop_refresh_token`, `imsop_user`

Les pages patient/coordinateur/spécialiste utilisent encore des données statiques de démonstration (fidèles aux maquettes Stitch) : le branchement complet sur `/api/dossiers`, `/api/dossiers/:id/messages`, etc. est la prochaine étape d'intégration.

## Hors périmètre MVP (volontairement non implémenté)

Visioconférence, module assurance, IA, DICOM, multidevise, API hospitalières/FHIR — voir le cahier des charges, sections hors scope.
