# Cahier des charges IMSOP — v1.0 (Août 2026)

> **Document de référence fonctionnel du projet.**
> PROGRAMME AFRICAN INTERNATIONAL MEDICAL SECOND OPINION — KJTECH Digital Solutions.
> Document confidentiel — usage interne et partenaires.
>
> Plateforme internationale de deuxième avis médical et de télé-expertise.
> Nom provisoire : International Medical Second Opinion Platform (IMSOP).
> Version 1.0 — Document de cadrage pour conception UX/UI, développement
> informatique et intégration des partenaires.
>
> Voir [`ecarts-implementation.md`](./ecarts-implementation.md) pour l'analyse des
> écarts entre ce document et le code actuel.

---

## 1. Objet du cahier des charges

Le présent cahier des charges définit les fonctionnalités, les interactions, les rôles, les règles de fonctionnement et les exigences techniques nécessaires à la conception et au développement d'une plateforme numérique permettant de mettre en relation :

- Patients
- Médecins traitants
- Hôpitaux et cliniques
- Médecins spécialistes
- Centres médicaux internationaux
- Laboratoires et centres d'imagerie, lorsque nécessaire
- Compagnies d'assurance
- Administrateurs de la plateforme
- Équipes de coordination médicale
- Équipes de facturation et de paiement
- Partenaires institutionnels

La plateforme doit permettre au patient, depuis le Cameroun ou un autre pays africain, de demander un deuxième avis médical auprès d'un spécialiste situé dans un autre pays, notamment en Europe, sans que le déplacement physique du patient soit nécessaire lorsque la situation médicale permet une expertise à distance.

## 2. Vision de la plateforme

La plateforme doit constituer une infrastructure numérique de coopération médicale internationale — un véritable écosystème numérique de santé permettant la circulation sécurisée des informations entre les différents acteurs autorisés, et non un simple site de prise de rendez-vous.

```
PATIENT → PLATEFORME → MÉDECIN / HÔPITAL LOCAL → COORDINATION MÉDICALE
        → SPÉCIALISTE INTERNATIONAL → DEUXIÈME AVIS → MÉDECIN/PATIENT
```

## 3. Objectifs de la plateforme

- Enregistrer les patients
- Créer et gérer leur dossier
- Recueillir leur demande de deuxième avis
- Collecter les documents médicaux
- Vérifier la complétude du dossier
- Obtenir le consentement du patient
- Identifier la spécialité médicale nécessaire
- Sélectionner un spécialiste approprié
- Transmettre le dossier au spécialiste
- Permettre au spécialiste d'analyser le dossier
- Permettre des échanges sécurisés avec le médecin local
- Produire le rapport de deuxième avis
- Remettre le rapport au patient
- Assurer le suivi du dossier
- Gérer les paiements
- Gérer les assurances
- Gérer les partenaires hospitaliers
- Mesurer la performance de la plateforme
- Assurer la traçabilité de toutes les opérations
- Garantir la confidentialité et la sécurité des données médicales

## 4. Principes fondamentaux

### 4.1 Confidentialité
Les données médicales ne doivent être accessibles qu'aux personnes expressément autorisées.

### 4.2 Consentement
Le patient doit donner son consentement avant toute transmission de son dossier à un spécialiste externe.

### 4.3 Traçabilité
Toute consultation, modification, transmission, téléchargement ou validation d'un dossier doit être enregistrée.

### 4.4 Séparation des responsabilités
Un administrateur informatique ne doit pas automatiquement avoir accès au contenu médical des dossiers.

### 4.5 Complémentarité médicale
La plateforme ne doit pas présenter le deuxième avis comme une substitution systématique au médecin traitant.

### 4.6 Neutralité
Le système doit permettre de sélectionner les spécialistes selon des critères objectifs : spécialité, compétence, disponibilité, langue, pays, domaine d'expertise, etc.

### 4.7 Interopérabilité
La plateforme devra être conçue pour pouvoir communiquer ultérieurement avec les systèmes d'information hospitaliers, laboratoires, systèmes d'imagerie et autres plateformes de santé.

## 5. Acteurs de la plateforme

### 5.1 Patient
- Créer un compte et son profil
- Déposer une demande de deuxième avis
- Renseigner son historique médical
- Télécharger ses documents
- Consulter l'état de son dossier
- Payer
- Choisir ou accepter un spécialiste
- Communiquer avec l'équipe de coordination
- Recevoir son rapport
- Prendre rendez-vous pour une téléconsultation lorsque cela est prévu
- Donner son avis sur le service

