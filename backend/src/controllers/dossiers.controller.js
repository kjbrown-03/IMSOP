const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { safeUserSelect } = require('../lib/selectors')
const { genererReferenceDossier } = require('../services/referenceService')
const env = require('../config/env')

async function loadDossierWithAccessCheck(req, dossierId) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      patient: { include: { user: { select: safeUserSelect } } },
      specialiste: { include: { user: { select: safeUserSelect } } },
      medecinLocal: { include: { user: { select: safeUserSelect } } },
    },
  })
  if (!dossier) return { error: 404, message: 'Dossier introuvable' }

  if (req.userRole === 'PATIENT' && dossier.patient.userId !== req.userId) {
    return { error: 403, message: 'Ce dossier ne vous appartient pas' }
  }
  if (req.userRole === 'SPECIALISTE') {
    const specialiste = await prisma.specialiste.findUnique({ where: { userId: req.userId } })
    if (!specialiste || dossier.specialisteId !== specialiste.id) {
      return { error: 403, message: "Ce dossier ne vous est pas assigné" }
    }
  }
  if (req.userRole === 'MEDECIN_LOCAL') {
    const medecin = await prisma.medecinLocal.findUnique({ where: { userId: req.userId } })
    if (!medecin || dossier.medecinLocalId !== medecin.id) {
      return { error: 403, message: "Vous n'êtes pas le médecin traitant désigné sur ce dossier" }
    }
  }
  // COORDINATEUR and ADMIN can access any dossier

  return { dossier }
}

async function createDossier(req, res) {
  const patient = await prisma.patient.findUnique({ where: { userId: req.userId } })
  if (!patient) return res.status(403).json({ message: 'Seuls les patients peuvent créer un dossier' })

  const { specialiteRequise, motif, questionMedicale, symptomes, antecedents, traitementEnCours, urgence } = req.body

  const reference = await genererReferenceDossier(patient.country)

  const dossier = await prisma.dossier.create({
    data: {
      reference,
      patientId: patient.id,
      specialiteRequise,
      motif,
      questionMedicale,
      symptomes,
      antecedents,
      traitementEnCours,
      urgence: urgence || 'NORMAL',
      status: 'BROUILLON',
    },
  })

  await logAction({ userId: req.userId, action: 'DOSSIER_CREATE', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })
  res.status(201).json(dossier)
}

async function listDossiers(req, res) {
  let where = {}

  if (req.userRole === 'PATIENT') {
    const patient = await prisma.patient.findUnique({ where: { userId: req.userId } })
    where = { patientId: patient.id }
  } else if (req.userRole === 'SPECIALISTE') {
    const specialiste = await prisma.specialiste.findUnique({ where: { userId: req.userId } })
    where = { specialisteId: specialiste?.id }
  } else if (req.userRole === 'MEDECIN_LOCAL') {
    const medecin = await prisma.medecinLocal.findUnique({ where: { userId: req.userId } })
    where = { medecinLocalId: medecin?.id ?? '__none__' }
  } else if (req.query.status) {
    where = { status: req.query.status }
  }

  const { page, pageSize } = req.query

  const [dossiers, total] = await Promise.all([
    prisma.dossier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        patient: { include: { user: { select: safeUserSelect } } },
        specialiste: { include: { user: { select: safeUserSelect } } },
        medecinLocal: { include: { user: { select: safeUserSelect } } },
      },
    }),
    prisma.dossier.count({ where }),
  ])

  res.json({ items: dossiers, total, page, pageSize })
}

async function getDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })

  await logAction({
    userId: req.userId,
    action: 'DOSSIER_VIEW',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    ipAddress: req.ip,
  })

  res.json(dossier)
}

