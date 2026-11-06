---
name: imsop-multi-session-setup
description: IMSOP est travaille en parallele par plusieurs sessions Claude + Antigravity ; serveurs dev deja lances (backend 4000, vite 5173)
metadata:
  type: project
---

Sur le projet IMSOP (c:\Users\USER\Downloads\IMSOP), au 2026-08-22 : plusieurs sessions Claude Code tournent en meme temps (3 sessions peer : imsop-fd, imsop-b1, imsop-19) plus l'IDE Antigravity, tous sur le meme repertoire de travail (pas de worktrees separes).

Serveurs de dev : backend Express/nodemon sur le port **4000** (`backend/`, `npm run dev`), frontend Vite sur **5173**. Ils sont deja lances en permanence.

**Why:** Relancer `npm run dev` depuis une deuxieme session provoque `EADDRINUSE :::4000` et laisse un nodemon fantome qui crashe a chaque sauvegarde de fichier backend. Et comme le depot n'a **aucun commit** (tout est untracked), deux agents qui editent le meme fichier ecrasent le travail l'un de l'autre sans filet de recuperation.

**How to apply:** Avant de lancer un serveur, verifier avec `netstat -ano | grep :4000` / `:5173` et reutiliser l'instance existante (curl http://localhost:4000/api/health). Toujours relire un fichier juste avant de l'editer (il a pu changer depuis). Preferer des edits cibles (Edit) plutot que des reecritures completes. Annoncer a l'utilisateur quels fichiers on va toucher.

**Regle du 2026-08-23 (demande explicite de l'utilisateur) :** l'utilisateur lance et arrete LUI-MEME le backend, dans son terminal VS Code (chaine `powershell.exe <- Code.exe`). Ne jamais lancer `npm run dev` dans `backend/`. Verifier `curl http://localhost:4000/api/health` et, si c'est eteint, le lui dire au lieu de demarrer un serveur.

Pour distinguer un backend lance par une session Claude d'un backend lance par l'utilisateur, remonter la chaine des parents : une session Claude finit par `bash.exe`, le terminal de l'utilisateur par `powershell.exe <- Code.exe`.
