const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const DOCUMENT_TYPES = [
  'DIPLOME',
  'LICENCE',
  'INSCRIPTION_ORDRE',
  'PIECE_IDENTITE',
  'CV',
  'REFERENCES',
  'AUTRE',
]

const VERIFICATION_STATUS = ['EN_VERIFICATION', 'VALIDE', 'SUSPENDU', 'EXPIRE', 'REVOQUE']

const uploadJustificatif = {
  body: z.object({ type: z.enum(DOCUMENT_TYPES) }).strict(),
}

const listerDemandes = {
  query: z.object({ status: z.enum(VERIFICATION_STATUS).optional() }).passthrough(),
}

const userIdParam = { params: paramsWithId('userId') }

const statuerHabilitation = {
  params: paramsWithId('userId'),
  body: z.object({
    status: z.enum(VERIFICATION_STATUS),
    motif: z.string().trim().min(1).max(1000).optional(),
    habilitationExpireLe: z.string().datetime().optional(),
  }).strict(),
}

module.exports = {
  uploadJustificatif,
  listerDemandes,
  userIdParam,
  idParam: { params: paramsWithId('id') },
  statuerHabilitation,
  DOCUMENT_TYPES,
  VERIFICATION_STATUS,
}