async function updateDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })

  if (req.userRole === 'PATIENT' && !['BROUILLON', 'SOUMIS'].includes(dossier.status)) {
    return res.status(400).json({ message: 'Ce dossier ne peut plus être modifié par le patient' })
  }

  // req.body is already restricted to the known dossier fields by the route's
  // Zod schema (.strict()), so it's safe to pass straight through to Prisma.
  const updated = await prisma.dossier.update({ where: { id: dossier.id }, data: req.body })
  await logAction({ userId: req.userId, action: 'DOSSIER_UPDATE', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id, metadata: req.body })
  res.json(updated)
}

async function soumettreDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (dossier.status !== 'BROUILLON') return res.status(400).json({ message: 'Ce dossier a déjà été soumis' })

  const updated = await prisma.dossier.update({
    where: { id: dossier.id },
    data: { status: 'EN_ATTENTE_PAIEMENT' },
  })

  await logAction({ userId: req.userId, action: 'DOSSIER_SOUMIS', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })
  await notify(dossier.patient.userId, dossier.patient.user.email, 'DOSSIER_SOUMIS', {
    name: dossier.patient.user.fullName,
    reference: dossier.reference,
  })

  res.json(updated)
}

async function assignerSpecialiste(req, res) {
  const dossier = await prisma.dossier.findUnique({
    where: { id: req.params.id },
    include: { patient: { include: { user: { select: safeUserSelect } } } },
  })
  if (!dossier) return res.status(404).json({ message: 'Dossier introuvable' })

  const { specialisteId } = req.body
  const specialiste = await prisma.specialiste.findUnique({
    where: { id: specialisteId },
    include: { user: { select: safeUserSelect } },
  })
  if (!specialiste) return res.status(404).json({ message: 'Spécialiste introuvable' })

  const messagingClosesAt = new Date(Date.now() + env.messaging.autoCloseDays * 24 * 60 * 60 * 1000)

  const updated = await prisma.dossier.update({
    where: { id: dossier.id },
    data: { specialisteId, status: 'AFFECTE', assignedAt: new Date(), messagingClosesAt },
  })

  await logAction({
    userId: req.userId,
    action: 'DOSSIER_ASSIGNE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { specialisteId },
  })

  await notify(specialiste.userId, specialiste.user.email, 'NOUVEAU_DOSSIER_SPECIALISTE', {
    name: specialiste.user.fullName,
    reference: dossier.reference,
  })
  await notify(dossier.patient.userId, dossier.patient.user.email, 'DOSSIER_AFFECTE', {
    name: dossier.patient.user.fullName,
    reference: dossier.reference,
  })

  res.json(updated)
}

async function accepterDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })
  if (dossier.status !== 'AFFECTE') return res.status(400).json({ message: 'Ce dossier ne peut pas être accepté dans son état actuel' })

  const updated = await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'ACCEPTE_PAR_SPECIALISTE' } })
  await logAction({ userId: req.userId, action: 'DOSSIER_ACCEPTE', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })
  res.json(updated)
}

async function demarrerAnalyse(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })
  if (!['ACCEPTE_PAR_SPECIALISTE', 'INFORMATION_COMPLEMENTAIRE_DEMANDEE'].includes(dossier.status)) {
    return res.status(400).json({ message: "L'analyse ne peut pas démarrer dans l'état actuel du dossier" })
  }

  const updated = await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'EN_ANALYSE' } })
  await logAction({ userId: req.userId, action: 'DOSSIER_ANALYSE_DEMARREE', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })
  res.json(updated)
}

