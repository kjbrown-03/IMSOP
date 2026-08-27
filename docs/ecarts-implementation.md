# Écarts entre le cahier des charges et le code

Analyse du [cahier des charges v1.0](./cahier-des-charges.md) confrontée au code au
**22 août 2026**. Les références `§` renvoient aux sections du CDC.

Périmètre de la comparaison : le CDC décrit la cible complète (MVP + phases 2 et 3).
Ce document ne liste donc pas « ce qui manque » dans l'absolu — le module assurance
ou la visioconférence sont explicitement **phase 2** (§50) — mais **les écarts sur le
périmètre MVP défini au §49** et **les endroits où le code contredit le CDC**.

---

> **Mise à jour du 23 août 2026** — les trois écarts prioritaires (§1.1 références,
> §1.2 statuts, §2.3 vérification des professionnels) ont été corrigés, ainsi que
> le §1.3 (5ᵉ consentement). Les sections concernées portent la mention **CORRIGÉ**
> et décrivent l'état actuel. Restent ouverts : §1.4 conflit d'intérêts, la lecture
> du consentement courant, et les points transverses du §3.

## 1. Contradictions à corriger

Ces points ne sont pas des fonctionnalités manquantes : le code fait quelque chose de
différent de ce que le CDC prescrit.

### 1.1 Format du numéro de dossier — §11 — **CORRIGÉ**

Les références sont désormais séquentielles : `MSO-2026-CM-000001`, produites par
[`referenceService.js`](../backend/src/services/referenceService.js) à partir d'une
table `SequenceCompteur` incrémentée par un seul `INSERT ... ON CONFLICT DO UPDATE`
— donc atomique côté Postgres. Vérifié : 250 références consécutives sans collision,
et 60 appels concurrents produisent 60 numéros distincts. `patientRef` suit le même
mécanisme (`IMS-2026-000001`).

<details><summary>Constat d'origine</summary>


