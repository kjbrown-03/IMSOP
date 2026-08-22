---
name: International Medical Second Opinion Platform
colors:
  surface: '#f9f9ff'
  surface-dim: '#d9d9e2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3fc'
  surface-container: '#ededf6'
  surface-container-high: '#e7e8f0'
  surface-container-highest: '#e1e2ea'
  on-surface: '#191c21'
  on-surface-variant: '#424752'
  inverse-surface: '#2e3037'
  inverse-on-surface: '#f0f0f9'
  outline: '#727784'
  outline-variant: '#c2c6d4'
  surface-tint: '#115cb9'
  primary: '#003f87'
  on-primary: '#ffffff'
  primary-container: '#0056b3'
  on-primary-container: '#bbd0ff'
  inverse-primary: '#acc7ff'
  secondary: '#006e25'
  on-secondary: '#ffffff'
  secondary-container: '#80f98b'
  on-secondary-container: '#007327'
  tertiary: '#722b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#983c00'
  on-tertiary-container: '#ffc2a7'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d7e2ff'
  primary-fixed-dim: '#acc7ff'
  on-primary-fixed: '#001a40'
  on-primary-fixed-variant: '#004491'
  secondary-fixed: '#83fc8e'
  secondary-fixed-dim: '#66df75'
  on-secondary-fixed: '#002106'
  on-secondary-fixed-variant: '#00531a'
  tertiary-fixed: '#ffdbcc'
  tertiary-fixed-dim: '#ffb694'
  on-tertiary-fixed: '#351000'
  on-tertiary-fixed-variant: '#7b2f00'
  background: '#f9f9ff'
  on-background: '#191c21'
  surface-variant: '#e1e2ea'
  background-alt: '#F8F9FA'
  status-warning: '#FFC107'
  status-error: '#DC3545'
  text-main: '#1A1C1E'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  margin-mobile: 1rem
  margin-desktop: 2rem
  gutter: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
---

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
* **Couleurs Principales :**
  * **Bleu Médical (Confiance & Sécurité) :** #0056B3 (Primaire)
  * **Blanc & Gris Clair (Pureté & Lisibilité) :** #FFFFFF, #F8F9FA (Fonds)
  * **Vert Doux (Succès & Validation) :** #28A745 (Boutons d'action positive, statuts "Complet")
  * **Orange/Rouge (Alertes & Urgences) :** #FFC107 (En attente), #DC3545 (Urgent/Incomplet)
* **Typographie :** Inter ou Roboto (Sans-serif moderne).
* **Composants clés :** Steppers, Cards, Large CTA buttons, Rounded status badges.