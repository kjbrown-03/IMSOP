const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const dossierScoped = { params: paramsWithId('dossierId') }

const createConsentement = {
  params: paramsWithId('dossierId'),
  body: z.object({
    type: z.enum(['TRAITEMENT_DONNEES', 'TRANSMISSION_SPECIALISTE', 'TELECONSULTATION', 'COMMUNICATION_MEDECIN']),
    accepted: z.boolean(),
    // Signature électronique (nom complet tapé) : requise uniquement pour le
    // consentement qui conditionne l'envoi de la demande au spécialiste.
    nomSignataire: z.string().trim().min(2).max(200).optional(),
  }).strict().refine(
    (data) => !(data.type === 'TRANSMISSION_SPECIALISTE' && data.accepted && !data.nomSignataire),
    { message: 'La signature (nom complet) est requise pour accepter ce consentement', path: ['nomSignataire'] },
  ),
}

module.exports = { dossierScoped, createConsentement }