| | |
|---|---|
| **CDC** | `MSO-2026-CM-000125` — préfixe MSO, **code pays**, compteur séquentiel sur 6 chiffres |
| **Code** | `MLA-2026-4662` — préfixe MLA, pas de pays, 4 chiffres **aléatoires** |
| **Fichier** | [dossiers.controller.js:46](../backend/src/controllers/dossiers.controller.js#L46) |

Deux problèmes distincts :

1. Le format ne correspond pas (préfixe, absence du code pays, longueur).
2. **`crypto.randomInt(1000, 9999)` sur une colonne `@unique` est un bug latent** :
   9 000 valeurs possibles seulement. Par le paradoxe des anniversaires, une collision
   devient probable autour de ~110 dossiers dans la même année, et se manifestera par
   une erreur 500 à la création. Le compteur séquentiel du CDC règle le problème.

Le même défaut existait sur `patientRef`, également `@unique`.
</details>

### 1.2 Statuts de dossier manquants — §53 — **CORRIGÉ**

Les 19 statuts du CDC sont en base. Les transitions associées :

- `accepter` → `ACCEPTE_PAR_SPECIALISTE`, puis `POST /:id/analyser` → `EN_ANALYSE` ;
- `POST /:id/demander-complement` → `INFORMATION_COMPLEMENTAIRE_DEMANDEE`, qui poste
  la demande dans la messagerie du dossier et notifie patient et médecin traitant ;
- `POST /:id/complement-fourni` → retour en `EN_ANALYSE` ;
- `POST /:id/statut` pour la coordination (`EN_ATTENTE_DOCUMENTS`, `SUIVI`,
  `CLOTURE`, `ANNULE`…), avec une liste blanche de transitions : un dossier
  `EN_ANALYSE` ne peut pas sauter à `SUIVI`.

<details><summary>Constat d'origine</summary>


`DossierStatus` compte 15 valeurs, le CDC en définit 19. Manquent :

| Statut CDC | Conséquence de l'absence |
|---|---|
| `EN_ATTENTE_DOCUMENTS` | Impossible de distinguer « incomplet faute de pièces » de `EN_VERIFICATION` |
| `ACCEPTE_PAR_SPECIALISTE` | §18 : l'acceptation fait passer directement à `EN_ANALYSE`, l'étape est invisible |
| `INFORMATION_COMPLEMENTAIRE_DEMANDEE` | §18 : le spécialiste ne peut pas renvoyer le dossier au coordinateur |
| `SUIVI` | §52 : pas d'état entre `RAPPORT_TRANSMIS` et `CLOTURE` |

`INFORMATION_COMPLEMENTAIRE_DEMANDEE` était le plus structurant : le §18 en fait une
des quatre actions possibles du spécialiste.
</details>

### 1.3 Consentements incomplets — §30 — **PARTIELLEMENT CORRIGÉ**

`UTILISATION_ANONYMISEE_RECHERCHE` a été ajouté : les 5 types du §30 existent.
**Reste ouvert** : aucune API ne lit « le consentement courant » (la ligne la plus
récente par `(dossierId, type)`).

<details><summary>Constat d'origine</summary>


`ConsentementType` couvre 4 des 5 types. Manque **l'utilisation anonymisée des données
à des fins statistiques / recherche**.

Par ailleurs le §30 exige que chaque consentement soit **révocable**. Le modèle
`Consentement` est append-only : la révocation est écrite comme une nouvelle ligne
`accepted: false` (c'est ce que fait `retirerMedecinLocal`). C'est défendable et même
préférable pour l'audit, mais **aucune API ne lit « le consentement courant »** — il
faut prendre la ligne la plus récente par `(dossierId, type)`.
</details>

### 1.4 Conflit d'intérêts — §14, §18

Le CDC en fait un critère du moteur d'affectation et une action du spécialiste
(« Déclarer un conflit d'intérêts → le dossier doit alors être réaffecté »).
Rien dans le schéma ni dans les routes.

---

## 2. Rôle « médecin traitant » — §5.2

Le rôle `MEDECIN_LOCAL` a été implémenté **avant** la lecture du CDC, à partir de deux
fragments trouvés dans le dépôt. Confrontation :

| Capacité §5.2 | État |
|---|---|
| Créer un compte professionnel | ✅ `/inscription/medecin`, 2FA obligatoire |
| Consulter les dossiers auxquels il est autorisé | ✅ cloisonné au dossier désigné |
| Transmettre les informations médicales | ✅ messagerie |
| Ajouter des comptes rendus | ✅ upload documents |
| Échanger avec le spécialiste international | ✅ messagerie partagée |
| Recevoir le rapport | ✅ *(uniquement une fois `VALIDE` — voir 2.2)* |
| Commenter ou demander des précisions | ✅ messagerie |
| **Enregistrer un patient avec son autorisation** | ❌ **non implémenté** |
| **Demander un deuxième avis** | ❌ **non implémenté** |

### 2.1 Le rattachement va dans un seul sens

Le modèle retenu est : **le patient désigne son médecin** par e-mail
(`POST /api/dossiers/:id/medecin-local`), et peut révoquer l'accès.

Le CDC décrit **aussi le sens inverse** : §5.2 « Enregistrer un patient avec son
autorisation » et §11 « Le patient **ou le médecin** doit pouvoir créer une demande ».
Il manque donc :

- une invitation médecin → patient (avec recueil de l'autorisation du patient) ;
- la création d'un dossier par le médecin (`POST /api/dossiers` est restreint à
  `requireRole('PATIENT')`).

Le sens implémenté reste conforme au §4.2 (le consentement du patient conditionne la
transmission) — il est simplement incomplet.

### 2.2 Correctif appliqué

`getRapport` et `downloadRapportPdf` ne masquaient les rapports non validés qu'au rôle
`PATIENT`. Le médecin traitant, destinataire du rapport final au même titre (§5.2, §32),
pouvait donc lire un **brouillon** ou un rapport en cours de contrôle — en contradiction
avec le §22 (`BROUILLON → SOUMIS → CONTRÔLE → VALIDÉ → TRANSMIS`).

Corrigé dans [rapports.controller.js](../backend/src/controllers/rapports.controller.js) :
la garde porte désormais sur `DESTINATAIRES_RAPPORT_FINAL = {PATIENT, MEDECIN_LOCAL}`.
Vérifié : rapport `VALIDE` → 200 pour les deux ; rapport `SOUMIS` → 403 pour les deux ;
le spécialiste garde l'accès à son brouillon.

### 2.3 Vérification du professionnel — §16 — **CORRIGÉ**

Le booléen `verified` a été remplacé, sur `Specialiste` comme sur `MedecinLocal`, par
le cycle `EN_VERIFICATION → VALIDE → SUSPENDU → EXPIRE → REVOQUE`, avec motif,
date de décision, auteur de la décision et date d'expiration de l'habilitation.
La migration a reporté les profils déjà vérifiés en `VALIDE`.

Le dépôt des justificatifs (`ProfessionalDocument` : diplôme, licence, numéro
d'ordre, pièce d'identité, CV, références) passe par
[`professionnels.controller.js`](../backend/src/controllers/professionnels.controller.js) :
même stockage objet, même URL signée, même piste d'audit que les documents de dossier.
Un justificatif n'est visible que de son propriétaire et des contrôleurs.

Conséquences appliquées :

- la création d'un spécialiste par l'administration **n'habilite plus d'office** — le
  compte naît `EN_VERIFICATION` ;
- un refus, une suspension ou une révocation **exige un motif** ;
- un praticien non `VALIDE` sort du moteur d'affectation (§14) et voit sa
  disponibilité forcée à `false` ;
- un médecin `SUSPENDU`, `EXPIRE` ou `REVOQUE` ne peut plus être désigné par un
  patient ; `EN_VERIFICATION` reste accepté, le consentement du patient fondant
  l'accès (§4.2).

Écrans : `/professionnel/justificatifs` (dépôt et suivi de son habilitation) et
`/coordinateur/habilitations` (instruction et décision).

<details><summary>Constat d'origine</summary>


Le §16 impose, avant activation d'un compte **spécialiste**, le dépôt et la vérification
de : diplôme, licence, numéro d'inscription, pièce d'identité, établissement, CV,
références — avec le cycle `EN VÉRIFICATION → VALIDÉ → SUSPENDU → EXPIRÉ → RÉVOQUÉ`.

État actuel, pour les deux professions :

- `Specialiste.verified` et `MedecinLocal.verified` sont de simples booléens — pas de
  cycle de vie à 5 états, pas de suspension ni d'expiration ;
- **aucun dépôt de document justificatif** n'est prévu pour l'un ou l'autre ;
- côté spécialiste, `verified` est forcé à `true` à la création par l'admin
  ([admin.controller.js:98](../backend/src/controllers/admin.controller.js#L98)), ce qui
  court-circuite la vérification ;
- côté médecin traitant, `numeroOrdre` est collecté mais **aucune interface ne permet de
  le vérifier** : `verified` ne peut passer à `true` que par accès direct à la base.

Conséquence pratique : un médecin non vérifié pouvait être désigné par un patient et
accéder au dossier.
</details>

---

## 3. MVP §49 — ce qui reste à faire

Le §49 énumère le contenu minimal du MVP. État :

| Élément MVP | État |
|---|---|
| Site public | ✅ |
| Inscription patient | ✅ |
| **Inscription médecin** | ✅ *(ajoutée)* |
| Vérification des spécialistes | ✅ cycle complet + dépôt de justificatifs (§16) |
| Création de dossier, téléchargement des documents | ✅ |
| Consentement | ⚠️ les 5 types existent ; pas de lecture de l'état courant |
| Demande de deuxième avis, validation du dossier | ✅ |
| Affectation du spécialiste, espace spécialiste | ✅ |
| Messagerie sécurisée | ✅ texte + pièces jointes + horodatage + audit (§19) |
| Rapport médical | ✅ modèle structuré + PDF (§21) |
| Notifications | ⚠️ interne + e-mail ; **SMS absent** (§23) |
| Paiement | ✅ CinetPay, vérification côté serveur |
| Tableau de bord administrateur | ✅ |
| Gestion des rôles, audit trail, sécurité | ✅ |
| **Statistiques de base** | ✅ 10 des 13 KPI calculés, 3 signalés indisponibles (voir §4bis) |

### Hors MVP, correctement absents

Conformes au découpage §50/§51, à ne **pas** traiter maintenant : visioconférence (§20),
assurance (§25), hôpitaux/cliniques (§26), avis multidisciplinaire (§41), télé-expertise
collégiale (§42), notation (§43), IA (§45), traduction (§46), FHIR (§47), application
mobile native (§48 — le responsive web suffit au MVP, comme le CDC l'autorise).

### Points transverses non couverts

- **§29 orientation d'urgence** : les niveaux `NORMAL/PRIORITAIRE/URGENT` existent, mais
  le mécanisme d'orientation vers les services d'urgence locaux et l'avertissement
  « la plateforme ne remplace pas les urgences » ne sont nulle part.
- **§35 antivirus** : le contrôle de format et la limite de 25 Mo existent, l'analyse
  antivirus non.
- **§35 versioning / archivage / suppression logique** des documents : absents.
- **§38 multipays** : `pays` est un champ libre sur les profils ; aucun paramétrage par
  pays (devise, fuseau, fiscalité, règles).
- **§39 devises** : `Paiement.currency` par défaut `XAF`, mais aucune table de taux ni
  gestion EUR/USD/GBP.
- **§40 tarifs** : aucune grille tarifaire (spécialité, urgence, type de prestation).
- **§34 recherche transverse** : recherche par dossier/patient/spécialiste absente.
- **§9 sécurité de session** : 2FA et OTP présents ; détection des connexions
  inhabituelles et gestion des appareils autorisés absentes.

---

## 3bis. Statistiques et indicateurs — §62, §63 — **FAIT**

`GET /api/admin/statistiques` ([`statistiquesService.js`](../backend/src/services/statistiquesService.js)),
avec bornes de période optionnelles (`depuis`, `jusquA`) et l'écran
[`AdminStatistiques.jsx`](../src/pages/admin/AdminStatistiques.jsx).

**Dix des treize indicateurs du §63 sont calculés.** Les trois autres sont renvoyés
avec `disponible: false` et un motif — pas avec un zéro, qui se lirait comme
« aucune réclamation » alors que la vraie réponse est « on ne sait pas la mesurer » :

| KPI | Pourquoi indisponible |
|---|---|
| 7 — satisfaction patient | module de notation absent (§43, hors MVP) |
| 8 — satisfaction médecin | idem |
| 9 — coût moyen par dossier | rémunération des spécialistes et commissions non modélisées (§39) |

Deux réserves sur les valeurs produites :

- **KPI 12, établissements partenaires** : approximé par les établissements distincts
  déclarés par les spécialistes, faute du modèle Hôpital (§26, phase 2). Le champ
  `approximation: true` le signale dans la réponse.
- **Finance en plusieurs devises** : les montants sont agrégés **par devise**, jamais
  additionnés — la table de conversion du §39 n'existe pas, et sommer des XAF avec
  des EUR produirait un nombre faux.

**Cloisonnement (§32)** : la table RBAC refuse l'accès aux paiements au coordinateur
médical. Le bloc `finance` et les KPI financiers sont donc retirés de la réponse pour
tout rôle autre qu'`ADMIN`. Vérifié : admin → finance visible ; coordinateur → finance
masquée, activité/performance/qualité conservées ; spécialiste et patient → 403.

Reste ouvert : le **tableau de bord médical du coordinateur** (§28) n'a pas d'écran
dédié — l'API lui sert déjà le sous-ensemble correct, mais la page est sous
`/admin/statistiques` et réservée à l'administrateur.

---

## 4. Ce qui est conforme et vérifié

- **§4.3 / §33 audit trail** — `auditService` appelé sur consultation, upload,
  téléchargement, consentement, paiement, message, rapport.
- **§4.1 / §32 cloisonnement** — testé : un médecin non désigné reçoit 403 sur le
  dossier et la messagerie, et voit 0 dossier sur 6.
- **§32 paiement** — le médecin local n'a effectivement aucun accès au paiement.
- **§19 messagerie** — texte, pièces jointes, horodatage, historique, traçabilité,
  triangle médecin local ↔ coordinateur ↔ spécialiste.
- **§10 formats** — PDF, JPEG, PNG, DICOM acceptés.
- **§22** — le coordinateur valide sans pouvoir modifier le contenu médical
  (`upsertBrouillon` réservé au spécialiste).
- **§37 multilinguisme** — fr/en via i18next, ajout d'une langue sans recompilation.
- **§24 paiement** — le webhook ré-interroge CinetPay au lieu de croire le frontend.
- **§31** — secrets hors dépôt, bcrypt 12 rounds, JWT court + refresh rotatif haché,
  documents en stockage objet séparé des métadonnées.

---

## 5. Priorités — état au 23 août 2026

Traité :

1. ~~Génération des références (§11)~~ — séquentielles et atomiques.
2. ~~`DossierStatus` (§53)~~ — les 19 statuts et leurs transitions.
3. ~~Vérification des professionnels (§16)~~ — cycle de vie + justificatifs + écrans.
4. ~~5ᵉ type de consentement (§30)~~.

Reste à faire, dans l'ordre suggéré :

1. **Compléter le rôle médecin traitant** (§5.2) — invitation médecin → patient et
   création d'une demande par le médecin.
2. **Lecture du consentement courant** (§30) — la ligne la plus récente par
   `(dossierId, type)`.
4. **Conflit d'intérêts** (§14, §18) — déclaration par le spécialiste et réaffectation.
5. **Canal SMS** des notifications (§23).
