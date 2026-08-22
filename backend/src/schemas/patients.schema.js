const { z } = require('zod')
const { paramsWithId, pagination } = require('./common.schema')

const uploadIdentityDocument = { body: z.object({}).passthrough() } // multipart: only the file itself matters

const listIdentityReviews = {
  query: z.object({ ...pagination }).passthrough(),
}

const patientIdParam = { params: paramsWithId('patientId') }

const reviewIdentityDocument = {
  params: paramsWithId('patientId'),
  body: z.object({
    approved: z.boolean(),
    rejectedReason: z.string().trim().min(1).max(500).optional(),
  }).strict().refine((v) => v.approved || v.rejectedReason, {
    message: 'rejectedReason est requis en cas de refus',
  }),
}

module.exports = { uploadIdentityDocument, listIdentityReviews, patientIdParam, reviewIdentityDocument }
