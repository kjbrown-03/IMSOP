const { z } = require('zod')
const { uuid, pagination } = require('./common.schema')

const list = { query: z.object({ ...pagination }).strict() }

const idParam = { params: z.object({ id: uuid }).passthrough() }

const dossierIdParam = { params: z.object({ dossierId: uuid }).passthrough() }

module.exports = { list, idParam, dossierIdParam }
