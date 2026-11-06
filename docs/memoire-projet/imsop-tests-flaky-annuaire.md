---
name: imsop-tests-flaky-annuaire
description: "tests/annuaire.test.js est instable : mêmes runs consécutifs donnent 18/18 puis 5 échecs — ne pas conclure à une régression sur un seul run rouge"
metadata:
  type: project
---

Constaté le 2026-09-24 : `node --test tests/annuaire.test.js` donne des résultats différents d'un run à l'autre **à code strictement identique** (observé 18/18, puis 12/6, 14/4, 9/9, puis 0 échec, puis 5 échecs). `tests/paiement.test.js` est resté vert (8 pass, 1 todo).

Les échecs se concentrent sur la suite « mise en relation par paiement » et prennent deux formes : `502 Bad Gateway` sur le paiement (le mock `globalThis.fetch` de `simulerFapshi()` n'est plus en place au moment de l'appel) et `Foreign key constraint violated: Patient_userId_fkey` (une ligne créée disparaît en cours de test). Les deux signent un **entrelacement des suites** : l'`afterEach` d'un bloc restaure `globalThis.fetch` et le `beforeEach(viderBase)` d'un autre tronque les tables pendant qu'un test asynchrone est encore en vol.

**Why:** j'ai d'abord cru à une régression de mes changements, puis à une autre session concurrente. Deux runs consécutifs (0 échec / 5 échecs) ont tranché : c'est l'instabilité de la suite. Cause non corrigée, seulement diagnostiquée.

**Piège à éviter :** isoler via `?schema=xxx` dans `DATABASE_URL` **ne fonctionne pas** — `tests/helpers/db.js` code en dur `schemaname = 'public'`, donc `viderBase()` tronque `public` pendant que l'app écrit ailleurs, et rien n'est nettoyé (symptôme : des fiches s'accumulent, « 12 !== 1 »). Le garde-fou de `tests/helpers/env.js` exige de toute façon une base nommée exactement `imsop_test`.

**How to apply:** ne jamais conclure à une régression sur un seul run rouge de ce fichier — relancer. Avant la mise en production réelle des paiements, corriger l'entrelacement (suites séquentielles, ou mock/nettoyage par fichier) : une suite qui ne passe qu'une fois sur deux ne protège pas le parcours de paiement. Voir [[imsop-annuaire-mise-en-relation]].
