const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { notify } = require('../services/notificationService')
const { putObject } = require('../lib/s3')
const { servirObjet } = require('../lib/servirFichier')
const { buildRapportPdf } = require('../lib/pdf')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
const { safeUserSelect } = require('../lib/selectors')
const { creerHonorairePourDossier } = require('../services/honorairesService')
const { STATUTS_REDACTION, STATUTS_SOUMISSION } = require('../services/avisLocalService')

const DESTINATAIRES_RAPPORT_FINAL = new Set(['PATIENT', 'MEDECIN_LOCAL'])

const CHARGEMENT_AUTEUR = { autoriserRedacteur: true }

async function upsertBrouillon(req, res) {
  const { dossier, estRedacteur, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId, CHARGEMENT_AUTEUR)
  if (error) return res.status(error).json({ message })
  // Le role ne suffit pas : un medecin traitant a le meme que le redacteur.
  if (req.userRole !== 'SPECIALISTE' && !estRedacteur) return res.status(403).json({ message: 'Réservé au praticien assigné' })
  if (estRedacteur && !STATUTS_REDACTION.includes(dossier.status)) {
    return res.status(409).json({ message: 'Acceptez le dossier avant de rédiger votre avis' })
  }

  // L'ecran passe en lecture seule une fois le rapport remis, mais l'API acceptait
  // encore d'ecrire : un avis deja valide et lu par le patient pouvait etre
  // reecrit, sans que son PDF ne change.
  const existant = await prisma.rapport.findUnique({ where: { dossierId: dossier.id }, select: { status: true } })
  if (existant && existant.status !== 'BROUILLON') {
    return res.status(409).json({ message: 'Ce rapport a déjà été remis : il ne peut plus être modifié' })
  }

  const { synthese, diagnostic, optionsTherapeutiques } = req.body

  const rapport = await prisma.rapport.upsert({
    where: { dossierId: dossier.id },
    update: { synthese, diagnostic, optionsTherapeutiques },
    create: {
      dossierId: dossier.id,
      ...(estRedacteur ? { medecinRedacteurId: dossier.medecinRedacteurId } : { specialisteId: dossier.specialisteId }),
      synthese,
      diagnostic,
      optionsTherapeutiques,
    },
  })

  if (dossier.status === 'EN_ANALYSE') {
    await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'RAPPORT_EN_PREPARATION' } })
  }

  await logAction({ userId: req.userId, action: 'RAPPORT_BROUILLON_ENREGISTRE', entityType: 'Rapport', entityId: rapport.id, dossierId: dossier.id })
  res.json(rapport)
}

async function soumettreRapport(req, res) {
  const { dossier, estRedacteur, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId, CHARGEMENT_AUTEUR)
  if (error) return res.status(error).json({ message })
  if (req.userRole !== 'SPECIALISTE' && !estRedacteur) return res.status(403).json({ message: 'Réservé au praticien assigné' })
  if (estRedacteur && !STATUTS_SOUMISSION.includes(dossier.status)) {
    return res.status(409).json({ message: "Ce rapport ne peut pas être remis dans l'état actuel du dossier" })
  }

  const rapport = await prisma.rapport.findUnique({ where: { dossierId: dossier.id } })
  if (!rapport) return res.status(400).json({ message: 'Aucun brouillon à soumettre' })
  if (!rapport.synthese || !rapport.diagnostic) {
    return res.status(400).json({ message: 'La synthèse et le diagnostic sont requis avant soumission' })
  }

  // Ecriture conditionnelle, comme pour les paiements : resoumettre un rapport
  // deja valide le faisait redevenir SOUMIS et reculer le dossier du patient.
  const { count } = await prisma.rapport.updateMany({
    where: { id: rapport.id, status: 'BROUILLON' },
    data: { status: 'SOUMIS', submittedAt: new Date() },
  })
  if (count === 0) return res.status(409).json({ message: 'Ce rapport a déjà été remis' })
  const updated = await prisma.rapport.findUnique({ where: { id: rapport.id } })
  await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'RAPPORT_SOUMIS' } })

  await logAction({ userId: req.userId, action: 'RAPPORT_SOUMIS', entityType: 'Rapport', entityId: rapport.id, dossierId: dossier.id })
  res.json(updated)
}