### 5.2 Médecin traitant
- Créer un compte professionnel
- **Enregistrer un patient avec son autorisation**
- Consulter les dossiers auxquels il est autorisé
- Transmettre les informations médicales
- Ajouter des comptes rendus
- **Demander un deuxième avis**
- Échanger avec le spécialiste international
- Recevoir le rapport
- Commenter ou demander des précisions

### 5.3 Hôpital / Clinique
L'établissement dispose d'un compte institutionnel lui permettant de :
- Créer plusieurs comptes professionnels
- Gérer ses médecins
- Enregistrer des patients
- Soumettre des demandes
- Suivre les dossiers
- Recevoir les rapports
- Gérer les factures
- Consulter des statistiques institutionnelles

### 5.4 Spécialiste international
- Créer son profil professionnel
- Fournir ses diplômes et références
- Renseigner ses spécialités et sous-spécialités
- Indiquer ses disponibilités
- Accepter ou refuser une demande
- Consulter un dossier qui lui est attribué
- Demander des informations complémentaires
- Échanger avec le médecin local
- Produire le rapport médical
- Signer électroniquement le rapport lorsque le cadre applicable le permet
- Facturer ses prestations selon les conditions contractuelles

### 5.5 Hôpital international
- Gérer ses spécialistes
- Recevoir des demandes
- Attribuer les dossiers aux spécialistes
- Gérer les tarifs et les disponibilités
- Suivre les dossiers et les factures
- Produire des statistiques

### 5.6 Coordinateur médical
Acteur essentiel du dispositif, il doit pouvoir :
- Vérifier les dossiers et contrôler leur complétude
- Identifier la spécialité nécessaire
- Rechercher les spécialistes
- Affecter les dossiers
- Suivre les délais et relancer les spécialistes
- Gérer les demandes complémentaires
- Vérifier la réception des rapports et les transmettre au patient
- Gérer les incidents médicaux ou administratifs selon les procédures prévues

### 5.7 Administrateur de la plateforme
- Utilisateurs, rôles, autorisations
- Établissements et spécialistes
- Paramètres, tarifs, catégories médicales
- Workflows et notifications
- Statistiques et journaux d'activité

### 5.8 Administrateur financier
- Paiements, factures, remboursements
- Commissions et reversements aux spécialistes
- Comptes des partenaires
- Rapprochements financiers

### 5.9 Compagnie d'assurance
- Vérifier l'éligibilité du patient
- Recevoir une demande de prise en charge
- Approuver ou refuser la prise en charge
- Obtenir les factures et suivre les dossiers
- Consulter les informations auxquelles elle est autorisée à accéder

## 6. Architecture générale de la plateforme

| Portail | Description |
|---|---|
| A. Site institutionnel public | Accessible sans authentification |
| B. Portail patient | Espace personnel sécurisé |
| C. Portail médecin | Espace sécurisé destiné aux médecins locaux |
| D. Portail spécialiste international | Espace destiné aux spécialistes |
| E. Portail hôpital / clinique | Espace institutionnel |
| F. Portail coordinateur médical | Interface de gestion des dossiers |
| G. Portail administration | Gestion globale |
| H. Portail assurance | Interface spécifique aux assureurs |
| I. Module de paiement | Paiement et facturation |
| J. Module de communication sécurisée | Messagerie et notifications |
| K. Moteur de workflow | Gestion automatique du parcours des dossiers |
| L. API / couche d'interopérabilité | Échanges avec d'autres systèmes |

## 7. Site Internet public

Le site public devra présenter :

- Présentation du programme et fonctionnement du deuxième avis
- Spécialités disponibles
- Pays et établissements partenaires
- Présentation des médecins
- Tarifs indicatifs
- Fonctionnement pour les patients, médecins, hôpitaux, assurances
- FAQ et actualités
- Témoignages lorsque légalement autorisés
- Formulaire de contact et de demande d'information
- Langues disponibles

## 8. Création du compte patient

Le patient doit pouvoir créer son compte avec :

- Nom, prénom, date de naissance, sexe, nationalité
- Pays de résidence, ville
- Téléphone, email, langue préférée
- Personne à contacter en cas de besoin
- Informations administratives nécessaires

Le système doit prévoir une vérification de l'identité et du moyen de contact selon le niveau de sécurité retenu.

## 9. Authentification

