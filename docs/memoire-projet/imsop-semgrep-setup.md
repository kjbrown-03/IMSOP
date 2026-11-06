---
name: imsop-semgrep-setup
description: "Semgrep installé en complément de Herozion sur IMSOP — commande de scan, résultat de référence, faux positif connu"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20878eee-4c43-46c9-b106-92e17bb5b999
  modified: 2026-08-27T18:17:41.156Z
---

Semgrep (v1.175.0) est installé via `pip install semgrep` (Python 3.14 fonctionne pour ça malgré le souci séparé du binding `python3` dans l'extension Herozion). Ajouté à la demande de l'utilisateur en complément de [[imsop-security-scan-deferrals]] (Herozion), pas en remplacement.

**Commande de scan utilisée :**
```
cd IMSOP && semgrep --config p/security-audit --config p/secrets --config p/owasp-top-ten --exclude "stitch_imsop_medical_design_system" --exclude "node_modules" --exclude "dist" --exclude "backend/node_modules" --metrics=off
```

**Résultat de référence (2026-08-27) :** 1 seul finding sur 219 fichiers / 155 règles — nettement plus propre que les scores 0/F de Herozion sur le même repo (Herozion faisait beaucoup de faux positifs sans analyse cross-fichier).

**Faux positif confirmé :** `src/components/layout/AuthLayout.jsx:10` — `dangerouslySetInnerHTML={{ __html: heading }}`. Le seul appelant (`InscriptionMedecinLocal.jsx:54`) passe toujours `heading={t('medecin.register.title')}`, une clé i18n statique (`fr.json`/`en.json`), jamais une donnée utilisateur/BDD/URL. Semgrep ne fait pas de data-flow inter-fichiers donc ne peut pas le voir. À re-vérifier seulement si `AuthLayout` reçoit un jour un `heading` construit depuis une donnée dynamique — dans ce cas, sanitizer avec DOMPurify ou repasser en texte brut.

**Rulesets plus larges testés le 2026-08-27** (`p/javascript`, `p/react`, `p/nodejsscan`) — 10 findings, tous inoffensifs :
- 7x `good_*` (helmet headers, rate limiting) — ce sont des confirmations positives de bonnes pratiques déjà en place (`app.js`, `rateLimit.js`), pas des vulnérabilités.
- `sidebar.jsx:402` "insecure random generator" (`Math.random()`) — faux positif : sert juste à randomiser la largeur d'un skeleton loader (`SidebarMenuSkeleton`), aucun usage cryptographique.
- `InscriptionPatientSecurite.jsx:24` "timing attack" (`password !== confirmPassword`) — faux positif : comparaison 100% côté client de deux champs que l'utilisateur vient de taper lui-même dans son propre formulaire, rien n'est envoyé sur le réseau à ce moment, aucun oracle de timing possible.
- Même finding `AuthLayout.jsx` que ci-dessus.
- 2 timeout sur `chat-template.jsx` (règles ssrf_node / express_xss d'ajinabraham.njsscan) — le fichier est trop gros/complexe pour ces règles précises, pas un résultat, à ignorer.

**How to apply:** relancer la même commande à chaque nouveau scan demandé ; si le finding `AuthLayout.jsx` réapparaît sans changement de code, ne pas le re-analyser, c'est le même faux positif. Pour un scan plus large occasionnel, ajouter `--config p/javascript --config p/react --config p/nodejsscan` à la commande de base.
