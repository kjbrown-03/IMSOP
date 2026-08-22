# DESIGN.md - IMSOP (International Medical Second Opinion Platform)

## 1. Vision Générale du Produit
**Nom du projet :** IMSOP (International Medical Second Opinion Platform)
**Description :** Plateforme numérique internationale de deuxième avis médical et de télé-expertise. Elle permet à des patients (notamment en Afrique) d'obtenir un deuxième avis médical auprès de spécialistes internationaux (ex: Europe) de manière sécurisée et encadrée.
**Mots-clés de conception :** Médical, Sécurisé, Rassurant, Professionnel, Simple, Accessible, Mobile-First.

## 2. Principes UX (Expérience Utilisateur)
* **Clarté avant tout :** L'utilisateur (surtout le patient) ne doit jamais se demander "Que dois-je faire maintenant ?". Chaque écran doit répondre à : Où suis-je ? Quelle est l'étape actuelle ? Quelle est la prochaine étape ?
* **Mobile-First :** La conception doit être pensée en priorité pour les smartphones, car une grande partie de la cible patient utilisera ce support, potentiellement avec une connexion limitée.
* **Accessibilité :** Fort contraste, typographie lisible, gros boutons sur mobile, messages d'erreur explicites, adapté aux utilisateurs peu familiers avec le numérique.
* **Statuts visuels évidents :** Utilisation de badges de couleur pour les statuts des dossiers (ex: Brouillon, Incomplet, En analyse, Validé).

## 3. Charte Graphique & UI (Interface Utilisateur)
* **Couleurs Principales (Suggestion) :**
  * **Bleu Médical (Confiance & Sécurité) :** #0056B3 (Primaire)
  * **Blanc & Gris Clair (Pureté & Lisibilité) :** #FFFFFF, #F8F9FA (Fonds)
  * **Vert Doux (Succès & Validation) :** #28A745 (Boutons d'action positive, statuts "Complet")
  * **Orange/Rouge (Alertes & Urgences) :** #FFC107 (En attente), #DC3545 (Urgent/Incomplet)
* **Typographie :** Sans-serif moderne, propre et lisible (ex: Inter, Roboto, ou San Francisco).
* **Composants clés :**
  * Steppers (indicateurs d'étapes) pour le processus de demande.
  * Cartes (Cards) pour afficher les dossiers médicaux de manière aérée.
  * Boutons (CTA) larges et contrastés.
  * Badges de statut arrondis.

## 4. Parcours Utilisateurs Principaux (User Journeys)

### A. Le Parcours Patient (Focus Principal pour le MVP)
1. **Accueil / Landing Page :** Présentation rassurante, réassurance sur les médecins, CTA principal "Demander un deuxième avis".
2. **Inscription / Connexion :** Simple, demande les informations essentielles.
3. **Tableau de bord (Dashboard) Patient :** Vue d'ensemble du statut du dossier actuel, notifications, CTA "Nouvelle demande".
4. **Création d'une demande (Tunnel en 8 étapes) :**
   - Motif de la demande
   - Spécialité recherchée
   - Diagnostic initial & Question médicale précise
   - Téléchargement des documents médicaux (Drag & Drop + Mobile Camera upload)
   - Formulaire de consentement
   - Paiement sécurisé
   - Récapitulatif et Validation
5. **Vue du Rapport :** Affichage clair et structuré du rapport du spécialiste avec possibilité de le télécharger en PDF.

### B. Le Parcours Spécialiste International
1. **Tableau de bord :** Dossiers en attente d'acceptation, dossiers en cours d'analyse, alertes sur les délais.
2. **Vue Dossier Médical :** Interface divisée/organisée avec d'un côté les informations du patient/documents, et de l'autre l'espace de rédaction du rapport.
3. **Rédaction du rapport :** Formulaire structuré (Synthèse, Diagnostic, Options thérapeutiques, etc.).

### C. Le Parcours Coordinateur Médical
1. **Tableau de bord :** Vue "Tour de contrôle" avec filtres (Nouveaux, Incomplets, À affecter, Urgents).
2. **Interface d'affectation :** Matching entre un dossier et un spécialiste disponible selon sa spécialité.

## 5. Liste des Écrans Prioritaires à Maquetter (MVP)
1. **Landing Page Publique**
2. **Dashboard Patient** (Vue liste des demandes et statuts)
3. **Tunnel de création de demande Patient** (UI type "Wizard" étape par étape)
4. **Dashboard Coordinateur** (Vue kanban ou tableau listant les dossiers avec alertes)
5. **Dashboard Spécialiste**
6. **Écran de Consultation d'un Dossier & Rédaction de l'avis** (Pour le spécialiste)
7. **Écran de Consultation du Rapport Final** (Pour le patient/médecin local)

## 6. Composants Spécifiques Requis
* Upload de fichiers (avec indication de progression et gestion des erreurs de format).
* Système de messagerie sécurisée intégrée (ChatUI).
* Module de paiement.
* Timeline de suivi de l'état d'un dossier.