- Email + mot de passe
- Authentification à deux facteurs
- Code OTP
- Récupération sécurisée du mot de passe
- Gestion des sessions et déconnexion automatique
- Détection des connexions inhabituelles
- Gestion des appareils autorisés

Pour les professionnels de santé, un niveau d'authentification renforcé devra être prévu.

## 10. Dossier médical numérique

Chaque patient doit disposer d'un dossier médical numérique structuré, comprenant :

**Identité**
- Identité du patient
- Informations administratives

**Antécédents**
- Antécédents médicaux et chirurgicaux
- Allergies, traitements
- Antécédents familiaux lorsque pertinents

**Diagnostic**
- Diagnostic initial, suspicion diagnostique
- Symptômes, date du diagnostic

**Examens**
- Analyses biologiques
- Radiographies, scanner, IRM, échographie, ECG
- Anatomopathologie
- Autres examens

**Documents — formats à prévoir**
- PDF, JPEG, PNG
- DICOM pour l'imagerie médicale
- Autres formats selon les besoins

## 11. Demande de deuxième avis

Le patient **ou le médecin** doit pouvoir créer une demande renseignant :

- Spécialité recherchée, motif de la demande
- Diagnostic initial et question précise posée au spécialiste
- Traitement proposé, urgence éventuelle
- Médecin traitant, établissement
- Documents disponibles

Le système attribue un numéro unique au dossier, par exemple : `MSO-2026-CM-000125`

## 12. Question médicale centrale

**Quelle est la question précise à laquelle le spécialiste doit répondre ?**

Exemples : le diagnostic proposé est-il cohérent avec les éléments disponibles ? Une intervention chirurgicale est-elle nécessaire ? Existe-t-il une alternative thérapeutique ? Des examens complémentaires sont-ils nécessaires ? Quelle stratégie thérapeutique serait généralement envisagée ?

Cette fonctionnalité est fondamentale car elle évite que le spécialiste reçoive simplement un dossier sans savoir précisément ce qui lui est demandé.

## 13. Module de vérification du dossier

Avant transmission au spécialiste, le système doit vérifier : identité complète, consentement, documents obligatoires, résultats disponibles, question médicale, médecin référent, paiement ou garantie de paiement.

```
BROUILLON → SOUMIS → EN VÉRIFICATION → INCOMPLET → COMPLET
→ EN ATTENTE D'AFFECTATION → AFFECTÉ → EN ANALYSE
→ RAPPORT EN PRÉPARATION → RAPPORT VALIDÉ → RAPPORT TRANSMIS → CLÔTURÉ
```

## 14. Moteur d'affectation des spécialistes

Recherche automatique ou manuelle d'un spécialiste selon :

- Spécialité et sous-spécialité
- Pathologie, pays, établissement
- Langue, disponibilité, délai de réponse
- Niveau d'expertise, tarif
- Éventuels conflits d'intérêts

Le coordinateur médical pourra ensuite confirmer l'affectation.

## 15. Profil du spécialiste

- Nom, photo professionnelle
- Spécialité et sous-spécialités
- Diplômes, qualifications
- Pays, établissement, expérience
- Domaines d'expertise, langues
- Disponibilité, tarif, délai moyen de réponse
- Statut de vérification

Le système devra distinguer **PROFIL VÉRIFIÉ** et **PROFIL NON ENCORE VALIDÉ**.

## 16. Vérification des professionnels

Avant activation d'un compte spécialiste, la plateforme doit permettre le dépôt et la vérification de :

- Diplôme, licence ou autorisation d'exercer
- Numéro d'inscription professionnelle
- Pièce d'identité
- Établissement d'exercice, CV, références professionnelles
- Autres documents requis

```
EN VÉRIFICATION → VALIDÉ → SUSPENDU → EXPIRÉ → RÉVOQUÉ
```

## 17. Espace spécialiste

Le tableau de bord du spécialiste doit afficher :

- Nouvelles demandes, dossiers acceptés, dossiers en cours
- Dossiers urgents et dossiers en retard
- Rapports à finaliser
- Revenus, rendez-vous, messages

## 18. Acceptation d'une demande

- **Accepter** → le dossier passe à EN ANALYSE
- **Refuser** → avec indication du motif
- **Demander des informations complémentaires** → le dossier retourne au coordinateur ou au médecin local
- **Déclarer un conflit d'intérêts** → le dossier doit alors être réaffecté

## 19. Espace d'échange médical

**Médecin local ↔ Coordinateur ↔ Spécialiste international**

