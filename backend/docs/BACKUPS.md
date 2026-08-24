# Sauvegardes IMSOP

## Ce qui est sauvegardé

1. **Base de données PostgreSQL** — patients, dossiers, messages, rapports, journal d'audit, tout.
2. **Documents (MinIO)** — examens téléversés par les patients, rapports PDF générés.

Les identifiants/secrets (`.env`) ne sont **jamais** sauvegardés par ce système — ils ne doivent jamais se retrouver dans un fichier de sauvegarde en clair.

## Où, et à quelle fréquence

- Automatique tous les jours à **2h du matin**, tant que le serveur backend tourne à ce moment-là (voir `src/services/backupService.js`).
- Manuel à tout moment : `npm run backup` (depuis `backend/`).
- Stockées dans `backend/backups/` par défaut (configurable via `BACKUP_DIR` dans `.env`).
- Conservées **14 jours** par défaut (`BACKUP_RETENTION_DAYS`), les plus anciennes sont supprimées automatiquement.

## ⚠️ Limite importante en local / pilote

Actuellement, les sauvegardes sont stockées **sur la même machine** que la base de données qu'elles protègent. C'est suffisant pour se remettre d'une erreur humaine (mauvaise commande, bug qui corrompt des données) mais **ça ne protège pas** contre :
- Une panne du disque dur / de la machine elle-même
- Un vol, un incendie, etc.

**Avant un vrai lancement en production**, il faut impérativement que les sauvegardes partent aussi **ailleurs** :
- Idéal : un bucket S3 (ou équivalent) dans une autre région, avec versioning activé
- Alternative plus simple : si vous hébergez la base sur un fournisseur managé (ex: Railway, Render, Supabase, AWS RDS), la plupart proposent des sauvegardes automatiques intégrées, off-site par défaut — dans ce cas, ce système de scripts reste utile en complément (restauration rapide en local, tests de restauration), mais la responsabilité principale peut reposer sur le fournisseur.

## Restaurer une sauvegarde

**⚠️ Opération destructive** : remplace toutes les données actuelles de la base par celles de la sauvegarde choisie.

```bash
cd backend
npm run restore
```

Restaure automatiquement la sauvegarde la plus récente. Pour en choisir une autre :

```bash
npm run restore -- backups/database/imsop-2026-08-20T02-00-00-000Z.dump
```

Une confirmation (`yes`) est demandée avant toute action.

Pour les documents (MinIO), la restauration est manuelle : les fichiers correspondants sont dans `backend/backups/documents/<horodatage>/`, à recopier dans le bucket si besoin (rare — les documents sont en général restaurés en même temps que la base, ce script protège surtout contre la perte du disque/volume MinIO).

## Tester une restauration (recommandé avant un vrai lancement)

Une sauvegarde qu'on n'a jamais testée n'est pas vraiment une sauvegarde. Avant de considérer ce système comme fiable :

1. `npm run backup` pour créer une sauvegarde fraîche
2. Créer quelques données de test supplémentaires (un nouveau dossier, un message)
3. `npm run restore` et confirmer
4. Vérifier que les données de test créées à l'étape 2 ont bien disparu (preuve que la restauration a réellement remplacé les données, pas juste "réussi" en apparence)

## Prérequis technique

Les scripts utilisent `docker compose exec` pour lancer `pg_dump`/`pg_restore` directement dans le conteneur Postgres — donc uniquement Docker est nécessaire sur la machine, pas d'installation séparée des outils PostgreSQL. Ils doivent être lancés depuis `backend/` avec les conteneurs (`docker compose up -d`) démarrés.
