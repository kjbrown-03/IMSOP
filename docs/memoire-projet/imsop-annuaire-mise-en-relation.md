---
name: imsop-annuaire-mise-en-relation
description: "Annuaire « Trouver un médecin » (CEMAC) — ce que la plateforme vend est la MISE EN RELATION patient↔médecin, jamais les coordonnées ; décisions produit prises par l'utilisateur"
metadata: 
  node_type: memory
  type: project
  originSessionId: 20878eee-4c43-46c9-b106-92e17bb5b999
  modified: 2026-09-24T00:00:00.000Z
---

Deuxième ligne de produit à côté du second avis, construite le 2026-09-17 : un patient décrit ses symptômes, la plateforme cherche parmi les médecins traitants CEMAC volontaires et habilités, montre un nombre + des fiches floutées, le patient paie, les coordonnées apparaissent.

**Cadrage imposé par l'utilisateur (correction explicite, à respecter dans tout texte, commentaire ou message) :** ce que le patient paie est la **mise en relation** — le travail de la plateforme qui le relie aux bons médecins. On ne « vend pas des coordonnées », on ne « donne pas accès à un annuaire ». Les coordonnées sont le résultat visible du service, pas la marchandise. C'est aussi la meilleure position juridique (service de mise en relation ≠ publicité médicale ≠ commerce de données).

**Why:** l'utilisateur a repris ma première formulation (« accès aux coordonnées », « contact vendu ») : « je ne vends pas les coordonnées, je vends cette liaison que je crée ». Le modèle économique et le positionnement en dépendent.

**Décisions produit prises par l'utilisateur (AskUserQuestion, 2026-09-17) :**
- Le médecin ne touche rien : commission 100 % plateforme.
- **Prix arrêté le 2026-09-24 : 3000 XAF** (`TARIF_ANNUAIRE_XAF`, défaut mis à 3000 dans env.js). Ce n'est plus un placeholder.
- **Lancement Cameroun d'abord (2026-09-24)** : `ANNUAIRE_PAYS_OUVERTS=cm`. Fapshi ne couvre que le Cameroun et les clés CinetPay sont encore `change-me`, donc les 5 autres pays CEMAC sont masqués du formulaire et refusés côté API. Rouvrir un pays = brancher son paiement AVANT d'ajouter son code. PawaPay (couvre cm/cg/ga) est le candidat identifié pour la suite ; LigdiCash ne couvre aucun pays CEMAC (zone UEMOA + RD Congo, à ne pas confondre avec Congo-Brazzaville).
- Après mise en relation : coordonnées seulement (tél, e-mail, établissement, pays·ville·quartier), pas de messagerie in-app.
- Seuls les MEDECIN_LOCAL en zone CEMAC apparaissent ; les spécialistes internationaux restent sur le parcours second avis. Les deux portes coexistent sur l'accueil.

**Garde-fous non négociables que j'ai posés :** opt-in explicite du médecin (`annuaireVisible`, faux par défaut, exige habilitation VALIDE + code pays CEMAC + ≥1 spécialité) ; détection d'urgence dans les symptômes (`lib/triage.js`) → aucune mise en relation payante, orientation vers les urgences ; jamais de paiement sans résultat ; résultats figés à la recherche (`RechercheAnnuaireResultat`) pour que le paiement débloque exactement ce qui a été montré ; fiches floutées = aucune donnée de contact transmise au navigateur.

**How to apply:** toute nouvelle fonctionnalité ou texte autour de l'annuaire doit parler de « mise en relation » / « être relié » / « connect ». Le point juridique (Ordre des médecins, publicité médicale) reste à vérifier par l'utilisateur avant lancement — je l'ai signalé, il n'a pas tranché.
