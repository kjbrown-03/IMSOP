const { z } = require('zod')
const { paramsWithId, pagination } = require('./common.schema')

const texte = (max, message) => z.string().trim().min(1, message).max(max)

const champsPatient = {
  nom: z.string().trim().min(2, 'Indiquez le nom du patient').max(120),
  age: z.coerce.number().int('Âge invalide').min(0, 'Âge invalide').max(130, 'Âge invalide'),
  sexe: z.enum(['MASCULIN', 'FEMININ']),
  paysOrigine: texte(80, "Indiquez le pays d'origine"),
  diagnostic: texte(2000, 'Indiquez le diagnostic'),
  therapeutique: texte(2000, 'Indiquez la thérapeutique'),
  dureeTraitement: texte(100, 'Indiquez la durée du traitement'),
}

const creer = { body: z.object(champsPatient).strict() }

const modifier = {
  params: paramsWithId('id'),
  body: z.object(champsPatient).partial().strict()
    .refine((b) => Object.keys(b).length > 0, 'Aucune modification'),
}

const lister = {
  query: z.object({ ...pagination, q: z.string().trim().max(120).optional() }).strict(),
}

const referer = {
  params: paramsWithId('id'),
  body: z.object({
    referenceVers: z.enum(['HOPITAL_CONVENTIONNEL', 'AUTRE_TRADIPRATICIEN']),
    referenceDestinataire: z.string().trim().min(2, "Indiquez l'hôpital ou le tradipraticien").max(200),
    referenceMotif: z.string().trim().max(2000).optional(),
  }).strict(),
}

const parId = { params: paramsWithId('id') }

module.exports = { creer, modifier, lister, referer, parId }
