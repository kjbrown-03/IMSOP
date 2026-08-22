const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const dossierScoped = { params: paramsWithId('dossierId') }

const sendMessage = {
  params: paramsWithId('dossierId'),
  body: z.object({ body: z.string().trim().min(1).max(5000) }).strict(),
}

const sendAttachment = {
  params: paramsWithId('dossierId'),
  body: z.object({
    body: z.string().trim().max(5000).optional(),
    category: z.enum(['ANALYSE_BIOLOGIQUE', 'IMAGERIE', 'ORDONNANCE', 'COMPTE_RENDU', 'MESSAGERIE', 'AUTRE']).optional(),
  }).strict(),
}

module.exports = { dossierScoped, sendMessage, sendAttachment }
