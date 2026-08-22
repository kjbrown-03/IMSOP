const { z } = require('zod')
const { uuid, paramsWithId, pagination } = require('./common.schema')

const URGENCE = ['NORMAL', 'PRIORITAIRE', 'URGENT']
const STATUS = [
  'BROUILLON', 'SOUMIS', 'EN_ATTENTE_PAIEMENT', 'EN_VERIFICATION', 'COMPLET',
  'EN_ATTENTE_AFFECTATION', 'AFFECTE', 'EN_ANALYSE', 'RAPPORT_EN_PREPARATION',
  'RAPPORT_SOUMIS', 'RAPPORT_VALIDE', 'RAPPORT_TRANSMIS', 'CLOTURE', 'ANNULE', 'REFUSE',
]

const longText = (max) => z.string().trim().min(1).max(max)

const createDossier = {
  body: z.object({
    specialiteRequise: z.string().trim().min(1).max(200),
    motif: longText(2000),
    questionMedicale: longText(2000).optional(),
    symptomes: longText(2000).optional(),
    antecedents: longText(2000).optional(),
    traitementEnCours: longText(2000).optional(),
    urgence: z.enum(URGENCE).optional(),
  }).strict(),
}

const updateDossier = {
  params: paramsWithId('id'),
  body: z.object({
    specialiteRequise: z.string().trim().min(1).max(200).optional(),
    motif: longText(2000).optional(),
    questionMedicale: longText(2000).optional(),
    symptomes: longText(2000).optional(),
    antecedents: longText(2000).optional(),
    traitementEnCours: longText(2000).optional(),
    urgence: z.enum(URGENCE).optional(),
  }).strict(),
}

const idParam = { params: paramsWithId('id') }

const listDossiers = {
  query: z.object({
    status: z.enum(STATUS).optional(),
    ...pagination,
  }).passthrough(),
}

const assignerSpecialiste = {
  params: paramsWithId('id'),
  body: z.object({ specialisteId: uuid }).strict(),
}

const refuserDossier = {
  params: paramsWithId('id'),
  body: z.object({ motif: z.string().trim().max(1000).optional() }).strict(),
}

module.exports = { createDossier, updateDossier, idParam, listDossiers, assignerSpecialiste, refuserDossier }