La messagerie doit permettre : texte, documents, images, pièces jointes, notifications, historique, horodatage, traçabilité.

## 20. Visioconférence

Lorsque le cadre médical et réglementaire le permet, la plateforme pourra intégrer une fonction de téléconsultation/visioconférence : prise de rendez-vous, calendrier, invitation, visioconférence sécurisée, caméra, microphone, partage de documents, chat, compte rendu, confirmation de présence.

Le système devra distinguer clairement **DEUXIÈME AVIS SUR DOSSIER** et **TÉLÉCONSULTATION MÉDICALE**, car ces deux prestations ne sont pas nécessairement juridiquement ou médicalement équivalentes.

## 21. Rapport de deuxième avis

Le spécialiste devra disposer d'un modèle standardisé comprenant :

- Identité du patient, date
- Question posée, documents analysés
- Synthèse clinique, appréciation du diagnostic
- Observations
- Examens complémentaires éventuellement recommandés
- Options thérapeutiques discutables
- Limites de l'avis, recommandations
- Identité du spécialiste
- Signature/validation selon le dispositif retenu

Le rapport sera généré sous forme PDF sécurisé.

## 22. Validation du rapport

```
BROUILLON → SOUMIS → CONTRÔLE → VALIDÉ → TRANSMIS
```

Le coordinateur **ne doit pas modifier le contenu médical** du rapport ; il vérifie uniquement sa conformité administrative et procédurale selon les règles définies.

## 23. Notifications

**Patient**
- Compte créé, demande reçue
- Dossier incomplet / complet
- Spécialiste identifié, paiement reçu
- Avis disponible, rendez-vous confirmé

**Médecin**
- Nouveau dossier
- Demande d'information
- Rapport disponible

**Spécialiste**
- Nouveau dossier, délai proche
- Message reçu, dossier urgent
- Rapport à finaliser

Canaux : notification interne, email, SMS, éventuellement WhatsApp ou autre canal, sous réserve des exigences de confidentialité et de sécurité.

## 24. Module de paiement

- Paiement par carte, mobile money, bancaire
- Paiement par assurance ou par entreprise
- Paiement par portefeuille prépayé lorsque retenu

Le système doit générer : devis, facture, reçu, preuve de paiement.

## 25. Module assurance

- Recevoir une demande
- Vérifier les droits et la couverture du patient
- Approuver la prise en charge et définir le montant couvert
- Suivre le dossier
- Recevoir la facture
- Effectuer ou confirmer le règlement

## 26. Module hôpitaux et cliniques

L'hôpital doit pouvoir gérer : son établissement, ses médecins, ses patients, les demandes, les dossiers, les paiements, les rapports, les statistiques.

```
GROUPE HOSPITALIER → HÔPITAL → SERVICE → MÉDECIN
```

## 27. Tableau de bord de l'administration

- Nombre de patients, nouveaux patients
- Demandes reçues, dossiers en cours/terminés/urgents/en retard
- Nombre de spécialistes, d'hôpitaux, pays couverts
- Chiffre d'affaires, paiements, remboursements
- Satisfaction

## 28. Tableau de bord médical

- Dossiers par spécialité
- Délais de traitement
- Spécialistes disponibles / surchargés
- Dossiers urgents, taux de complétude, taux de réponse
- Qualité des rapports, incidents, réclamations

## 29. Système de gestion des urgences

Le système doit permettre de classer les demandes : **NORMAL, PRIORITAIRE, URGENT**.

La plateforme devra afficher clairement qu'elle **ne remplace pas les services d'urgence**. Lorsqu'un patient décrit une situation potentiellement urgente, le système doit déclencher un mécanisme approprié d'orientation vers les services médicaux locaux d'urgence selon les protocoles validés par le comité médical.

## 30. Système de gestion des consentements

Le patient doit pouvoir donner différents consentements séparés pour :

- Le traitement de ses données
- La transmission à un spécialiste ou à un hôpital
- La téléconsultation
- La communication avec le médecin
- L'utilisation anonymisée des données à des fins statistiques/recherche, lorsque prévue

Chaque consentement doit être **daté, horodaté, identifiable, conservé, révocable** selon les règles applicables.

## 31. Protection des données

- Chiffrement des données en transit
- Chiffrement des données sensibles au repos
- Contrôle d'accès, authentification forte
- Journalisation, sauvegardes, plan de reprise
- Surveillance des intrusions, gestion des vulnérabilités
- Tests de sécurité
- Séparation des environnements développement/test/production

