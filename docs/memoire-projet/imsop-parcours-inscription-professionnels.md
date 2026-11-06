---
name: imsop-parcours-inscription-professionnels
description: "Qui s'inscrit comment chez IMSOP : le médecin traitant garde son inscription autonome, les spécialistes internationaux passent par la candidature — et « médecin proche » n'est pas un rôle distinct"
metadata:
  type: project
---

Mis au clair le 2026-09-30, après un aller-retour où j'avais supprimé puis rétabli l'écran Habilitations.

**Point de vocabulaire essentiel (source de confusion) :** « médecin traitant » et « médecin proche » (celui de l'annuaire « Trouver un médecin ») sont **le même rôle, le même compte** : `MEDECIN_LOCAL`, un seul modèle `MedecinLocal`. Il n'y a pas deux inscriptions possibles parce qu'il n'y a pas deux profils. Ce qui les sépare est un réglage : `annuaireVisible` (faux par défaut), que le médecin coche lui-même.

**Les deux portes d'entrée, telles qu'elles fonctionnent :**
- **Inscription autonome** (`/inscription/medecin` → `POST /auth/register/medecin-local`) : le compte naît `EN_VERIFICATION`. Le médecin peut déjà être désigné comme médecin traitant par un patient — le consentement qui ouvre le dossier appartient au patient, pas à la plateforme. Mais il **n'apparaît pas dans l'annuaire**.
- **Candidature** (formulaire public → comité scientifique → le coordinateur crée le compte) : le compte naît `VALIDE`. C'est la voie des spécialistes internationaux, qui n'ont jamais eu d'inscription autonome (`createLink: null` dans `AnimatedLogin.jsx`).

**L'écran Habilitations (`/coordinateur/habilitations`) est la charnière :** c'est le seul appelant de `/professionnels/verifications`, donc le seul moyen de faire passer un inscrit autonome de `EN_VERIFICATION` à `VALIDE` — et le seul moyen de **suspendre, révoquer ou faire expirer** une habilitation, y compris pour un compte né validé. Le supprimer enfermerait les inscrits autonomes dans un état insortable.

**Why:** l'utilisateur voulait que « le médecin proche et les spécialistes internationaux » passent par les formulaires, en gardant l'inscription autonome pour le médecin traitant. Comme c'est un seul rôle, la règle qui réalise réellement cette intention est : inscription autonome = médecin traitant seulement ; pour apparaître dans l'annuaire il faut `VALIDE` (donc passage par Habilitations ou par la candidature) **et** cocher `annuaireVisible`.

**Règles du formulaire de candidature (2026-10-12) :**
- « Parcours et motivations » a été retiré des DEUX formulaires : le CV dit la
  même chose. Le champ reste accepté côté serveur (facultatif, défaut `''`) parce
  que les candidatures déjà déposées en portent un ; l'e-mail au comité et
  l'écran de la coordination ne l'affichent que s'il est rempli.
- Médecine traditionnelle : le lieu d'exercice est **forcé à `CLINIQUE`** sans
  poser la question, et le **numéro d'ordre disparaît** (aucun ordre
  professionnel ne couvre encore cette pratique au Cameroun). Changer de voie
  efface les champs d'hôpital déjà saisis.

**Ce qui reste supprimé :** `RevueIdentites.jsx` + route `/coordinateur/identites` + libellé de navigation (validation des pièces d'identité **patient**, jugée inutile). Le téléversement côté patient existe toujours mais n'est plus examiné ; le badge « identité vérifiée » ne s'allumera jamais. Cela ne bloque aucun accès.

**How to apply:** ne jamais supprimer Habilitations sans fermer en même temps l'inscription autonome, et inversement. Voir [[imsop-annuaire-mise-en-relation]].
