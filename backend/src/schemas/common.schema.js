const { z } = require('zod')

const uuid = z.string().uuid('Identifiant invalide')

function paramsWithId(name) {
  return z.object({ [name]: uuid }).passthrough()
}

const pagination = {
  page: z.coerce.number().int().min(1).max(100000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
}

module.exports = { uuid, paramsWithId, pagination }
