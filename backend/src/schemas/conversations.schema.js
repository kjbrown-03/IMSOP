const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const lister = { query: z.object({}).strict() }

const ouvrir = {
  body: z.object({ destinataireId: z.string().uuid() }).strict(),
}

const idParam = { params: paramsWithId('id') }

const envoyerMessage = {
  params: paramsWithId('id'),
  body: z.object({ body: z.string().trim().min(1).max(5000) }).strict(),
}

const rechercher = {
  query: z.object({ q: z.string().trim().max(200).optional() }).strict(),
}

module.exports = { lister, ouvrir, idParam, envoyerMessage, rechercher }
