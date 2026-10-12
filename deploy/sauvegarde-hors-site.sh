#!/usr/bin/env bash
#
# Sauvegarde IMSOP vers un dépôt distant, chiffré.
#
# POURQUOI CE SCRIPT TOURNE SUR L'HÔTE ET NON DANS L'APPLICATION
#
# Les deux moitiés de la sauvegarde ne peuvent pas venir du même endroit :
#
#   - le dump PostgreSQL a besoin du client Docker pour entrer dans le conteneur
#     de la base ; le conteneur backend n'embarque pas Docker, et la tâche
#     planifiée qui y tournait échouait donc chaque nuit depuis la mise en
#     production, sans que personne ne le voie ;
#   - le miroir des documents a besoin d'atteindre Garage, qui ne publie aucun
#     port et n'est joignable que depuis le réseau Docker.
#
# D'où l'orchestration ici : pg_dump par `docker compose exec` sur la base,
# export des documents par `docker compose exec` sur le backend, puis envoi.
#
# CE QUI PART, ET SOUS QUELLE FORME
#
# restic chiffre côté client, avant tout envoi : l'hébergeur du dépôt distant ne
# voit que des blocs opaques. C'est la condition pour que des dossiers médicaux
# puissent quitter la machine. La phrase de passe est dans le fichier
# d'environnement ; SANS ELLE AUCUNE RESTAURATION N'EST POSSIBLE, il faut donc
# en garder une copie ailleurs que sur ce serveur.
#
# L'historique est tenu par restic, pas par une accumulation de dossiers datés
# sur le disque : la zone de préparation est écrasée à chaque passage et ne
# contient jamais plus d'une copie.
#
# Usage : ./sauvegarde-hors-site.sh [--verifier]
#   --verifier  vérifie en plus l'intégrité du dépôt distant (lent, mensuel)

set -euo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f ${RACINE}/deploy/docker-compose.prod.yml --env-file ${RACINE}/deploy/.env.production"
PREPARATION="${RACINE}/deploy/backups/courant"
ENV_SAUVEGARDE="${RACINE}/deploy/.env.sauvegarde"

# Le dump contient l'intégralité des données de santé. Tout ce que ce script
# écrit n'est lisible que par son propriétaire.
umask 077

echoerr() { printf '%s\n' "$*" >&2; }

if [[ ! -f "${ENV_SAUVEGARDE}" ]]; then
  echoerr "sauvegarde : ${ENV_SAUVEGARDE} est introuvable."
  echoerr "Copiez deploy/.env.sauvegarde.example, renseignez-le, puis chmod 600."
  exit 1
fi

# Un fichier lisible par d'autres comptes donnerait la phrase de passe du dépôt,
# donc l'accès en clair à toutes les sauvegardes.
droits="$(stat -c '%a' "${ENV_SAUVEGARDE}")"
if [[ "${droits}" != "600" && "${droits}" != "400" ]]; then
  echoerr "sauvegarde : ${ENV_SAUVEGARDE} est en ${droits}, attendu 600."
  echoerr "  chmod 600 ${ENV_SAUVEGARDE}"
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "${ENV_SAUVEGARDE}"; set +a

for variable in RESTIC_REPOSITORY RESTIC_PASSWORD; do
  if [[ -z "${!variable:-}" ]]; then
    echoerr "sauvegarde : ${variable} n'est pas renseignée dans ${ENV_SAUVEGARDE}."
    exit 1
  fi
done

if ! command -v restic >/dev/null 2>&1; then
  echoerr "sauvegarde : restic n'est pas installé (sudo apt install -y restic)."
  exit 1
fi

# Identifiants de la base : lus dans l'environnement de production plutôt que
# redéclarés, pour qu'ils ne puissent pas diverger.
POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "${RACINE}/deploy/.env.production" | cut -d= -f2-)"
POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "${RACINE}/deploy/.env.production" | cut -d= -f2-)"
: "${POSTGRES_USER:?POSTGRES_USER absent de deploy/.env.production}"
: "${POSTGRES_DB:?POSTGRES_DB absent de deploy/.env.production}"

GARDE_QUOTIDIEN="${SAUVEGARDE_GARDE_QUOTIDIEN:-14}"
GARDE_HEBDO="${SAUVEGARDE_GARDE_HEBDO:-8}"
GARDE_MENSUEL="${SAUVEGARDE_GARDE_MENSUEL:-12}"

journal() { printf '[sauvegarde] %s %s\n' "$(date -Is)" "$*"; }

journal "début"
mkdir -p "${PREPARATION}/documents"

# --- 1. Base de données -------------------------------------------------------
# Format personnalisé (-Fc) : compressé, et restaurable par pg_restore quel que
# soit l'ordre des tables. Écrit dans un fichier temporaire puis déplacé, pour
# qu'un échec en cours de route ne laisse pas un dump tronqué que restic
# enverrait comme s'il était valide.
journal "dump de la base ${POSTGRES_DB}"
# `< /dev/null` n'est pas superflu : `docker compose exec -T` lit l'entrée
# standard, et sans ça il consomme ce qui reste du script quand celui-ci est
# lui-même alimenté par un tuyau ou un here-document. Le dump réussit, puis la
# sauvegarde s'arrête en silence au milieu.
${COMPOSE} exec -T postgres pg_dump -U "${POSTGRES_USER}" -Fc "${POSTGRES_DB}" \
  < /dev/null > "${PREPARATION}/base.dump.partiel"
mv "${PREPARATION}/base.dump.partiel" "${PREPARATION}/base.dump"
journal "base : $(du -h "${PREPARATION}/base.dump" | cut -f1)"

# --- 2. Documents -------------------------------------------------------------
# Le miroir supprime les fichiers retirés du bucket : un document effacé à la
# demande d'un patient ne doit pas survivre dans la zone de préparation.
journal "miroir des documents"
${COMPOSE} exec -T backend node scripts/backup.js \
  --documents-vers /app/backups/courant/documents < /dev/null

# --- 3. Envoi -----------------------------------------------------------------
if ! restic cat config >/dev/null 2>&1; then
  journal "dépôt distant absent, initialisation"
  restic init
fi

journal "envoi vers ${RESTIC_REPOSITORY}"
restic backup "${PREPARATION}" --tag imsop --host imsop-prod

# --- 4. Rétention -------------------------------------------------------------
journal "élagage (${GARDE_QUOTIDIEN}j / ${GARDE_HEBDO}sem / ${GARDE_MENSUEL}mois)"
restic forget \
  --tag imsop \
  --keep-daily "${GARDE_QUOTIDIEN}" \
  --keep-weekly "${GARDE_HEBDO}" \
  --keep-monthly "${GARDE_MENSUEL}" \
  --prune

# --- 5. Vérification ----------------------------------------------------------
# Une sauvegarde qu'on n'a jamais relue n'est pas une sauvegarde. La vérification
# complète relit les données et coûte du temps et du transfert : elle est
# réservée au passage mensuel, déclenché par --verifier.
if [[ "${1:-}" == "--verifier" ]]; then
  journal "vérification de l'intégrité du dépôt"
  restic check --read-data-subset=10%
else
  restic check
fi

journal "terminé"
restic snapshots --tag imsop --latest 3
