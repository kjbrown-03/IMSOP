# IMSOP

Plateforme de deuxième avis médical international, et annuaire de mise en
relation avec des médecins de la zone CEMAC. En production sur
**https://imsop.org**, avec de vrais paiements.

La langue de travail est le **français** : code, commentaires, messages de
commit, échanges. Les identifiants techniques existants restent en anglais là
où ils le sont déjà — on ne renomme pas pour renommer.

Les notes accumulées au fil des sessions sont dans **`docs/memoire-projet/`** :
décisions de produit, pièges déjà payés, raisons derrière des choix qui
paraîtraient arbitraires. Elles ne sont pas chargées automatiquement — à lire
quand une question précise se pose.

Cinq fiches de sécurité en sont volontairement absentes, ce dépôt étant public.
Elles restent sur la machine de l'auteur.

---

## Les deux offres, à ne pas confondre

**Le deuxième avis** (le cœur). Un patient dépose un dossier — analyses,
imageries, comptes rendus — un spécialiste l'étudie et rédige un avis écrit.
Depuis novembre 2026, le patient choisit sa **portée** : `INTERNATIONAL`
(spécialiste étranger, à partir de 115 000 XAF) ou `LOCAL` (médecin CEMAC,
15 000 XAF). La portée se fixe au dépôt et ne change plus — la modifier
changerait le prix d'un dossier peut-être déjà payé.

**L'annuaire** (« le médecin le plus proche de vous »). Le patient décrit ses
symptômes, un dictionnaire en déduit les spécialités, et la plateforme propose
les médecins les plus proches. **On vend la MISE EN RELATION, jamais les
coordonnées.** Avant paiement, la fiche est floutée : ni nom, ni téléphone, ni
adresse. Cette règle gouverne tout le module.

Les deux voies se séparent aussi entre **médecine conventionnelle** et
**traditionnelle**, et ne se mélangent jamais dans une liste de résultats.

---

## Les rôles

| Rôle | Ce qu'il fait |
|---|---|
| `PATIENT` | dépose un dossier, paie, lit l'avis |
| `SPECIALISTE` | expert international, rédige les avis |
| `MEDECIN_LOCAL` | médecin traitant **et** médecin d'annuaire — un seul rôle pour les deux |
| `COORDINATEUR` | affecte les dossiers, habilite les praticiens, suit les délais |
| `ADMIN` | supervision, journal d'audit, statistiques |

`MEDECIN_LOCAL` recouvre deux réalités, et c'est voulu : un médecin peut suivre
ses propres patients **et** accepter d'être proposé à des inconnus. Trois
interrupteurs indépendants dans son espace, à ne pas confondre :

- `annuaireVisible` — « j'accepte d'être proposé à des patients »
- `avisLocalActif` — « j'accepte de rédiger des avis sur dossier »
- `valideParComite` — posé par la coordination, jamais par le médecin

Un médecin peut tenir trois places sur un dossier, à ne pas confondre non plus :
`medecinLocalId` (traitant, choisi par le patient), `demandeurMedecinId` (il pose
la question), `medecinRedacteurId` (il rédige l'avis local, affecté par la
coordination). `loadDossierWithAccessCheck` n'admet le rédacteur que sur les
routes qui passent `{ autoriserRedacteur: true }` : refus par défaut, sinon il
hériterait de tout ce qui a été écrit pour le médecin traitant. Patient et
rédacteur ne reçoivent jamais les coordonnées l'un de l'autre (`vueDuDossier`).

---

## Architecture

```
src/                 React 18 + Vite + Tailwind, i18n fr/en
  pages/<role>/      un dossier par rôle
backend/src/
  controllers/       logique métier
  routes/            montage + contrôle de rôle
  schemas/           validation zod
  services/          notifications, transcription, push, signalisation d'appel
  lib/               prisma, s3, triage, cemac
  middleware/        auth, rbac, limitation de débit
backend/prisma/      schéma + migrations
deploy/              compose de production, nginx, sauvegardes
```

Base PostgreSQL, stockage objet Garage (compatible S3), transcription vocale
locale par faster-whisper, TURN par coturn. Tout tourne sur **un seul VPS à
deux cœurs** : c'est la contrainte qui explique la plupart des arbitrages de
performance.

---

## Commandes

```bash
# Frontend
npm run dev            # développement
npm run build          # build + version du SW + pré-rendu légal + pré-compression
npm test               # vitest

# Backend
cd backend
npm run dev
npm test               # node --test, exige PostgreSQL sur imsop_test
npx prisma migrate deploy
```

**Les tests du backend effacent toutes les tables entre chaque test.** Ils
refusent de démarrer si `DATABASE_URL` ne pointe pas sur une base nommée
exactement `imsop_test`. Ne jamais les lancer contre la production.

---

## Déploiement

Le serveur est à `imsop@187.6.167.189`, dans `/opt/imsop`.

```bash
ssh imsop@187.6.167.189
cd /opt/imsop && git pull --ff-only
dcp() { docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production "$@"; }
dcp exec -T postgres pg_dump -U imsop imsop | gzip > /tmp/avant.sql.gz   # avant toute migration
dcp build backend && dcp run --rm -T backend npx prisma migrate deploy && dcp up -d backend
docker run --rm -v /opt/imsop:/app -w /app -u "$(id -u):$(id -g)" \
  -e HOME=/tmp -e npm_config_cache=/tmp/.npm node:22-alpine sh -c "npm run build"
```

**Vérifier le commit déployé, jamais le message du `pull`.** Un `git pull` qui
échoue affiche d'abord « Updating abc..def », qui ressemble à un succès ;
l'erreur vient après. Des déploiements ont été annoncés réussis pendant des
jours alors que le serveur n'avait pas bougé.

