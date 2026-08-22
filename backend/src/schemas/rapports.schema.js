const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const dossierScoped = { params: paramsWithId('dossierId') }
const idScoped = { params: paramsWithId('id') }

const upsertBrouillon = {
  params: paramsWithId('dossierId'),
  body: z.object({
    synthese: z.string().trim().max(10000).optional(),
    diagnostic: z.string().trim().max(5000).optional(),
    optionsTherapeutiques: z.string().trim().max(5000).optional(),
  }).strict(),
}

module.exports = { dossierScoped, idScoped, upsertBrouillon }
