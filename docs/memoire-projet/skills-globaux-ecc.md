---
name: skills-globaux-ecc
description: 25 skills ECC installés manuellement dans ~/.claude/skills (global, tous projets) — pas le plugin ecc@ecc
metadata:
  type: project
---

Le 2026-08-25, 25 skills sélectionnés du repo github.com/affaan-m/ECC ont été copiés manuellement dans `C:\Users\USER\.claude\skills\` — donc actifs sur **tous** les projets, pas seulement IMSOP.

Choix délibéré de **ne pas** installer le plugin complet `ecc@ecc` : il embarque 286 skills + 94 commandes + des hooks qui exécutent du code tiers à chaque événement du cycle de vie. Trop de bruit en contexte et surface de risque non nécessaire.

Détails à retenir :
- Les 25 skills sont du Markdown pur, zéro script exécutable — vérifié à l'install.
- `security-review` d'ECC a été renommé `ecc-security-review` (dossier + champ `name:`) car il entrait en collision avec le skill natif de Claude Code du même nom.
- `security-scan` d'ECC a été écarté volontairement : il ne fait que pousser `npx ecc-agentshield` avec ta clé ANTHROPIC_API_KEY.
- Le catalogue complet des 286 skills est archivé dans `C:\Users\USER\.claude\ECC-CATALOGUE.md` pour en piocher d'autres sans recloner.

**Why:** l'utilisateur voulait des skills réutilisables sur tous ses projets, pas une install massive liée à un seul repo.
**How to apply:** pour ajouter un skill ECC, consulter ECC-CATALOGUE.md puis copier le dossier dans `~/.claude/skills/`. Vérifier avant copie qu'il ne contient pas de script et qu'il n'y a pas de collision de nom avec un skill natif. Voir [[imsop-multi-session-setup]].
