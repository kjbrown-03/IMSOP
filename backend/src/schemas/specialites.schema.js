const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

const lister = {
  query: z.object({
    cible: z.enum(['SPECIALISTE', 'MEDECIN_LOCAL']).optional(),
    // Réservé à l'écran d'administration, qui doit voir les spécialités
    // désactivées pour pouvoir les réactiver.
    toutes: z.enum(['true', 'false']).optional(),
  }).strict(),
}

const creer = {
  body: z.object({
    nom: z.string().trim().min(2).max(120),
    pourSpecialiste: z.boolean().optional(),
    pourMedecin: z.boolean().optional(),
  }).strict(),
}

const modifier = {
  params: paramsWithId('id'),
  body: z.object({
    nom: z.string().trim().min(2).max(120).optional(),
    pourSpecialiste: z.boolean().optional(),
    pourMedecin: z.boolean().optional(),
    actif: z.boolean().optional(),
  }).strict(),
}

module.exports = { lister, creer, modifier }