Les règles juridiques applicables au Cameroun et dans les pays où seront établis les spécialistes devront être déterminées par un conseil juridique spécialisé en santé numérique et protection des données.

## 32. Gestion des rôles et permissions (RBAC)

| Acteur | Patient | Dossier médical | Paiement | Rapport |
|---|---|---|---|---|
| Patient | Oui | Ses données | Oui | Oui |
| Médecin local | Oui | Autorisé | Non | Oui |
| Spécialiste | Oui | Dossier affecté | Selon besoin | Création |
| Coordinateur médical | Oui | Dossiers autorisés | Non | Gestion |
| Finance | Oui | Non | Oui | Non |
| Administrateur IT | Gestion technique | Pas d'accès médical par défaut | Non | Non |
| Assurance | Oui | Accès limité | Oui | Selon autorisation |

Les permissions devront être beaucoup plus fines dans la version technique finale.

## 33. Audit trail

Chaque action sensible doit être enregistrée : connexion, consultation, téléchargement, modification, transmission, suppression logique, validation, paiement, changement de permission.

Le journal doit conserver : utilisateur, date, heure, action, dossier concerné, adresse IP ou identifiant technique selon la politique de sécurité.

## 34. Système de recherche

Les utilisateurs autorisés doivent pouvoir rechercher : patient, dossier, médecin, spécialiste, établissement, numéro de dossier, spécialité, pays, statut, date — la recherche devant respecter les permissions d'accès.

## 35. Gestion documentaire

- Upload et téléchargement autorisé
- Prévisualisation, classement, versioning
- Archivage, suppression logique
- Contrôle de format et antivirus
- Limitation de taille

## 36. Gestion des images médicales

Une fonctionnalité spécifique devra être prévue pour les images médicales. La plateforme devra idéalement pouvoir évoluer vers la compatibilité avec les standards médicaux appropriés, notamment **DICOM**, afin de transmettre scanner, IRM, radiographie, mammographie et autres examens d'imagerie.

## 37. Multilinguisme

Version initiale : **français, anglais**. Extension possible : arabe, portugais, espagnol, autres langues africaines selon le développement du programme. L'architecture doit permettre d'ajouter une langue **sans reconstruire l'application**.

## 38. Gestion multipays

Chaque dossier doit pouvoir être associé à un pays du patient, du médecin, du spécialiste et de l'établissement. Le système doit également gérer des paramètres différents selon les pays : devise, langue, fuseau horaire, règles contractuelles, fiscalité, modalités de paiement, partenaires.

## 39. Gestion des devises

Prévoir au minimum : **EUR, XAF, USD, GBP**. Le système devra permettre de définir : prix du service, devise, taux de conversion affiché, frais, commissions, montant net du spécialiste.

## 40. Gestion des tarifs

Les tarifs pourront varier selon la spécialité, le spécialiste, l'établissement, le pays, le niveau d'urgence, le délai demandé et le type de prestation, par exemple :

- Deuxième avis standard
- Deuxième avis prioritaire
- Deuxième avis complexe
- Téléconsultation spécialisée
- Avis multidisciplinaire

## 41. Avis multidisciplinaire

Une fonctionnalité importante devra permettre de soumettre un dossier à plusieurs spécialistes (ex. oncologue, radiologue, chirurgien, anatomopathologiste pour une pathologie complexe), la plateforme produisant ensuite une synthèse multidisciplinaire. Cette fonctionnalité constituera potentiellement un avantage concurrentiel majeur.

## 42. Télé-expertise collégiale

À terme, la plateforme pourra permettre une réunion virtuelle entre médecin africain, spécialiste européen et autres spécialistes, pour les dossiers particulièrement complexes.

## 43. Système de notation

Après la prestation, le patient pourra évaluer : facilité d'utilisation, rapidité, qualité du service, compréhension du processus, satisfaction générale.

Il faudra être prudent avec la notation publique des médecins : celle-ci devra être définie avec le comité médical et le conseil juridique.

## 44. Service client / support

- FAQ
- Chatbot d'assistance administrative, si souhaité
- Formulaire de contact, ticketing
- Support téléphonique et email
- Suivi des réclamations

Le chatbot **ne devra pas** être présenté comme un outil de diagnostic médical.

## 45. Intelligence artificielle

Une IA peut éventuellement être intégrée dans des fonctions **non diagnostiques** ou strictement encadrées : classement documentaire, détection des documents manquants, traduction, résumé administratif du dossier, recherche documentaire, aide au coordinateur, extraction de données structurées.

