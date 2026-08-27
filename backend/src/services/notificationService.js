const { prisma } = require('../lib/prisma')
const { sendMail } = require('../lib/mailer')

const TEMPLATES = {
  DOSSIER_SOUMIS: {
    subject: 'Votre dossier IMSOP a été soumis',
    body: (ctx) => `Bonjour ${ctx.name},\n\nVotre dossier ${ctx.reference} a bien été soumis et est en cours de vérification.\n\nL'équipe IMSOP`,
  },
  DOSSIER_AFFECTE: {
    subject: 'Un spécialiste a été affecté à votre dossier',
    body: (ctx) => `Bonjour ${ctx.name},\n\nUn spécialiste a été affecté à votre dossier ${ctx.reference}. Vous serez notifié dès que l'analyse sera terminée.\n\nL'équipe IMSOP`,
  },
  RAPPORT_DISPONIBLE: {
    subject: 'Votre rapport de deuxième avis est disponible',
    body: (ctx) => `Bonjour ${ctx.name},\n\nLe rapport du spécialiste pour votre dossier ${ctx.reference} est maintenant disponible dans votre espace patient.\n\nL'équipe IMSOP`,
  },
  PAIEMENT_CONFIRME: {
    subject: 'Paiement confirmé',
    body: (ctx) => `Bonjour ${ctx.name},\n\nVotre paiement pour le dossier ${ctx.reference} a été confirmé. Votre dossier va être transmis à notre équipe de coordination.\n\nL'équipe IMSOP`,
  },
  NOUVEAU_DOSSIER_SPECIALISTE: {
    subject: 'Nouveau dossier assigné',
    body: (ctx) => `Bonjour ${ctx.name},\n\nUn nouveau dossier (${ctx.reference}) vous a été assigné sur MedLink Africa / IMSOP. Merci de le consulter rapidement.\n\nL'équipe IMSOP`,
  },
  MESSAGE_RECU: {
    subject: 'Nouveau message sécurisé',
    body: (ctx) => `Bonjour ${ctx.name},\n\nVous avez reçu un nouveau message concernant le dossier ${ctx.reference}.\n\nL'équipe IMSOP`,
  },
  DEUX_FACTEURS: {
    // Flux d'authentification : le destinataire n'est PAS connecté au moment de
    // l'envoi, une entrée dans la cloche ne lui servirait à rien et polluerait
    // son centre de notifications. Le contenu est en outre sensible (code,
    // lien de réinitialisation) et n'a pas à être conservé en base.
    courrielSeulement: true,
    subject: 'Votre code de connexion IMSOP',
    body: (ctx) => `Bonjour ${ctx.name},\n\nVotre code de vérification pour vous connecter est : ${ctx.code}\n\nCe code est valable 10 minutes.\n\nL'équipe IMSOP`,
  },
  MEDECIN_LOCAL_RATTACHE: {
    subject: 'Un patient vous a désigné comme médecin traitant',
    body: (ctx) => `Bonjour Dr ${ctx.name},\n\n${ctx.patientName} vous a désigné comme son médecin traitant pour le dossier ${ctx.reference} sur IMSOP. Vous pouvez désormais consulter ce dossier, y déposer des pièces et échanger dans la messagerie sécurisée.\n\nL'équipe IMSOP`,
  },
  PIECE_JOINTE_RECUE: {
    subject: 'Nouveau document dans la messagerie sécurisée',
    body: (ctx) => `Bonjour ${ctx.name},\n\n${ctx.senderName} a déposé un document (${ctx.filename}) dans la conversation du dossier ${ctx.reference}.\n\nL'équipe IMSOP`,
  },
  COMPLEMENT_DEMANDE: {
    subject: 'Information complémentaire demandée sur votre dossier',
    body: (ctx) => `Bonjour ${ctx.name},\n\nLe spécialiste a besoin d'un complément pour poursuivre l'analyse du dossier ${ctx.reference} :\n\n${ctx.precisions}\n\nVous pouvez répondre et déposer les pièces demandées depuis la messagerie sécurisée.\n\nL'équipe IMSOP`,
  },
  COMPLEMENT_FOURNI: {
    subject: 'Le complément demandé a été déposé',
    body: (ctx) => `Bonjour ${ctx.name},\n\nLes informations complémentaires que vous aviez demandées pour le dossier ${ctx.reference} ont été déposées. Vous pouvez reprendre votre analyse.\n\nL'équipe IMSOP`,
  },
  HABILITATION_STATUT: {
    subject: 'Mise à jour de votre habilitation IMSOP',
    body: (ctx) => `Bonjour ${ctx.name},\n\nLe statut de votre habilitation professionnelle sur IMSOP est désormais : ${ctx.statut}.\n${ctx.motif ? `Motif : ${ctx.motif}` + '\n' : ''}\nL'équipe IMSOP`,
  },
  MOT_DE_PASSE_RESET: {
    // Flux d'authentification : le destinataire n'est PAS connecté au moment de
    // l'envoi, une entrée dans la cloche ne lui servirait à rien et polluerait
    // son centre de notifications. Le contenu est en outre sensible (code,
    // lien de réinitialisation) et n'a pas à être conservé en base.
    courrielSeulement: true,
    subject: 'Réinitialisation de votre mot de passe IMSOP',
    body: (ctx) => `Bonjour ${ctx.name},\n\nVous avez demandé la réinitialisation de votre mot de passe. Ce lien est valable 1 heure :\n${ctx.resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.\n\nL'équipe IMSOP`,
  },
  VERIFICATION_EMAIL: {
    subject: 'Vérifiez votre adresse e-mail IMSOP',
    body: (ctx) => `Bonjour ${ctx.name},\n\nVotre code de vérification est : ${ctx.code}\n\nCe code est valable 15 minutes.\n\nL'équipe IMSOP`,
  },
  INSCRIPTION_EXISTANTE: {
    // Flux d'authentification : le destinataire n'est PAS connecté au moment de
    // l'envoi, une entrée dans la cloche ne lui servirait à rien et polluerait
    // son centre de notifications. Le contenu est en outre sensible (code,
    // lien de réinitialisation) et n'a pas à être conservé en base.
    courrielSeulement: true,
    subject: 'Tentative de création de compte avec votre adresse',
    body: (ctx) => `Bonjour ${ctx.name},

Quelqu'un vient de tenter de créer un compte IMSOP avec votre adresse e-mail. Aucun nouveau compte n'a été créé : le vôtre existe déjà.

Si c'était vous, connectez-vous normalement. Si vous avez oublié votre mot de passe, utilisez « Mot de passe oublié ».

Si ce n'était pas vous, vous pouvez ignorer ce message : personne n'a eu accès à votre compte.

L'équipe IMSOP`,
  },
  IDENTITE_VALIDEE: {
    subject: 'Votre identité a été vérifiée',
    body: (ctx) => `Bonjour ${ctx.name},\n\nVotre pièce d'identité a été vérifiée par notre équipe de coordination. Votre compte est maintenant pleinement vérifié.\n\nL'équipe IMSOP`,
  },
  IDENTITE_REFUSEE: {
    subject: "Votre pièce d'identité n'a pas pu être validée",
    body: (ctx) => `Bonjour ${ctx.name},\n\nVotre pièce d'identité n'a pas pu être validée pour le motif suivant : ${ctx.reason}\n\nMerci de téléverser un nouveau document depuis votre espace patient.\n\nL'équipe IMSOP`,
  },
}

