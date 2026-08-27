const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const creerTemoignage = {
  body: z.object({
    texte: z.string().trim().min(10).max(1000),
    note: z.number().int().min(1).max(5).optional(),
  }).strict(),
}

const listerAdmin = {
  query: z.object({
    statut: z.enum(['EN_ATTENTE', 'PUBLIE', 'REJETE']).optional(),
  }).strict(),
}

const modererTemoignage = {
  params: paramsWithId('id'),
  body: z.object({
    statut: z.enum(['PUBLIE', 'REJETE']),
    motifRejet: z.string().trim().max(500).optional(),
  }).strict(),
}

module.exports = { creerTemoignage, listerAdmin, modererTemoignage }