L'IA **ne doit pas** être autorisée à produire automatiquement un diagnostic destiné au patient sans validation humaine et sans analyse préalable du cadre réglementaire.

## 46. Module de traduction

Traduction français ↔ anglais, traduction des informations administratives, assistance à la communication médecin-patient. Pour les documents médicaux critiques, le système doit permettre une validation humaine lorsque nécessaire.

## 47. API et interopérabilité

La plateforme devra être développée avec une architecture **API-first**, pouvant communiquer ultérieurement avec systèmes hospitaliers, laboratoires, centres d'imagerie, systèmes d'assurance, systèmes de paiement, plateformes de visioconférence, outils d'identité, systèmes de messagerie.

L'équipe technique devra prévoir une architecture permettant l'évolution vers des standards d'interopérabilité médicale appropriés, notamment **HL7/FHIR**, lorsque cela est pertinent.

## 48. Application mobile

**Application patient**
- Connexion, dossier
- Demande de deuxième avis, paiement
- Notifications, messagerie
- Rendez-vous, réception du rapport

**Application professionnel**
- Dossiers, notifications
- Messagerie, calendrier, rapports

Pour le MVP, une **application web responsive** peut être privilégiée afin de réduire le coût et le délai de lancement.

## 49. Version MVP

Il est fortement recommandé de ne pas développer toutes les fonctionnalités simultanément. Le MVP devra comprendre au minimum :

- Site public
- Inscription patient et **inscription médecin**
- Vérification des spécialistes
- Création de dossier, téléchargement des documents
- Consentement
- Demande de deuxième avis, validation du dossier
- Affectation du spécialiste, espace spécialiste
- Messagerie sécurisée
- Rapport médical
- Notifications, paiement
- Tableau de bord administrateur
- Gestion des rôles, audit trail, sécurité
- Statistiques de base

## 50. Phase 2

Après validation du MVP : visioconférence, assurance, application mobile, hôpitaux internationaux, imagerie DICOM, avis multidisciplinaire, traduction, API hospitalières, intégration FHIR, IA d'assistance, extension à d'autres pays.

## 51. Phase 3

À terme : réseau panafricain, marketplace médicale spécialisée, centres d'excellence partenaires, télé-expertise multidisciplinaire, programmes d'assurance, recherche médicale anonymisée, statistiques épidémiologiques, programmes de santé publique, financement social des deuxièmes avis.

## 52. Workflow global

```
PATIENT
  → Création du compte
  → Création de la demande
  → Consentement
  → Dépôt des documents
  → Paiement / assurance
COORDINATION MÉDICALE
  → Contrôle du dossier
  → Dossier complet ? → OUI
  → Identification de la spécialité
  → Recherche du spécialiste
  → Affectation
SPÉCIALISTE INTERNATIONAL
  → Acceptation
  → Analyse du dossier
  → Demande d'informations complémentaires si nécessaire
  → Analyse finale
  → Rédaction du deuxième avis
  → Validation
PLATEFORME
  → Transmission sécurisée
PATIENT + MÉDECIN LOCAL
  → Prise de connaissance
  → Éventuelle téléconsultation / suivi
  → Clôture du dossier
```

## 53. Statuts du dossier

- Brouillon
- Soumis
- En attente de paiement
- **En attente de documents**
- En vérification
- Complet
- En attente d'affectation
- Affecté
- **Accepté par le spécialiste**
- En analyse
- **Information complémentaire demandée**
- Rapport en préparation
- Rapport soumis
- Rapport validé
- Rapport transmis
- **Suivi**
- Clôturé
- Annulé
- Refusé

## 54. Exigences UX/UI

Le design doit être simple, professionnel, médical, rassurant, accessible, responsive, compatible smartphone et utilisable avec une **connexion Internet limitée**. Le parcours patient doit être particulièrement simple, avec un nombre d'étapes réduit au minimum pour demander un deuxième avis.

## 55. Accessibilité

- Bonne lisibilité, contraste suffisant
- Navigation intuitive
- Boutons suffisamment grands sur mobile
- Compatibilité avec les technologies d'assistance lorsque nécessaire
- Messages d'erreur compréhensibles
- Interface adaptée aux utilisateurs ayant une faible familiarité numérique

## 56. Performance

Objectifs indicatifs : temps de chargement réduit, optimisation mobile, compression des fichiers, chargement progressif des documents, disponibilité élevée, capacité d'évolution du nombre d'utilisateurs. La plateforme devra être conçue pour évoluer progressivement de quelques milliers à plusieurs centaines de milliers d'utilisateurs.