// The coordinator/admin validates administrative conformity only - never the medical content.
async function validerRapport(req, res) {
  const rapport = await prisma.rapport.findUnique({
    where: { id: req.params.id },
    include: {
      dossier: {
        include: {
          patient: { include: { user: { select: safeUserSelect } } },
          // Une demande ouverte par un médecin décrit un patient anonymisé :
          // il n'y a pas de compte patient, et c'est le médecin demandeur qui
          // reçoit le rapport. Sans cette jointure, la validation d'un tel
          // dossier plantait, et le rapport n'était jamais transmis.
          demandeurMedecin: { include: { user: { select: safeUserSelect } } },
        },
      },
      specialiste: { include: { user: { select: safeUserSelect } } },
      medecinRedacteur: { include: { user: { select: safeUserSelect } } },
    },
  })
  if (!rapport) return res.status(404).json({ message: 'Rapport introuvable' })
  if (rapport.status !== 'SOUMIS') return res.status(400).json({ message: 'Ce rapport doit être soumis avant validation' })

  const destinataire = rapport.dossier.patient?.user ?? rapport.dossier.demandeurMedecin?.user ?? null

  const pdfBuffer = await buildRapportPdf({
    dossier: rapport.dossier,
    rapport,
    // Le parcours médecin ne nomme jamais le patient : on reprend la
    // description anonymisée plutôt qu'un nom qui n'existe pas.
    patientName:
      rapport.dossier.patient?.user.fullName ??
      (rapport.dossier.patientAge != null
        ? `Patient anonymisé, ${rapport.dossier.patientAge} ans`
        : 'Patient anonymisé'),
    specialisteName: (rapport.specialiste ?? rapport.medecinRedacteur).user.fullName,
    // Un document que le patient conserve : il doit nommer ce qu'est son auteur.
    libelleAuteur: rapport.medecinRedacteur ? 'Médecin' : 'Spécialiste',
  })
  const key = `rapports/${rapport.dossierId}/rapport-${rapport.id}.pdf`
  await putObject(key, pdfBuffer, 'application/pdf')

  const updated = await prisma.rapport.update({
    where: { id: rapport.id },
    data: { status: 'VALIDE', validatedAt: new Date(), pdfStorageKey: key },
  })
  await prisma.dossier.update({ where: { id: rapport.dossierId }, data: { status: 'RAPPORT_TRANSMIS' } })

  await logAction({ userId: req.userId, action: 'RAPPORT_VALIDE', entityType: 'Rapport', entityId: rapport.id, dossierId: rapport.dossierId })

  // L'avis est rendu : c'est maintenant que le spécialiste l'a gagné. Un échec
  // ici ne doit pas bloquer la transmission au patient — le relevé se rattrape,
  // un rapport transmis ne se retransmet pas.
  try {
    await creerHonorairePourDossier(rapport.dossierId)
  } catch (err) {
    console.error("Création de l'honoraire échouée", err)
  }

  // C'est cet instant que le compte à rebours de la coordination attend : le
  // rapport devient lisible ici, pas à sa remise par le spécialiste.
  if (destinataire) {
    await notify(destinataire.id, destinataire.email, 'RAPPORT_DISPONIBLE', {
      name: destinataire.fullName,
      reference: rapport.dossier.reference,
    })
  }

  res.json(updated)
}

async function getRapport(req, res) {
  const { dossier, estRedacteur, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId, CHARGEMENT_AUTEUR)
  if (error) return res.status(error).json({ message })

  const rapport = await prisma.rapport.findUnique({ where: { dossierId: dossier.id } })
  if (!rapport) return res.status(404).json({ message: 'Aucun rapport pour ce dossier' })

  // Le redacteur a le meme role qu'un destinataire, mais c'est son propre texte :
  // sans cette exception, il ne pouvait pas rouvrir son brouillon.
  if (!estRedacteur && DESTINATAIRES_RAPPORT_FINAL.has(req.userRole) && rapport.status !== 'VALIDE') {
    return res.status(403).json({ message: "Le rapport n'est pas encore disponible" })
  }

  res.json(rapport)
}

async function downloadRapportPdf(req, res) {
  const rapport = await prisma.rapport.findUnique({ where: { id: req.params.id } })
  if (!rapport || !rapport.pdfStorageKey) return res.status(404).json({ message: 'PDF non disponible' })

  const { estRedacteur, error, message } = await loadDossierWithAccessCheck(req, rapport.dossierId, CHARGEMENT_AUTEUR)
  if (error) return res.status(error).json({ message })
  if (!estRedacteur && DESTINATAIRES_RAPPORT_FINAL.has(req.userRole) && rapport.status !== 'VALIDE') {
    return res.status(403).json({ message: "Le rapport n'est pas encore disponible" })
  }

  await logAction({ userId: req.userId, action: 'RAPPORT_PDF_TELECHARGE', entityType: 'Rapport', entityId: rapport.id, dossierId: rapport.dossierId })
  await servirObjet(res, rapport.pdfStorageKey, {
    filename: `rapport-${rapport.id.slice(0, 8)}.pdf`,
    contentType: 'application/pdf',
  })
}

module.exports = { upsertBrouillon, soumettreRapport, validerRapport, getRapport, downloadRapportPdf }
