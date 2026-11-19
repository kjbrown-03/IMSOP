const { z } = require('zod')
const { paramsWithId } = require('./common.schema')
const { SPECIALITES_LOCALES } = require('../lib/specialitesLocales')

// Envoyé en multipart : un champ répété arrive en tableau, un champ unique en
// chaîne. On ramène les deux à un tableau.
const enTableau = (v) => (v === undefined || Array.isArray(v) ? v : [v])

const creer = {
  body: z.object({
    specialites: z.preprocess(enTableau, z.array(z.enum(SPECIALITES_LOCALES)).min(1).max(6)),
    motif: z.string().trim().min(10).max(1000),
  }).strict(),
}

const lister = {
  query: z.object({ statut: z.enum(['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE']).optional() }).passthrough(),
}

const decider = {
  params: paramsWithId('id'),
  body: z.object({
    decision: z.enum(['ACCEPTEE', 'REFUSEE']),
    motifRefus: z.string().trim().max(1000).optional(),
  }).strict().refine(
    // Le praticien doit savoir pourquoi on lui refuse, sinon il redépose la même demande.
    (d) => d.decision !== 'REFUSEE' || (d.motifRefus && d.motifRefus.length >= 5),
    { message: 'Un refus doit être motivé', path: ['motifRefus'] },
  ),
}

module.exports = { creer, lister, decider, parId: { params: paramsWithId('id') } }