## 57. Architecture technique

Les développeurs devront proposer une architecture sécurisée, modulaire, scalable, maintenable, documentée, API-first, compatible cloud, permettant la séparation frontend/backend et l'intégration future de services externes. L'architecture exacte sera proposée par l'équipe technique après validation des exigences fonctionnelles.

## 58. Base de données

La base devra gérer notamment les entités suivantes :

- Patient, Médecin, Spécialiste
- Hôpital, Clinique, Assurance
- Dossier médical, Demande de deuxième avis
- Document, Examen, Rapport
- Rendez-vous, Message
- Paiement, Facture, Consentement
- Utilisateur, Rôle, Permission
- Notification, Audit
- Pays, Spécialité

## 59. Sécurité informatique

Avant la mise en production, prévoir : tests de pénétration, audit de sécurité, tests de vulnérabilité, chiffrement, sauvegardes, plan de reprise, gestion des incidents, surveillance, contrôle des accès, rotation des clés/secrets, protection contre les attaques courantes.

## 60. Sauvegarde et continuité

- Sauvegardes automatiques et chiffrées
- Stockage redondant
- Plan de reprise après sinistre
- Procédure de restauration
- Tests périodiques des sauvegardes

**La perte d'un dossier médical doit être considérée comme un incident critique.**

## 61. Administration du système

L'administrateur doit pouvoir configurer : utilisateurs, rôles, permissions, spécialités, pays, devises, tarifs, délais, notifications, modèles de documents, paramètres de workflow — ces paramètres devant être configurables **sans modifier le code** lorsque cela est raisonnablement possible.

## 62. Statistiques et Business Intelligence

**Activité**
- Nombre de demandes et de dossiers terminés
- Spécialités les plus demandées
- Pays des patients

**Performance**
- Délai moyen, délai par spécialiste
- Taux de dossiers incomplets, taux d'annulation

**Finance**
- Chiffre d'affaires, revenus par spécialité et par pays
- Commissions, paiements

**Qualité**
- Satisfaction, réclamations, incidents, taux de réponse

## 63. Indicateurs clés de performance

- KPI 1 : nombre de patients
- KPI 2 : nombre de demandes
- KPI 3 : taux de conversion demande → dossier
- KPI 4 : délai moyen d'obtention du deuxième avis
- KPI 5 : taux de dossiers complets
- KPI 6 : taux de réponse des spécialistes
- KPI 7 : satisfaction patient
- KPI 8 : satisfaction médecin
- KPI 9 : coût moyen par dossier
- KPI 10 : revenu moyen par dossier
- KPI 11 : nombre de spécialistes actifs
- KPI 12 : nombre d'établissements partenaires
- KPI 13 : nombre de pays couverts

## 64. Documentation à fournir par les programmeurs

- Code source
- Documentation technique et documentation API
- Architecture, schéma de base de données
- Documentation de déploiement et de sécurité
- Manuel administrateur, manuel utilisateur
- Procédures de sauvegarde et de restauration
- Tests, rapport de sécurité
- Documentation des intégrations externes

## 65. Livrables des designers UX/UI

- Arborescence du site
- User journeys, personas
- Wireframes, maquettes haute fidélité
- Design system, composants UI
- Version mobile et desktop
- Prototypes interactifs
- Parcours patient, médecin, spécialiste, hôpital, administrateur

## 66. Principaux écrans à concevoir

| Espace | Écrans principaux |
|---|---|
| Public | Accueil, présentation, spécialités, spécialistes, établissements, tarifs, FAQ, contact |
| Patient | Inscription, connexion, tableau de bord, profil, nouveau dossier, documents, consentement, paiement, suivi, messages, rendez-vous, rapport, historique |
| Médecin | Dashboard, patients, dossiers, demande d'avis, messagerie, rapports |
| Spécialiste | Dashboard, demandes, dossiers, agenda, messages, rapport, revenus |
| Coordinateur | Dashboard, dossiers, affectations, spécialistes, alertes, délais, incidents |
| Administrateur | Dashboard, utilisateurs, rôles, établissements, pays, spécialités, tarifs, paiements, statistiques, configuration |

## 67. Critères d'acceptation du projet

La plateforme ne sera considérée comme opérationnelle que lorsque :