// CDC 18, troisieme action du specialiste : « Demander des informations
// complementaires -> le dossier retourne au coordinateur ou au medecin local ».
// La demande est postee dans la messagerie du dossier pour que le destinataire
// sache ce qui manque, et pas seulement que quelque chose manque.
async function demanderComplement(req, res) {
  const { dossier, error, message: err } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message: err })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })
  if (!['ACCEPTE_PAR_SPECIALISTE', 'EN_ANALYSE', 'RAPPORT_EN_PREPARATION'].includes(dossier.status)) {
    return res.status(400).json({ message: "Aucune information complémentaire ne peut être demandée dans l'état actuel" })
  }

  const { precisions } = req.body

  const [updated] = await prisma.$transaction([
    prisma.dossier.update({
      where: { id: dossier.id },
      data: { status: 'INFORMATION_COMPLEMENTAIRE_DEMANDEE' },
    }),
    prisma.message.create({
      data: { dossierId: dossier.id, senderId: req.userId, body: precisions },
    }),
  ])

  await logAction({
    userId: req.userId,
    action: 'DOSSIER_COMPLEMENT_DEMANDE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { precisions },
  })

  const destinataires = [dossier.patient?.user, dossier.medecinLocal?.user].filter(Boolean)
  for (const destinataire of destinataires) {
    await notify(destinataire.id, destinataire.email, 'COMPLEMENT_DEMANDE', {
      name: destinataire.fullName,
      reference: dossier.reference,
      precisions,
    }, { dossierId: dossier.id })
  }

  res.json(updated)
}

// Rendre la main au specialiste une fois le complement depose. Ouvert au patient
// et au medecin traitant, qui sont ceux qui fournissent les pieces, ainsi qu'au
// coordinateur qui arbitre (CDC 5.6).
async function complementFourni(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (dossier.status !== 'INFORMATION_COMPLEMENTAIRE_DEMANDEE') {
    return res.status(400).json({ message: "Aucune information complémentaire n'est attendue sur ce dossier" })
  }

  const updated = await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'EN_ANALYSE' } })
  await logAction({ userId: req.userId, action: 'DOSSIER_COMPLEMENT_FOURNI', entityType: 'Dossier', entityId: dossier.id, dossierId: dossier.id })

  if (dossier.specialiste?.user) {
    await notify(dossier.specialiste.user.id, dossier.specialiste.user.email, 'COMPLEMENT_FOURNI', {
      name: dossier.specialiste.user.fullName,
      reference: dossier.reference,
    }, { dossierId: dossier.id })
  }

  res.json(updated)
}

// Transitions pilotees par la coordination (CDC 5.6, 13, 52). La liste blanche
// evite qu'un dossier saute des etapes du workflow.
const TRANSITIONS_COORDINATION = {
  EN_ATTENTE_DOCUMENTS: ['SOUMIS', 'EN_VERIFICATION', 'COMPLET'],
  EN_VERIFICATION: ['SOUMIS', 'EN_ATTENTE_DOCUMENTS', 'EN_ATTENTE_PAIEMENT'],
  COMPLET: ['EN_VERIFICATION', 'EN_ATTENTE_DOCUMENTS'],
  EN_ATTENTE_AFFECTATION: ['COMPLET'],
  SUIVI: ['RAPPORT_TRANSMIS'],
  CLOTURE: ['RAPPORT_TRANSMIS', 'SUIVI'],
  ANNULE: ['BROUILLON', 'SOUMIS', 'EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_DOCUMENTS', 'EN_VERIFICATION', 'COMPLET', 'EN_ATTENTE_AFFECTATION'],
}

async function changerStatut(req, res) {
  const dossier = await prisma.dossier.findUnique({ where: { id: req.params.id } })
  if (!dossier) return res.status(404).json({ message: 'Dossier introuvable' })

  const { status, motif } = req.body
  const depuis = TRANSITIONS_COORDINATION[status]
  if (!depuis) {
    return res.status(400).json({ message: "Ce statut n'est pas pilotable depuis la coordination" })
  }
  if (!depuis.includes(dossier.status)) {
    return res.status(400).json({
      message: `Transition impossible : un dossier « ${dossier.status} » ne peut pas passer à « ${status} »`,
    })
  }

  const updated = await prisma.dossier.update({ where: { id: dossier.id }, data: { status } })
  await logAction({
    userId: req.userId,
    action: 'DOSSIER_STATUT_CHANGE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { de: dossier.status, vers: status, motif },
    ipAddress: req.ip,
  })
  res.json(updated)
}

