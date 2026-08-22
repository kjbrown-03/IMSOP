const { z } = require('zod')
const { paramsWithId, pagination } = require('./common.schema')

const listSpecialistes = {
  query: z.object({
    specialite: z.string().trim().max(200).optional(),
    pays: z.string().trim().max(100).optional(),
    disponible: z.enum(['true', 'false']).optional(),
    ...pagination,
  }).strict(),
}

const getRecommandations = { params: paramsWithId('dossierId') }

const updateMyAvailability = {
  body: z.object({ disponible: z.boolean() }).strict(),
}

module.exports = { listSpecialistes, getRecommandations, updateMyAvailability }
