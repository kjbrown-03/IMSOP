const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const dossierScoped = { params: paramsWithId('dossierId') }

const uploadDocument = {
  params: paramsWithId('dossierId'),
  body: z.object({
    category: z.enum(['ANALYSE_BIOLOGIQUE', 'IMAGERIE', 'ORDONNANCE', 'COMPTE_RENDU', 'AUTRE']).optional(),
  }).passthrough(), // multer/multipart may add other non-file text fields we don't care about
}

const downloadDocument = { params: paramsWithId('id') }

module.exports = { dossierScoped, uploadDocument, downloadDocument }
