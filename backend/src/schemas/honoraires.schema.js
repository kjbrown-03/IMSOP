const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const lister = {
  query: z.object({
    statut: z.enum(['A_REVERSER', 'EN_COURS', 'REVERSE', 'ECHOUE']).optional(),
  }).strict(),
}

const reverser = {
  params: paramsWithId('id'),
  // Sans référence : reversement automatique (Fapshi). Avec : virement manuel.
  body: z.object({ reference: z.string().trim().min(3).max(200).optional() }).strict(),
}

module.exports = { lister, reverser }
