const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const dossierScoped = { params: paramsWithId('dossierId') }

const sendMessage = {
  params: paramsWithId('dossierId'),
  body: z.object({ body: z.string().trim().min(1).max(5000) }).strict(),
}

module.exports = { dossierScoped, sendMessage }
