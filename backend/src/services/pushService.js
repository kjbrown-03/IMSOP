/**
 * Notifications poussées vers les appareils.
 *
 * POURQUOI PAS APNs
 *
 * APNs est le service d'Apple pour les applications natives : compte
 * développeur payant, certificats, passage par l'App Store. IMSOP est une
 * application web installable, et depuis iOS 16.4 Safari accepte les
 * notifications web standard — c'est Apple qui fait le pont vers APNs en
 * interne. On parle donc le protocole Web Push, et il couvre iPhone, Android et
 * ordinateur avec le même code.
 *
 * DEUX CONTRAINTES D'APPLE, QU'ON NE PEUT PAS CONTOURNER
 *
 * 1. Sur iPhone, l'application doit avoir été ajoutée à l'écran d'accueil. Dans
 *    un simple onglet Safari, aucune notification n'arrive.
 * 2. L'autorisation doit être demandée depuis un geste de l'utilisateur — un
 *    bouton qu'il touche. Une demande automatique au chargement est refusée.
 *
 * CE QUI VOYAGE
 *
 * Le contenu est chiffré par le navigateur destinataire avec ses propres clés :
 * le service de notification (Apple, Google, Mozilla) achemine sans pouvoir
 * lire. On évite malgré tout d'y mettre quoi que ce soit de médical — voir
 * `composer()` plus bas.
 */
const webpush = require('web-push')
const { prisma } = require('../lib/prisma')
const env = require('../config/env')

let configure = false

/**
 * Les clés VAPID identifient CE serveur auprès des services de notification.
 * Sans elles, rien ne part — et c'est un cas normal en développement, pas une
 * panne : on le signale une fois et on continue sans notifications.
 */
function pret() {
  if (configure) return true
  const { publicKey, privateKey, contact } = env.push || {}
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(contact || 'mailto:contact@imsop.org', publicKey, privateKey)
  configure = true
  return true
}

/**
 * Ce que l'appareil affiche.
 *
 * VOLONTAIREMENT POBRE EN DÉTAILS MÉDICAUX.
 *
 * Une notification s'affiche sur un écran verrouillé, que n'importe qui à côté
 * du patient peut lire. « Nouveau message dans votre dossier » suffit à faire
 * ouvrir l'application ; « Résultats de votre test VIH disponibles » exposerait
 * une information de santé à toute la pièce.
 *
 * Le titre et le corps sont donc génériques par type. Le détail est dans
 * l'application, derrière l'authentification.
 */
function composer(type, donnees = {}) {
  const MODELES = {
    MESSAGE: {
      titre: 'Nouveau message',
      corps: 'Vous avez reçu un message dans votre dossier.',
      url: donnees.dossierId ? `/dossiers/${donnees.dossierId}` : '/',
    },
    APPEL: {
      titre: 'Appel entrant',
      corps: "Quelqu'un cherche à vous joindre.",
      url: donnees.dossierId ? `/dossiers/${donnees.dossierId}` : '/',
      // Un appel ne vaut rien s'il arrive après coup.
      urgent: true,
    },
    DOSSIER: {
      titre: 'Votre dossier a avancé',
      corps: 'Une nouvelle étape a été franchie.',
      url: donnees.dossierId ? `/dossiers/${donnees.dossierId}` : '/',
    },
    COORDINATION: {
      titre: 'Action attendue',
      corps: 'Un élément attend votre revue sur la plateforme.',
      url: donnees.url || '/coordinateur',
    },
  }

  const modele = MODELES[type] || MODELES.DOSSIER
  return {
    titre: modele.titre,
    corps: modele.corps,
    url: modele.url,
    type,
    urgent: Boolean(modele.urgent),
  }
}

/**
 * Envoie à tous les appareils d'un utilisateur.
 *
 * Ne lève jamais : une notification est un confort, et son échec ne doit pas
 * faire échouer l'action qui l'a déclenchée — un message envoyé reste envoyé
 * même si le téléphone du destinataire est injoignable.
 */
async function envoyer(userId, type, donnees = {}) {
  if (!pret()) return { envoyes: 0, retires: 0 }

  const abonnements = await prisma.pushSubscription.findMany({ where: { userId } })
  if (!abonnements.length) return { envoyes: 0, retires: 0 }

  const contenu = composer(type, donnees)
  const charge = JSON.stringify(contenu)
  // `urgency` dit au service de notification s'il peut retarder la remise pour
  // economiser la batterie, `TTL` combien de temps la garder si l'appareil est
  // eteint. Un appel ne supporte ni l'un ni l'autre ; le reste si.
  const options = contenu.urgent
    ? { TTL: 60, urgency: 'high' }
    : { TTL: 86400, urgency: 'normal' }
  let envoyes = 0
  const aRetirer = []

  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          charge,
          options,
        )
        envoyes += 1
        await prisma.pushSubscription.update({
          where: { id: a.id },
          data: { lastSuccess: new Date(), echecs: 0 },
        })
      } catch (err) {
        // 404 et 410 sont définitifs : le navigateur a révoqué cet abonnement,
        // l'application a été désinstallée ou les données du site effacées. Le
        // garder ne ferait qu'échouer indéfiniment.
        if (err.statusCode === 404 || err.statusCode === 410) {
          aRetirer.push(a.id)
          return
        }
        // Le reste peut être passager (réseau, service momentanément indisponible).
        // On compte, et on abandonne au bout de cinq échecs d'affilée.
        const echecs = a.echecs + 1
        if (echecs >= 5) aRetirer.push(a.id)
        else await prisma.pushSubscription.update({ where: { id: a.id }, data: { echecs } }).catch(() => {})
      }
    }),
  )

  if (aRetirer.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: aRetirer } } }).catch(() => {})
  }

  return { envoyes, retires: aRetirer.length }
}

/**
 * Enregistre un appareil. Le même appareil qui se réabonne remplace son entrée
 * plutôt que d'en créer une seconde : `endpoint` est unique.
 */
async function abonner(userId, abonnement, userAgent) {
  const { endpoint, keys } = abonnement
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
    },
    // Un endpoint peut changer de main : même navigateur, autre compte. On
    // réaffecte plutôt que de laisser la notification partir au précédent.
    update: { userId, p256dh: keys.p256dh, auth: keys.auth, echecs: 0 },
  })
}

async function desabonner(userId, endpoint) {
  await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } })
}

module.exports = { envoyer, abonner, desabonner, composer, pret }
