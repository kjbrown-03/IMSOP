#!/usr/bin/env bash
#
# Prévient par courriel qu'une sauvegarde a échoué.
#
# Déclenché par systemd via `OnFailure=` sur imsop-sauvegarde.service — jamais
# appelé à la main en fonctionnement normal.
#
# POURQUOI CE SCRIPT EXISTE
#
# Les sauvegardes de cette plateforme ont échoué chaque nuit pendant des
# semaines sans que personne ne le sache : elles écrivaient leur erreur dans un
# journal que rien n'obligeait à lire. Le dispositif a été refait, mais cela ne
# change rien au fait qu'une sauvegarde silencieuse ressemble exactement à une
# sauvegarde qui marche. Tant qu'un échec ne réclame pas l'attention de
# quelqu'un, il faut considérer qu'il passera inaperçu.
#
# Le courriel part par le conteneur backend, qui détient déjà la configuration
# SMTP de l'application : pas de second agent de courrier à installer, pas de
# mot de passe recopié dans un deuxième fichier.

set -uo pipefail

RACINE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="docker compose -f ${RACINE}/deploy/docker-compose.prod.yml --env-file ${RACINE}/deploy/.env.production"
UNITE="${1:-imsop-sauvegarde.service}"

# Le destinataire se configure à côté du reste de la sauvegarde.
DESTINATAIRE=""
if [[ -f "${RACINE}/deploy/.env.sauvegarde" ]]; then
  DESTINATAIRE="$(grep -E '^SAUVEGARDE_ALERTE_EMAIL=' "${RACINE}/deploy/.env.sauvegarde" 2>/dev/null | cut -d= -f2- || true)"
fi

# Le journal porte la raison de l'échec. Sans lui, l'alerte dirait seulement que
# quelque chose s'est mal passé — ce qui obligerait à se connecter au serveur
# pour en savoir plus, c'est-à-dire exactement ce qu'on cherche à éviter.
CORPS="$(
  printf 'La sauvegarde IMSOP a echoue.\n\n'
  printf 'Machine : %s\n' "$(hostname)"
  printf 'Unite   : %s\n' "${UNITE}"
  printf 'Date    : %s\n\n' "$(date -Is)"
  printf -- '--- etat du service ---\n'
  systemctl status "${UNITE}" --no-pager --lines=0 2>&1 | head -12
  printf '\n--- journal (40 dernieres lignes) ---\n'
  journalctl -u "${UNITE}" -n 40 --no-pager 2>&1
  printf '\n--- a faire ---\n'
  printf 'Se connecter au serveur, puis :\n'
  printf '  cd /opt/imsop && ./deploy/sauvegarde-hors-site.sh\n'
  printf 'pour rejouer la sauvegarde et voir l erreur en direct.\n'
)"

# Le journal peut contenir des chemins de documents medicaux : il part a une
# adresse choisie dans la configuration, jamais ailleurs.
printf '%s' "${CORPS}" | ${COMPOSE} exec -T \
  ${DESTINATAIRE:+-e SAUVEGARDE_ALERTE_EMAIL="${DESTINATAIRE}"} \
  backend node scripts/alerte-exploitation.js "Echec de la sauvegarde hors site"
