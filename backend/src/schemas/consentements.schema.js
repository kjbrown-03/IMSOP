const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const dossierScoped = { params: paramsWithId('dossierId') }

const createConsentement = {
  params: paramsWithId('dossierId'),
  body: z.object({
    type: z.enum(['TRAITEMENT_DONNEES', 'TRANSMISSION_SPECIALISTE', 'TELECONSULTATION', 'COMMUNICATION_MEDECIN']),
    accepted: z.boolean(),
  }).strict(),
}

module.exports = { dossierScoped, createConsentement }
