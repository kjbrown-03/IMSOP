const cron = require('node-cron')
const { prisma } = require('../lib/prisma')
const env = require('../config/env')
const { notify } = require('./notificationService')
const { safeUserSelect } = require('../lib/selectors')

const MS_PAR_HEURE = 3600 * 1000

/**
 * Statuts pendant lesquels le compte à rebours tourne.
 *
 * Il démarre à l'affectation d'un spécialiste et s'arrête quand le rapport
 * devient lisible par le demandeur - c'est-à-dire à `RAPPORT_TRANSMIS`, posé
 * par `validerRapport` en même temps que `validatedAt`.
 *
 * `RAPPORT_SOUMIS` en fait donc partie : le spécialiste a rendu sa copie, mais
 * tant que la coordination n'a pas validé, le demandeur n'a rien. Laisser le
 * chrono courir pendant ce temps est délibéré - c'est ce qui empêche un rapport
 * de dormir une semaine en attente de contrôle.
 */
const STATUTS_EN_COURS = [
  'AFFECTE',
  'ACCEPTE_PAR_SPECIALISTE',
  'EN_ANALYSE',
  'INFORMATION_COMPLEMENTAIRE_DEMANDEE',
  'RAPPORT_EN_PREPARATION',
  'RAPPORT_SOUMIS',
]

/** Instant où l'engagement de délai est dépassé. */
function echeanceDe(assignedAt) {
  return new Date(new Date(assignedAt).getTime() + env.delaiReponse.heures * MS_PAR_HEURE)
}

/**
 * `normal` | `alerte` | `depasse`.
 *
 * Calculé côté serveur pour que la couleur affichée ne dépende pas de l'horloge
 * du poste du coordinateur.
 */
function niveauDelai(assignedAt, maintenant = new Date()) {
  if (!assignedAt) return null

  const debut = new Date(assignedAt).getTime()
  const ecoulees = (maintenant.getTime() - debut) / MS_PAR_HEURE

  if (ecoulees >= env.delaiReponse.heures) return 'depasse'
  if (ecoulees >= env.delaiReponse.alerteHeures) return 'alerte'
  return 'normal'
}

/**
 * Dossiers dont le chrono tourne, du plus urgent au moins urgent.
 *
 * L'échéance est rendue en absolu plutôt qu'en durée restante : une durée
 * calculée au moment de la requête serait fausse dès la seconde suivante, alors
 * qu'une date permet à l'écran de décompter tout seul.
 */
async function dossiersEnCours() {
  const dossiers = await prisma.dossier.findMany({
    where: { status: { in: STATUTS_EN_COURS }, assignedAt: { not: null } },
    orderBy: { assignedAt: 'asc' },
    include: {
      patient: { include: { user: { select: safeUserSelect } } },
      specialiste: { include: { user: { select: safeUserSelect } } },
      demandeurMedecin: { include: { user: { select: safeUserSelect } } },
      rapport: { select: { id: true, status: true, submittedAt: true } },
    },
  })

  const maintenant = new Date()
  return dossiers.map((dossier) => ({
    ...dossier,
    delai: {
      demarreLe: dossier.assignedAt,
      echeanceLe: echeanceDe(dossier.assignedAt),
      // Borne de mi-parcours en absolu : l'ecran change de couleur tout seul
      // en la franchissant, sans avoir a connaitre le reglage du serveur ni a
      // redemander la liste.
      alerteLe: new Date(new Date(dossier.assignedAt).getTime() + env.delaiReponse.alerteHeures * MS_PAR_HEURE),
      niveau: niveauDelai(dossier.assignedAt, maintenant),
      // Rendu pour que l'écran puisse corriger un décalage d'horloge plutôt que
      // d'afficher un compte à rebours faux de plusieurs minutes.
      maintenant,
    },
  }))
}

/**
 * Alerte de mi-parcours.
 *
 * Une seule fois par dossier : `alerteDelaiEnvoyeeLe` sert de témoin. Sans lui,
 * la tâche renverrait la même alerte à chaque passage horaire, et la
 * coordination cesserait de les lire en deux jours.
 */
async function envoyerAlertesDelai(maintenant = new Date()) {
  const seuil = new Date(maintenant.getTime() - env.delaiReponse.alerteHeures * MS_PAR_HEURE)

  const enRetard = await prisma.dossier.findMany({
    where: {
      status: { in: STATUTS_EN_COURS },
      assignedAt: { not: null, lte: seuil },
      alerteDelaiEnvoyeeLe: null,
    },
    include: { specialiste: { include: { user: { select: safeUserSelect } } } },
  })

  if (enRetard.length === 0) return { alertes: 0 }

  const coordination = await prisma.user.findMany({
    where: { role: { in: ['COORDINATEUR', 'ADMIN'] }, active: true },
    select: { id: true, email: true, fullName: true },
  })

  for (const dossier of enRetard) {
    const heuresRestantes = Math.max(
      0,
      Math.round((echeanceDe(dossier.assignedAt).getTime() - maintenant.getTime()) / MS_PAR_HEURE),
    )

    for (const membre of coordination) {
      await notify(
        membre.id,
        membre.email,
        'DELAI_REPONSE_ALERTE',
        {
          name: membre.fullName,
          reference: dossier.reference,
          specialiste: dossier.specialiste?.user.fullName ?? 'non assigné',
          heuresRestantes,
        },
        { dossierId: dossier.id },
      )
    }

    // Marqué après l'envoi : si la notification échoue, l'alerte repartira au
    // passage suivant plutôt que d'être perdue.
    await prisma.dossier.update({
      where: { id: dossier.id },
      data: { alerteDelaiEnvoyeeLe: maintenant },
    })
  }

  return { alertes: enRetard.length }
}

function startDelaiReponseCron() {
  // Toutes les heures : l'alerte est à 24 h d'une échéance à 48 h, une heure de
  // retard ne change rien à la capacité d'agir, et un passage plus fréquent
  // interrogerait la base pour rien.
  cron.schedule('0 * * * *', () => {
    envoyerAlertesDelai().catch((err) => console.error('alerte de délai échouée', err))
  })
}

module.exports = {
  STATUTS_EN_COURS,
  echeanceDe,
  niveauDelai,
  dossiersEnCours,
  envoyerAlertesDelai,
  startDelaiReponseCron,
}
