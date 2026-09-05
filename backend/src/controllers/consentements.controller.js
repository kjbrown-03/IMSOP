const { v4: uuidv4 } = require('uuid')
const { prisma } = require('../lib/prisma')
const { putObject } = require('../lib/s3')
const { logAction } = require('../services/auditService')
const { loadDossierWithAccessCheck } = require('./dossiers.controller')
const { verifierJetonConsentement } = require('./auth.controller')
const { buildConsentementPdf } = require('../lib/consentementPdf')
const { correspondAuTitulaire } = require('../lib/nomSignataire')

async function createConsentement(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const { type, accepted, nomSignataire, otpToken } = req.body

  // Signer sous un autre nom que celui du compte produirait un document dont
  // le signataire ne correspond a personne. Verifie avant le code : inutile de
  // faire demander un code pour une signature de toute facon irrecevable.
  if (type === 'TRANSMISSION_SPECIALISTE' && accepted) {
    const titulaire = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { fullName: true },
    })
    if (!correspondAuTitulaire(nomSignataire, titulaire?.fullName)) {
      return res.status(400).json({
        message: 'La signature doit reprendre le nom complet du titulaire du compte.',
        errors: [{ field: 'nomSignataire', message: `Nom attendu : ${titulaire?.fullName ?? '—'}` }],
      })
    }
  }

  // Le nom tape dans le formulaire ne prouve pas qui signe : une session
  // laissee ouverte suffirait. Le consentement qui engage la demande - et le
  // paiement qui suit - exige donc que le titulaire ait valide le code envoye
  // a l'adresse de son compte. La verification est refaite ici, cote serveur :
  // l'appel a /auth/consentement/code/verify seul ne protegerait rien, rien
  // n'empechant d'appeler cette route directement.
  if (type === 'TRANSMISSION_SPECIALISTE' && accepted && !verifierJetonConsentement(otpToken, req.userId)) {
    return res.status(403).json({
      message: 'Confirmation par e-mail requise : demandez un code et saisissez-le avant de signer',
    })
  }

  // Le patient consent pour son propre dossier ; un médecin traitant ne peut
  // consentir que pour SA PROPRE demande (patient anonymisé, aucun compte
  // patient à consulter) - jamais au nom d'un patient qui l'a seulement
  // désigné comme médecin traitant.
  let signataireType = null
  if (req.userRole === 'PATIENT') {
    signataireType = 'patient'
  } else if (req.userRole === 'MEDECIN_LOCAL') {
    const medecin = await prisma.medecinLocal.findUnique({ where: { userId: req.userId } })
    if (!medecin || dossier.demandeurMedecinId !== medecin.id) {
      return res.status(403).json({
        message: 'Seul le patient, ou le médecin traitant à l\'origine de sa propre demande, peut donner ce consentement',
      })
    }
    signataireType = 'medecin'
  } else {
    return res.status(403).json({ message: 'Ce rôle ne peut pas donner ce consentement' })
  }

  const consentement = await prisma.consentement.create({
    data: {
      dossierId: dossier.id,
      patientId: dossier.patientId || null,
      type,
      accepted,
      nomSignataire: nomSignataire || null,
      ipAddress: req.ip,
    },
  })

  await logAction({
    userId: req.userId,
    action: 'CONSENTEMENT_ENREGISTRE',
    entityType: 'Consentement',
    entityId: consentement.id,
    dossierId: dossier.id,
    metadata: { type, accepted },
    ipAddress: req.ip,
  })

  // C'est ici que naît le "fichier consentement" : le formulaire rempli et
  // signé est généré côté serveur et attaché au dossier comme document
  // CONSENTEMENT, sans qu'aucun fichier n'ait à être imprimé, signé à la
  // main puis re-téléversé. C'est aussi ce document dont l'absence bloque
  // la transmission de la demande (voir soumettreDossier / transmettreDemandeMedecin).
  if (type === 'TRANSMISSION_SPECIALISTE' && accepted) {
    const pdfBuffer = await buildConsentementPdf({
      patient: dossier.patient
        ? {
            fullName: dossier.patient.user.fullName,
            dob: dossier.patient.dob ? new Date(dossier.patient.dob).toLocaleDateString('fr-FR') : null,
            patientRef: dossier.patient.patientRef,
          }
        : { fullName: dossier.patientAge ? `Patient anonymisé, ${dossier.patientAge} ans` : null },
      dossier: { reference: dossier.reference, specialiteRequise: dossier.specialiteRequise },
      medecinLocal: dossier.medecinLocal?.user
        ? { fullName: dossier.medecinLocal.user.fullName, numeroOrdre: dossier.medecinLocal.numeroOrdre }
        : dossier.demandeurMedecin?.user
          ? { fullName: dossier.demandeurMedecin.user.fullName, numeroOrdre: dossier.demandeurMedecin.numeroOrdre }
          : null,
      signature: { nom: nomSignataire, date: consentement.acceptedAt, type: signataireType, accepted },
    })

    const key = `dossiers/${dossier.id}/${uuidv4()}-consentement-signe.pdf`
    await putObject(key, pdfBuffer, 'application/pdf')

    await prisma.document.create({
      data: {
        dossierId: dossier.id,
        uploadedById: req.userId,
        category: 'CONSENTEMENT',
        filename: `Consentement-${dossier.reference}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdfBuffer.length,
        storageKey: key,
      },
    })
  }

  res.status(201).json(consentement)
}

async function listConsentements(req, res) {
  const { dossier, error, message } = await loadDossierWithAccessCheck(req, req.params.dossierId)
  if (error) return res.status(error).json({ message })

  const consentements = await prisma.consentement.findMany({ where: { dossierId: dossier.id }, orderBy: { acceptedAt: 'desc' } })
  res.json(consentements)
}

// Formulaire vierge, à lire avant d'accepter et de signer électroniquement -
// aucune donnée de dossier n'y figure, donc aucun contrôle d'accès requis.
async function downloadBlankConsentementPdf(req, res) {
  const pdfBuffer = await buildConsentementPdf({})
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', 'inline; filename="Consentement-IMSOP.pdf"')
  res.send(pdfBuffer)
}

module.exports = { createConsentement, listConsentements, downloadBlankConsentementPdf }
