# Sauvegardes IMSOP

Ce document décrit ce qui est sauvegardé, où, et comment restaurer. La partie
qui compte est la restauration : une sauvegarde qu'on n'a jamais su relire n'est
pas une sauvegarde.

## Ce qui est sauvegardé

Deux choses, parce que ce sont les deux seules dont la perte est irréparable :

| Quoi | Où ça vit | Comment c'est sauvegardé |
|---|---|---|
| La base PostgreSQL | volume Docker `pg_data` | `pg_dump -Fc` vers `deploy/backups/courant/base.dump` |
| Les documents | Garage, volumes `garage_meta` + `garage_data` | miroir vers `deploy/backups/courant/documents/` |

Les documents sont les pièces déposées par les patients et les professionnels
(CV, justificatifs, examens) et les PDF de rapports et de consentement.

Tout le reste se reconstruit : le code vient du dépôt Git, les images Docker se
rebâtissent, la configuration a son modèle versionné.

## Où partent les sauvegardes

Dans un dépôt **restic** distant, défini par `RESTIC_REPOSITORY` dans
`deploy/.env.sauvegarde`.

restic chiffre **avant** d'envoyer : l'hébergeur du dépôt ne voit que des blocs
opaques. C'est ce qui autorise des données de santé à quitter la machine.

> **La phrase de passe est irremplaçable.** Sans `RESTIC_PASSWORD`, aucune
> restauration n'est possible, et personne — pas même l'hébergeur du dépôt — ne
> peut la régénérer. Gardez-en une copie **hors de ce serveur**.

L'historique est tenu par restic. Le disque local ne conserve qu'une seule copie,
dans `deploy/backups/courant/`, écrasée à chaque passage.

### Choisir une destination

Le seul critère qui compte : **ni le même disque, ni le même hébergeur** que la
production. Une sauvegarde qui disparaît avec la machine qu'elle protège n'en est
pas une.

Quelques options, toutes compatibles avec le script :

- **Backblaze B2** — le moins cher pour ce volume, compatible S3.
- **Cloudflare R2** — pas de frais de sortie, utile si une restauration complète
  doit être rapatriée.
- **Scaleway Object Storage** — hébergement européen, si c'est un critère.
- **Une autre machine en SFTP** — `sftp:utilisateur@machine:/chemin`.

## Mise en place

```bash
sudo apt install -y restic

cd /opt/imsop
cp deploy/.env.sauvegarde.example deploy/.env.sauvegarde
chmod 600 deploy/.env.sauvegarde
nano deploy/.env.sauvegarde          # dépôt, phrase de passe, clés

# Le dossier doit appartenir à l'utilisateur du conteneur (uid 1000).
sudo chown -R 1000:1000 deploy/backups

chmod +x deploy/sauvegarde-hors-site.sh
./deploy/sauvegarde-hors-site.sh      # premier passage, à la main

sudo cp deploy/systemd/imsop-sauvegarde.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now imsop-sauvegarde.timer
```

Vérifier que la planification est prise en compte :

```bash
systemctl list-timers imsop-sauvegarde.timer
```

## Surveiller

```bash
# Le dernier passage s'est-il bien terminé ?
systemctl status imsop-sauvegarde.service

# Son journal
journalctl -u imsop-sauvegarde.service -n 50

# Les points de restauration disponibles
cd /opt/imsop && set -a && source deploy/.env.sauvegarde && set +a
restic snapshots --tag imsop
```

> Une sauvegarde silencieuse n'est pas une sauvegarde réussie. La tâche interne
> à l'application a échoué chaque nuit pendant des semaines sans que rien ne le
> signale : regardez `systemctl status` de temps en temps, ou branchez-y une
> alerte.

## Restaurer

### Préparer l'accès au dépôt

```bash
cd /opt/imsop
set -a && source deploy/.env.sauvegarde && set +a
restic snapshots --tag imsop        # choisir l'identifiant du point voulu
```

### Restaurer les fichiers

```bash
restic restore <identifiant> --target /tmp/restauration
```

On obtient `/tmp/restauration/opt/imsop/deploy/backups/courant/` avec
`base.dump` et `documents/`.

### Remettre la base en place

> Cette opération **écrase** la base en cours. Arrêtez le backend d'abord, pour
> qu'il n'écrive pas pendant la restauration.

```bash
dc stop backend

# pg_restore --clean supprime les objets avant de les recréer : sans ça, la
# restauration échoue sur tout ce qui existe déjà.
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.production \
  exec -T postgres pg_restore -U imsop -d imsop --clean --if-exists \
  < /tmp/restauration/opt/imsop/deploy/backups/courant/base.dump

dc start backend
```

### Remettre les documents en place

Les documents se réinjectent dans Garage par l'API S3. Depuis le conteneur
backend, qui a déjà les identifiants et l'accès réseau :

```bash
dc cp /tmp/restauration/opt/imsop/deploy/backups/courant/documents backend:/app/restauration
dc exec backend node scripts/restaurer-documents.js /app/restauration
```

### Vérifier

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4000/api/health
dc logs backend --tail 30
```

Puis, dans l'application : ouvrir un dossier et un document déposé.

## Vérifier que les sauvegardes sont relisibles

`restic check` tourne à chaque passage et contrôle la cohérence des métadonnées.
Il ne relit pas les données elles-mêmes.

Une fois par mois, faites un passage qui en relit un échantillon :

```bash
./deploy/sauvegarde-hors-site.sh --verifier
```

Et au moins une fois, faites une **vraie** restauration sur une machine de test.
C'est le seul moyen de savoir que la procédure ci-dessus fonctionne, et le bon
moment pour s'en apercevoir n'est pas le jour où la production est perdue.

## Ce qui reste à faire

- Une alerte quand la sauvegarde échoue, plutôt qu'un `systemctl status` qu'on
  pense à consulter. Un `OnFailure=` systemd qui envoie un courriel suffirait.
- Une restauration de bout en bout sur machine de test, jamais encore faite.
