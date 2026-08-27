# Formulaire de consentement éclairé — Demande de deuxième avis médical

**IMSOP — International Medical Second Opinion Platform**
Version du formulaire : **1.0** — Août 2026

> ⚠️ **Projet de document, à valider juridiquement avant tout usage réel.**
> Le cahier des charges (§31) prévoit expressément que les règles applicables au
> Cameroun et dans les pays d'exercice des spécialistes soient déterminées par un
> conseil juridique spécialisé en santé numérique et protection des données. Ce
> texte est une base de travail rédigée à partir du CDC (§4.2, §12, §29, §30, §32),
> pas un avis juridique.

---

## Partie A — Identification

### A.1 Patient

| Champ | Valeur | Source système |
|---|---|---|
| Nom et prénom | ............................................. | `User.fullName` |
| Date de naissance | ......../......../............ | `Patient.dob` |
| Sexe | ............................................. | `Patient.gender` |
| Nationalité | ............................................. | `Patient.nationality` |
| Pays / ville de résidence | ............................................. | `Patient.country`, `Patient.city` |
| Référence patient | `IMS-...............` | `Patient.patientRef` |
| Téléphone / courriel | ............................................. | `User.phone`, `User.email` |

### A.2 Dossier concerné

| Champ | Valeur | Source système |
|---|---|---|
| Référence du dossier | `MSO-...............` | `Dossier.reference` |
| Spécialité demandée | ............................................. | `Dossier.specialiteRequise` |
| Motif de la demande | ............................................. | `Dossier.motif` |
| Question posée au spécialiste | ............................................. | `Dossier.questionMedicale` |
| Niveau d'urgence déclaré | ☐ Normal ☐ Prioritaire ☐ Urgent | `Dossier.urgence` |

### A.3 Médecin traitant (le cas échéant)

| Champ | Valeur | Source système |
|---|---|---|
| Nom du praticien | ............................................. | `User.fullName` |
| Spécialité | ............................................. | `MedecinLocal.specialite` |
| Établissement | ............................................. | `MedecinLocal.etablissement` |
| Pays d'exercice | ............................................. | `MedecinLocal.pays` |
| Numéro d'inscription à l'ordre | ............................................. | `MedecinLocal.numeroOrdre` |
| Statut d'habilitation IMSOP | ☐ Validée ☐ En vérification | `MedecinLocal.verificationStatus` |

---

## Partie B — Ce que vous acceptez, et ce que ce n'est pas

### B.1 Objet

IMSOP met en relation un patient et un **médecin spécialiste exerçant dans un autre
pays**, afin d'obtenir un **deuxième avis médical rendu sur pièces** — c'est-à-dire
à partir du dossier médical transmis, sans examen physique du patient.

### B.2 Ce qu'un deuxième avis n'est pas

Ces trois points sont essentiels et doivent être lus attentivement.

**Ce n'est pas un remplacement de votre médecin traitant.** Le spécialiste
international n'intervient jamais à sa place : il l'accompagne. Votre médecin
traitant demeure l'acteur central de votre parcours de soins et reste seul
responsable des décisions thérapeutiques vous concernant.

**Ce n'est pas un service d'urgence.** IMSOP ne remplace en aucun cas les services
médicaux d'urgence. En cas de situation urgente ou de dégradation de votre état,
contactez immédiatement les services d'urgence locaux ou rendez-vous à l'hôpital le
plus proche.

**Ce n'est pas une consultation médicale.** L'avis est rendu sur la base des seuls
documents transmis. Sa qualité dépend directement de l'exactitude et de la
complétude de ces documents. Un avis rendu sur dossier comporte des limites
intrinsèques, que le rapport final précisera.

### B.3 Données qui seront transmises

En signant, vous acceptez la transmission des éléments suivants au spécialiste
désigné, et à lui seul :

- votre identité et vos informations administratives ;
- vos antécédents médicaux et chirurgicaux, allergies, traitements en cours ;
- votre diagnostic initial, vos symptômes et la question médicale posée ;
- vos examens : analyses biologiques, imagerie (radiographie, scanner, IRM,
  échographie, ECG), anatomopathologie, comptes rendus ;
- les échanges de la messagerie sécurisée liés à ce dossier.

### B.4 Qui aura accès à votre dossier

| Acteur | Étendue de l'accès |
|---|---|
| Le spécialiste international affecté | Le seul dossier qui lui est attribué |
| Le coordinateur médical IMSOP | Vérification de complétude et suivi administratif |
| Votre médecin traitant | Uniquement si vous l'avez désigné (partie C.4) |
| L'administrateur technique | Aucun accès au contenu médical |

Toute consultation, modification, transmission ou téléchargement de votre dossier
est **enregistrée** dans un journal d'audit conservé par la plateforme.

### B.5 Transfert international

Votre dossier sera transmis à un spécialiste exerçant **hors du Cameroun**,
notamment en Europe. Ce transfert est donc soumis à la fois au droit camerounais et
au droit du pays de destination.

> 🔲 **À compléter par le conseil juridique** : base légale du transfert, garanties
> encadrant celui-ci, mention de l'autorité de contrôle compétente et des voies de
> recours.

### B.6 Durée de conservation

> 🔲 **À compléter par le conseil juridique** : durée de conservation du dossier
> médical, du rapport et des consentements, et modalités d'archivage ou de
> suppression au terme de cette durée.

---

## Partie C — Consentements

Chaque consentement est **distinct** et peut être accepté ou refusé indépendamment
des autres. Les consentements C.1 et C.2 sont **indispensables** : sans eux, la
demande de deuxième avis ne peut pas être traitée. Les consentements C.3, C.4 et
C.5 sont **facultatifs** et un refus n'a aucune conséquence sur votre demande.