```bash
git rev-parse --short HEAD   # la seule preuve qui vaille
```

### Jouer les tests sans PostgreSQL local

Docker s'arrête souvent sur la machine de développement. Le serveur, lui, est
stable :

```bash
docker network create imsop-essais
docker run -d --name imsop-pg-essais --network imsop-essais \
  -e POSTGRES_USER=imsop -e POSTGRES_PASSWORD=essais -e POSTGRES_DB=imsop_test postgres:16-alpine
printf 'FROM node:22-alpine\nRUN apk add --no-cache openssl\n' > Dockerfile && docker build -t imsop-essais:node22 .
docker run --rm --network imsop-essais -v /opt/imsop:/app -w /app/backend -u "$(id -u):$(id -g)" \
  -e HOME=/tmp -e npm_config_cache=/tmp/.npm -e NODE_ENV=test \
  -e DATABASE_URL="postgresql://imsop:essais@imsop-pg-essais:5432/imsop_test?schema=public" \
  imsop-essais:node22 sh -c 'npm ci && npx prisma migrate deploy && npx prisma generate && npm test'
```

`openssl` dans l'image n'est pas un détail : sans lui le moteur Prisma ne
trouve pas `libssl` et **135 tests échouent** pour une raison qui n'a rien à
voir avec le code. `node:22-slim` ne marche pas non plus — Debian 12 fournit
OpenSSL 3 là où le moteur attend la 1.1.

---

## Pièges déjà payés

**Le réseau vers le VPS.** Depuis le wifi de l'auteur, le transit Cogent est
rompu : `ssh` et `curl` échouent sans que rien ne soit en panne. Passer par
Cloudflare WARP ou le partage de connexion du téléphone.

**Les ligatures françaises.** `normaliser()` dans `lib/triage.js` applique NFD
puis retire les diacritiques — mais NFD **ne décompose pas « œ »**. Un patient
écrivant « j'ai mal au cœur » n'obtenait aucun cardiologue. Les claviers de
téléphone composent la ligature automatiquement : tout dictionnaire comparant
du texte français doit traiter `œ` et `æ` explicitement.

**Le service worker et la compression.** L'API Cache range le corps **décodé**
en conservant `Content-Encoding: gzip`. Au rechargement le navigateur
décompresse deux fois, le bundle devient illisible, et l'application reste
bloquée sur son écran de démarrage. `/assets/` n'est donc plus intercepté du
tout, et tout ce qui est mis en cache passe par une fonction qui retire ces
en-têtes.

**La version du service worker** couvre `index.html` **et** `sw.js`. Sans cela,
corriger le service worker seul ne changeait pas le nom du cache : le cache
fautif survivait à sa propre correction.

**Les pages légales sont pré-rendues** (`scripts/prerendre-pages-legales.mjs`).
Le vérificateur OAuth de Google n'exécute pas le JavaScript et voyait une page
vide. nginx doit servir `$uri/index.html` **avant** `$uri/`, sinon il renvoie
une redirection 301 que certains vérificateurs ne suivent pas.

**Une session par rôle.** Le rôle actif se déduit du chemin (`/admin`,
`/medecin`…). Sur une page publique, il n'y en a pas : c'est le dernier espace
visité qui gagne. Un appel qui exige un rôle précis doit choisir sa session
explicitement, pas se fier à la session « active ».

**L'authentification optionnelle avale les jetons expirés.** Elle pose
`req.jetonRejete` ; une route qui exige un rôle doit répondre **401** dans ce
cas, sinon le renouvellement automatique du navigateur — qui ne guette que les
401 — ne se déclenche jamais.

**Les paiements sont idempotents, et doivent le rester.**
`confirmerPaiement` et `echouerPaiement` écrivent sous condition
(`updateMany` avec `status: { not: ... }`). Une lecture suivie d'une écriture
ne suffit pas : deux webhooks simultanés passeraient tous deux. Un rejeu
faisait reculer un dossier déjà affecté.

**Les tests de l'annuaire sont instables.** Résultats variables à code
identique. Ne pas conclure sur une seule exécution rouge.

---

## Règles de travail

**Rien en production sans tests verts.** Le paiement est en mode réel.

**Sauvegarder avant toute migration**, par `pg_dump`, sur le serveur.

**Les écrans doivent dire ce qui est vrai.** Un bouton qui échouera ne
s'affiche pas ; un délai se dit avant le formulaire, pas à l'écran de paiement ;
une notification ne porte aucun détail médical, parce qu'elle se lit sur un
écran verrouillé.

**Les commentaires expliquent POURQUOI**, pas ce que fait la ligne suivante.
Un défaut corrigé mérite une phrase sur ce qu'il cassait — c'est ce qui empêche
qu'on le réintroduise.

---

## Ce qui reste à faire

- **Avis local, reste à trancher** : le texte de consentement local doit être
  validé juridiquement, et les patients ayant déjà signé le texte international
  sur un dossier local n'ont pas consenti à cette transmission. Le rédacteur n'a
  ni messagerie ni appel avec la coordination.
- **SMS absents**, prévus au cahier des charges. Le manque le plus sensible
  pour un public camerounais.
- **Mentions légales incomplètes** : huit `[À COMPLÉTER]` dans
  `src/i18n/locales/*.json`, section `legal`. Obligatoires pour un service qui
  traite des données de santé, et Google les lit.
- **Adresse d'envoi des courriels** : `MAIL_FROM` vaut
  `no-reply@imsop.example.org` — un domaine d'exemple. Les messages partent
  réécrits depuis un Gmail personnel.
- **Pas d'analyse antivirus** sur les fichiers déposés.
