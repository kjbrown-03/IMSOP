const cron = require('node-cron')
const { prisma } = require('../lib/prisma')
const { notify } = require('./notificationService')

// CDC §16 : une habilitation porte une date de fin. Elle était bien saisie et
// affichée, mais jamais comparée à la date du jour — un praticien dont la
// licence avait expiré restait VALIDE, donc toujours affectable. Ce service
// fait la bascule VALIDE → EXPIRE le jour où la date est franchie.
//
// La règle reproduit celle de `statuerHabilitation` : un spécialiste qui perd
// son habilitation sort aussi du moteur d'affectation (`disponible: false`).

// Les deux profils portent les mêmes colonnes mais vivent dans deux tables :
// on traite chacune avec son delegate Prisma plutôt que de dupliquer la logique.
const PROFILS = [
  { role: 'SPECIALISTE', delegate: () => prisma.specialiste, retireDuPool: true },
  { role: 'MEDECIN_LOCAL', delegate: () => prisma.medecinLocal, retireDuPool: false },
]

async function expirerHabilitations(now = new Date()) {
  const expires = []

  for (const { role, delegate, retireDuPool } of PROFILS) {
    const echus = await delegate().findMany({
      where: { verificationStatus: 'VALIDE', habilitationExpireLe: { lte: now } },
      select: {
        userId: true,
        habilitationExpireLe: true,
        user: { select: { email: true, fullName: true } },
      },
    })
    if (echus.length === 0) continue

    const userIds = echus.map((e) => e.userId)

    // Une transaction par table : si la notification échoue plus bas, le statut
    // reste correct en base — l'inverse (praticien notifié mais toujours VALIDE)
    // serait bien pire.
    await prisma.$transaction([
      delegate().updateMany({
        where: { userId: { in: userIds } },
        data: { verificationStatus: 'EXPIRE' },
      }),
      ...(retireDuPool
        ? [delegate().updateMany({ where: { userId: { in: userIds } }, data: { disponible: false } })]
        : []),
      prisma.auditLog.createMany({
        data: echus.map((e) => ({
          // Pas de `userId` acteur : la décision vient du planificateur, pas
          // d'un coordinateur. `entityId` porte le praticien concerné.
          action: 'HABILITATION_EXPIREE',
          entityType: 'User',
          entityId: e.userId,
          metadata: { role, de: 'VALIDE', vers: 'EXPIRE', expireLe: e.habilitationExpireLe },
        })),
      }),
    ])

    expires.push(...echus.map((e) => ({ ...e, role })))
  }

  // Notifications hors transaction : un envoi lent ou en échec ne doit pas
  // faire retomber une bascule de statut déjà décidée.
  for (const e of expires) {
    try {
      await notify(e.userId, e.user.email, 'HABILITATION_STATUT', {
        name: e.user.fullName,
        statut: 'EXPIRE',
        motif: "La date de fin de votre habilitation est dépassée. Déposez une licence à jour pour être réhabilité.",
      })
    } catch (err) {
      console.error('habilitation expiry: notification failed for', e.userId, err)
    }
  }

  return expires.length
}

function startHabilitationExpiryCron() {
  // Une fois par jour à 02:00, avant la clôture des messageries de 03:00.
  cron.schedule('0 2 * * *', () => {
    expirerHabilitations().catch((err) => console.error('habilitation expiry failed', err))
  })
}

module.exports = { startHabilitationExpiryCron, expirerHabilitations }