### C.1 Traitement de mes données de santé — *obligatoire*

J'accepte que mes données de santé soient collectées et traitées par IMSOP aux
seules fins d'instruire ma demande de deuxième avis médical.

☐ **J'accepte** ☐ Je refuse *(la demande ne pourra pas être traitée)*

<sub>Type système : `TRAITEMENT_DONNEES`</sub>

### C.2 Transmission à un spécialiste international — *obligatoire*

J'accepte que mon dossier médical soit transmis au spécialiste désigné par la
coordination médicale, y compris si celui-ci exerce dans un autre pays.

☐ **J'accepte** ☐ Je refuse *(la demande ne pourra pas être traitée)*

<sub>Type système : `TRANSMISSION_SPECIALISTE`</sub>

### C.3 Téléconsultation — *facultatif*

J'accepte, si une téléconsultation par visioconférence m'est proposée, d'y
participer. Je comprends qu'une téléconsultation est une prestation **distincte**
du deuxième avis sur dossier et qu'elle fera l'objet d'une information spécifique.

☐ J'accepte ☐ Je refuse

<sub>Type système : `TELECONSULTATION`</sub>

### C.4 Communication avec mon médecin traitant — *facultatif*

J'accepte que le médecin traitant identifié en partie A.3 accède à ce dossier,
y dépose des documents et échange dans la messagerie sécurisée avec le spécialiste
et la coordination.

☐ J'accepte ☐ Je refuse

<sub>Type système : `COMMUNICATION_MEDECIN` — révocable à tout moment depuis mon espace patient</sub>

### C.5 Utilisation anonymisée à des fins statistiques ou de recherche — *facultatif*

J'accepte que mes données, **après anonymisation irréversible**, puissent être
utilisées à des fins statistiques ou de recherche médicale. Aucune donnée permettant
de m'identifier ne sera utilisée à ce titre.

☐ J'accepte ☐ Je refuse

<sub>Type système : `UTILISATION_ANONYMISEE_RECHERCHE`</sub>

---

## Partie D — Vos droits

**Retirer votre consentement.** Vous pouvez révoquer tout consentement à tout
moment, sans justification, depuis votre espace patient ou en écrivant à la
coordination médicale. La révocation prend effet immédiatement et l'accès concerné
est coupé. Elle ne remet pas en cause la validité des traitements déjà effectués
avant sa date.

**Accéder à vos données et les rectifier.** Vous pouvez consulter l'ensemble des
données vous concernant et demander la correction de toute information inexacte.

**Recevoir votre rapport.** Le rapport de deuxième avis vous est remis dès sa
validation par la coordination médicale, sous forme de document PDF sécurisé.

**Être informé du journal d'accès.** Vous pouvez demander la liste des accès à
votre dossier.

> 🔲 **À compléter par le conseil juridique** : coordonnées du délégué à la
> protection des données, procédure de réclamation, autorité compétente.

---

## Partie E — Signatures

### E.1 Signature du patient

Je déclare avoir lu et compris l'intégralité du présent formulaire, en particulier
la partie B.2 sur les limites du deuxième avis. J'ai pu poser mes questions et
obtenir des réponses.

| | |
|---|---|
| Nom et prénom | ............................................. |
| Fait à | ............................................. |
| Le | ......../......../............ à ......h...... |
| Signature | |

### E.2 Signature du représentant légal — *si le patient est mineur ou protégé*

À compléter uniquement lorsque le patient n'est pas en mesure de consentir
personnellement.

| | |
|---|---|
| Nom et prénom | ............................................. |
| Qualité | ☐ Parent ☐ Tuteur ☐ Curateur ☐ Autre : .................... |
| Fait à | ............................................. |
| Le | ......../......../............ à ......h...... |
| Signature | |

> 🔲 **À compléter par le conseil juridique** : conditions dans lesquelles un tiers
> peut consentir à la place du patient, et pièces justificatives à exiger.

### E.3 Attestation du médecin traitant

**Cette attestation ne remplace pas le consentement du patient.** Elle atteste que
le praticien a présenté la démarche au patient et que la demande est médicalement
justifiée.

Je soussigné(e), praticien identifié en partie A.3, atteste :

- avoir informé le patient de l'objet et des limites de la demande de deuxième avis ;
- avoir recueilli son accord préalablement à la présente demande ;
- que les documents médicaux transmis sont exacts et complets à ma connaissance ;
- demeurer le médecin référent du patient pour les décisions thérapeutiques.

| | |
|---|---|
| Nom et prénom | ............................................. |
| Numéro d'inscription à l'ordre | ............................................. |
| Fait à | ............................................. |
| Le | ......../......../............ à ......h...... |
| Signature et cachet | |

---

## Partie F — Traçabilité (renseignée automatiquement par la plateforme)

Lorsque le consentement est recueilli en ligne, la plateforme enregistre pour
chaque case cochée une entrée distincte, conformément au CDC §30 :

| Élément enregistré | Champ système |
|---|---|
| Type de consentement | `Consentement.type` |
| Acceptation ou refus | `Consentement.accepted` |
| Version du formulaire | `Consentement.version` — **1.0** |
| Horodatage | `Consentement.acceptedAt` |
| Adresse IP d'origine | `Consentement.ipAddress` |
| Patient concerné | `Consentement.patientId` |
| Dossier concerné | `Consentement.dossierId` |
| Date de révocation | `Consentement.revokedAt` |

Une révocation n'efface jamais l'enregistrement d'origine : elle est écrite comme
un nouvel événement, afin que l'historique reste vérifiable.

---

*Formulaire de consentement IMSOP — version 1.0 — document de travail.*