- Tous les rôles auront été implémentés
- Les droits d'accès auront été testés
- Le parcours patient aura été testé de bout en bout
- Le parcours spécialiste aura été testé
- Le paiement aura été testé
- La transmission documentaire aura été testée
- Le workflow médical aura été testé
- Les notifications auront été testées
- La sécurité aura été auditée
- Les sauvegardes auront été testées
- La documentation aura été livrée
- Les utilisateurs pilotes auront validé les parcours

## 68. Test pilote

Avant le lancement commercial, il est recommandé de réaliser un pilote avec :

- 20 à 50 patients
- 5 à 10 médecins locaux
- 5 à 10 spécialistes internationaux
- 2 à 3 établissements de santé
- 1 ou 2 partenaires internationaux

## 69. Phase de recette

| Niveau | Description |
|---|---|
| Recette technique | Vérification du fonctionnement informatique |
| Recette fonctionnelle | Vérification de la conformité aux fonctionnalités demandées |
| Recette médicale | Validation des workflows par le comité médical |
| Recette utilisateur | Tests avec de vrais utilisateurs pilotes |

## 70. Livraison en lots

| Lot | Contenu |
|---|---|
| Lot 1 | Architecture + UX/UI + site public |
| Lot 2 | Patient + dossier médical + demande de deuxième avis |
| Lot 3 | Médecins + spécialistes + coordination médicale |
| Lot 4 | Paiement + facturation + assurance |
| Lot 5 | Messagerie + notifications + visioconférence |
| Lot 6 | Administration + statistiques + reporting |
| Lot 7 | Sécurité + audit + optimisation |
| Lot 8 | Déploiement et pilote |

## 71. Priorités fonctionnelles

**Priorité P0 — Indispensable**
- Gestion des utilisateurs, authentification
- Dossier patient, documents, consentement
- Demande de deuxième avis
- Gestion des spécialistes, affectation
- Rapport, messagerie sécurisée
- Paiement, administration
- Sécurité, audit

**Priorité P1 — Importante**
- Visioconférence, assurance
- Application mobile
- Statistiques avancées
- Avis multidisciplinaire, DICOM, multidevise

**Priorité P2 — Évolution**
- Intelligence artificielle
- Traduction avancée
- Interopérabilité hospitalière
- Recherche médicale, outils analytiques avancés
- Extension panafricaine

## 72. Règle de conception essentielle

**SECURITY BY DESIGN et PRIVACY BY DESIGN**

La sécurité et la confidentialité ne doivent pas être ajoutées après le développement. Elles doivent être intégrées dès la conception de l'architecture, de la base de données, des interfaces et des workflows.

## 73. Résultat attendu

À l'issue du développement, la plateforme devra permettre à un patient situé au Cameroun de réaliser le parcours suivant :

1. Je crée mon compte
2. Je demande un deuxième avis
3. Je renseigne mon problème médical
4. Je téléverse mes examens
5. Je donne mon consentement
6. Je paie ou mon assurance prend en charge la prestation
7. Le coordinateur vérifie mon dossier
8. Un spécialiste international est sélectionné
9. Le spécialiste reçoit mon dossier
10. Il analyse mes informations
11. Il échange éventuellement avec mon médecin
12. Il produit son deuxième avis
13. Le rapport est validé
14. Je reçois le rapport sécurisé
15. Je peux, si nécessaire, prendre rendez-vous pour une téléconsultation ou être orienté vers un établissement approprié

## 74. Conclusion

La plateforme doit être considérée comme une **infrastructure numérique de santé internationale**, et non comme un simple portail web. Son architecture doit donc être suffisamment robuste pour commencer avec un nombre limité de patients et de spécialistes au Cameroun, tout en permettant ultérieurement son extension à plusieurs pays africains et à plusieurs réseaux médicaux internationaux.

Le développement devra être réalisé en collaboration étroite entre :

> Équipe informatique + UX/UI + médecins + coordinateurs médicaux + experts juridiques + experts cybersécurité + spécialistes internationaux + représentants des patients

Le présent cahier des charges constitue le **document fonctionnel de référence**. Il devra être complété par :

- Un document d'architecture technique détaillée
- Un modèle de données / dictionnaire des données
- Un document de spécifications API
- Une politique de sécurité et de protection des données
- Les procédures médicales et opérationnelles
- Les règles de gouvernance médicale
- Les spécifications UX/UI détaillées
- Un plan de tests et de recette
- Un plan de déploiement et de maintenance

---

*Fin du document — Cahier des charges IMSOP, KJTECH Digital Solutions.*
