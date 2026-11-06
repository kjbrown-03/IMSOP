# Mémoire du projet IMSOP

Notes accumulées au fil des sessions : décisions de produit, pièges déjà payés,
raisons derrière des choix qui paraîtraient arbitraires en lisant seulement le
code.

**Ce dossier n'est pas chargé automatiquement.** Seul `CLAUDE.md`, à la racine,
l'est. Ces fiches sont là pour être lues quand une question précise se pose —
et pour survivre à un changement de machine, ce que la mémoire locale de Claude
ne fait pas : elle est rangée sous un dossier nommé d'après le chemin absolu du
projet.

**Cinq fiches manquent volontairement.** Elles portent sur la sécurité : failles
connues non corrigées, résultats d'un test d'intrusion, accès à
l'infrastructure, relais d'appels, sauvegardes. Ce dépôt est public — les
publier reviendrait à fournir une carte à qui voudrait s'en servir. Elles
restent sur la machine de l'auteur, sous
`~/.claude/projects/<chemin-du-projet>/memory/`.

---

- [IMSOP multi-sessions](imsop-multi-session-setup.md) — plusieurs agents sur le meme dossier, serveurs deja lances sur 4000/5173
- [Cahier des charges IMSOP](imsop-cahier-des-charges.md) — archivé dans docs/, avec l'analyse d'écarts
- [Checklist OAuth production IMSOP](imsop-oauth-production-checklist.md) — à traiter dès qu'on passe à l'hébergement réel (Google)
- [Semgrep IMSOP](imsop-semgrep-setup.md) — installé en complément de Herozion, commande de scan + 1 faux positif connu (AuthLayout.jsx)
- [Annuaire mise en relation](imsop-annuaire-mise-en-relation.md) — « Trouver un médecin » CEMAC : on vend la MISE EN RELATION, jamais les coordonnées ; décisions produit et garde-fous
- [Skills globaux ECC](skills-globaux-ecc.md) — 25 skills dans ~/.claude/skills pour tous les projets, install manuelle et non le plugin
- [Tests annuaire instables](imsop-tests-flaky-annuaire.md) — résultats variables à code identique, ne pas conclure sur un seul run rouge
- [Parcours inscription professionnels](imsop-parcours-inscription-professionnels.md) — médecin traitant = médecin proche (un seul rôle) ; qui passe par quelle porte, et pourquoi Habilitations est la charnière
- [Description vocale des symptômes](imsop-description-vocale.md) — transcription locale (faster-whisper), 3 garde-fous CPU, pas de langues locales