async function refuserDossier(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE') return res.status(403).json({ message: 'Réservé au spécialiste assigné' })

  const { motif } = req.body
  const updated = await prisma.dossier.update({
    where: { id: dossier.id },
    data: { status: 'EN_ATTENTE_AFFECTATION', specialisteId: null },
  })

  await logAction({
    userId: req.userId,
    action: 'DOSSIER_REFUSE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { motif },
  })

  res.json(updated)
}

// The patient designates his own treating doctor - the coordinator never does it
// for him. Access to a medical record is therefore granted by the patient, and
// the COMMUNICATION_MEDECIN consent is recorded in the same transaction as proof.
async function designerMedecinLocal(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'PATIENT') {
    return res.status(403).json({ message: 'Seul le patient peut désigner son médecin traitant' })
  }

  const { email } = req.body
  const user = await prisma.user.findUnique({ where: { email }, include: { medecinLocal: true } })
  if (!user || user.role !== 'MEDECIN_LOCAL' || !user.medecinLocal) {
    return res.status(404).json({ message: "Aucun compte médecin local n'est enregistré avec cette adresse e-mail" })
  }
  if (!user.active) {
    return res.status(400).json({ message: 'Ce compte médecin est désactivé' })
  }
  // Un praticien suspendu, expiré ou révoqué ne doit plus pouvoir être rattaché
  // à un dossier (CDC §16). EN_VERIFICATION reste accepté : c'est le consentement
  // du patient qui fonde l'accès (§4.2), la vérification de l'ordre suit son cours.
  if (['SUSPENDU', 'EXPIRE', 'REVOQUE'].includes(user.medecinLocal.verificationStatus)) {
    return res.status(400).json({
      message: "L'habilitation de ce médecin n'est plus active sur la plateforme",
    })
  }

  const [updated] = await prisma.$transaction([
    prisma.dossier.update({
      where: { id: dossier.id },
      data: { medecinLocalId: user.medecinLocal.id },
      include: { medecinLocal: { include: { user: { select: safeUserSelect } } } },
    }),
    prisma.consentement.create({
      data: {
        dossierId: dossier.id,
        patientId: dossier.patientId,
        type: 'COMMUNICATION_MEDECIN',
        accepted: true,
        ipAddress: req.ip,
      },
    }),
  ])

  await logAction({
    userId: req.userId,
    action: 'MEDECIN_LOCAL_DESIGNE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { medecinLocalId: user.medecinLocal.id, email },
    ipAddress: req.ip,
  })

  await notify(user.id, user.email, 'MEDECIN_LOCAL_RATTACHE', {
    name: user.fullName,
    patientName: dossier.patient.user.fullName,
    reference: dossier.reference,
  }, { dossierId: dossier.id })

  res.json(updated)
}

// Revoking is a patient right and must stay one click away: the médecin local
// loses access to the record the moment the link is cut.
async function retirerMedecinLocal(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.id)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'PATIENT') {
    return res.status(403).json({ message: 'Seul le patient peut retirer son médecin traitant' })
  }

  const [updated] = await prisma.$transaction([
    prisma.dossier.update({ where: { id: dossier.id }, data: { medecinLocalId: null } }),
    prisma.consentement.create({
      data: {
        dossierId: dossier.id,
        patientId: dossier.patientId,
        type: 'COMMUNICATION_MEDECIN',
        accepted: false,
        ipAddress: req.ip,
      },
    }),
  ])

  await logAction({
    userId: req.userId,
    action: 'MEDECIN_LOCAL_RETIRE',
    entityType: 'Dossier',
    entityId: dossier.id,
    dossierId: dossier.id,
    metadata: { medecinLocalId: dossier.medecinLocalId },
    ipAddress: req.ip,
  })

  res.json(updated)
}

module.exports = {
  createDossier,
  listDossiers,
  getDossier,
  updateDossier,
  soumettreDossier,
  assignerSpecialiste,
  accepterDossier,
  refuserDossier,
  demarrerAnalyse,
  demanderComplement,
  complementFourni,
  changerStatut,
  designerMedecinLocal,
  retirerMedecinLocal,
  loadDossierWithAccessCheck,
}