// `options.dossierId` attaches the notification to a dossier so the in-app bell
// can link straight to the matching conversation or file.
async function notify(userId, email, type, context, options = {}) {
  const template = TEMPLATES[type]
  if (!template) throw new Error(`Unknown notification type: ${type}`)

  // Envoi direct, sans trace en base : rien à afficher dans la cloche, et le
  // code ou le lien ne survit pas à l'e-mail.
  if (template.courrielSeulement) {
    sendMail({ to: email, subject: template.subject, text: template.body(context) })
      .catch((err) => console.error('notification send failed', err))
    return null
  }

  // The row is written before the SMTP round-trip, not after: the bell reads
  // these rows, and a real relay regularly takes >10s to answer. Delivery
  // status is patched in once the mail attempt settles.
  const notification = await prisma.notification.create({
    data: {
      userId,
      channel: 'EMAIL',
      type,
      payload: context,
      status: 'PENDING',
      dossierId: options.dossierId ?? null,
    },
  })

  // Best-effort delivery, deliberately not awaited so it never holds up the
  // request that triggered it. A failed e-mail leaves the in-app notification
  // intact and only marks the row FAILED.
  sendMail({ to: email, subject: template.subject, text: template.body(context) })
    .then(() => prisma.notification.update({ where: { id: notification.id }, data: { status: 'SENT' } }))
    .catch((err) => {
      console.error('notification send failed', err)
      return prisma.notification.update({ where: { id: notification.id }, data: { status: 'FAILED' } })
    })
    .catch((err) => console.error('notification status update failed', err))

  return notification
}

module.exports = { notify }
