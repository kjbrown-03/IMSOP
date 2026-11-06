---
name: imsop-oauth-production-checklist
description: Checklist a faire au moment ou IMSOP passe en production (hebergement reel) pour que le Social Login Google fonctionne pour de vrais utilisateurs
metadata: 
  node_type: memory
  type: project
  originSessionId: 20878eee-4c43-46c9-b106-92e17bb5b999
  modified: 2026-08-23T08:35:09.005Z
---

Sur IMSOP, le Social Login (Google uniquement — LinkedIn a ete retire a la demande de l'utilisateur le 2026-08-23, l'utilisateur ne voulait que Google — le code backend/frontend LinkedIn a ete supprime, ne pas le reintroduire sans qu'il le redemande explicitement) est implemente et fonctionnel en local via OAuth 2.0 / OIDC standard (voir [[imsop-multi-session-setup]] pour le contexte multi-sessions du projet), mais seulement pour du dev/test tant que le site n'est pas reellement heberge. Quand l'utilisateur annonce qu'on passe a l'hebergement/production, il faut proactivement traiter cette checklist sans attendre qu'il la redemande :

1. **Google Cloud Console** (Google Auth Platform) : mettre a jour l'URI de redirection du client OAuth Web (actuellement `http://localhost:4000/api/auth/oauth/google/callback`) vers l'URL de callback du domaine de production, ex. `https://api.imsop.com/api/auth/oauth/google/callback`.
2. **Publier l'app Google** : Google Auth Platform → Audience → "Publier l'application". Bloque tant que la section **Branding** n'est pas complete (nom d'app, email d'assistance, **URL de page d'accueil publique**, **URL de politique de confidentialite publique** — les deux doivent etre de vraies URLs accessibles, donc ca ne peut se faire qu'une fois le vrai domaine en place). Sans publication, seuls les emails ajoutes manuellement en "Test users" peuvent se connecter via Google — c'est independant de l'hebergement, une app non publiee reste bloquee meme en prod.
3. **backend/.env en production** : mettre a jour `BACKEND_BASE_URL` (utilise pour construire le redirect_uri OAuth) et `CORS_ORIGIN` (utilise pour la redirection finale vers le frontend apres OAuth) avec les vraies URLs de production, plus `GOOGLE_CLIENT_ID/SECRET` reels (deja crees, Google Client ID actuel se termine par `...q0nhejt.apps.googleusercontent.com`, projet Google Cloud `imsop-506407`).
4. Une page **politique de confidentialite** publique sur le site est un prerequis pour l'etape 2 — a construire (contenu RGPD/donnees de sante) avant de tenter de publier, si elle n'existe pas encore.

**Why:** Google exige des URLs publiques verifiables (pas localhost) pour completer le Branding et publier une app OAuth ; c'est facile a oublier car ca ne bloque rien en dev, mais casse silencieusement le Social Login pour les vrais utilisateurs si personne n'y pense au moment du deploiement.

**How to apply:** Des que l'utilisateur mentionne l'hebergement/mise en production reelle d'IMSOP, relire cette checklist et la traiter avant de considerer le Social Login pret pour de vrais utilisateurs.
