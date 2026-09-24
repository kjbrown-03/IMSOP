const { z } = require('zod')
const { uuid, paramsWithId, pagination } = require('./common.schema')

const URGENCE = ['NORMAL', 'PRIORITAIRE', 'URGENT']
// Les 19 statuts du CDC §53, dans l'ordre du workflow §52.
const STATUS = [
  'BROUILLON', 'SOUMIS', 'EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_DOCUMENTS',
  'EN_VERIFICATION', 'COMPLET', 'EN_ATTENTE_AFFECTATION', 'AFFECTE',
  'ACCEPTE_PAR_SPECIALISTE', 'EN_ANALYSE', 'INFORMATION_COMPLEMENTAIRE_DEMANDEE',
  'RAPPORT_EN_PREPARATION', 'RAPPORT_SOUMIS', 'RAPPORT_VALIDE', 'RAPPORT_TRANSMIS',
  'SUIVI', 'CLOTURE', 'ANNULE', 'REFUSE',
]

// Sous-ensemble pilotable par la coordination, aligné sur TRANSITIONS_COORDINATION.
const STATUS_COORDINATION = [
  'EN_ATTENTE_DOCUMENTS', 'EN_VERIFICATION', 'COMPLET',
  'EN_ATTENTE_AFFECTATION', 'SUIVI', 'CLOTURE', 'ANNULE',
]

const longText = (max) => z.string().trim().min(1).max(max)

const createDossier = {
  body: z.object({
    specialiteRequise: z.string().trim().min(1).max(200),
    motif: longText(2000),
    questionMedicale: longText(2000).optional(),
    symptomes: longText(2000).optional(),
    antecedents: longText(2000).optional(),
    allergies: longText(2000).optional(),
    traitementEnCours: longText(2000).optional(),
    urgence: z.enum(URGENCE).optional(),
  }).strict(),
}

// Le medecin traitant decrit un patient ANONYMISE : age et sexe suffisent au
// specialiste pour interpreter le cas, et rien d'identifiant n'est demande. La
// question est obligatoire ici — c'est l'objet meme de la demande, contrairement
// au parcours patient ou elle est facultative.
const creerDemandeMedecin = {
  body: z.object({
    specialiteRequise: z.string().trim().min(1).max(200),
    patientAge: z.coerce.number().int().min(0).max(120),
    patientSexe: z.enum(['homme', 'femme', 'autre']),
    motif: longText(2000),
    question: longText(2000),
    symptomes: longText(2000).optional(),
    antecedents: longText(2000).optional(),
    allergies: longText(2000).optional(),
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
    allergies: longText(2000).optional(),
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

const demanderComplement = {
  params: paramsWithId('id'),
  body: z.object({ precisions: z.string().trim().min(1).max(2000) }).strict(),
}

const changerStatut = {
  params: paramsWithId('id'),
  body: z.object({
    status: z.enum(STATUS_COORDINATION),
    motif: z.string().trim().max(1000).optional(),
  }).strict(),
}

const designerMedecinLocal = {
  params: paramsWithId('id'),
  body: z.object({ email: z.string().trim().toLowerCase().email() }).strict(),
}

const refuserDossier = {
  params: paramsWithId('id'),
  body: z.object({ motif: z.string().trim().max(1000).optional() }).strict(),
}

// Le motif est obligatoire, là où celui du refus est facultatif : une récusation
// sans raison ne serait pas exploitable par la coordination.
const declarerConflitInterets = {
  params: paramsWithId('id'),
  body: z.object({ motif: z.string().trim().min(10).max(1000) }).strict(),
}

const poserQuestionMedecinLocal = {
  params: paramsWithId('id'),
  body: z.object({ question: longText(2000) }).strict(),
}

module.exports = {
  createDossier,
  creerDemandeMedecin,
  updateDossier,
  idParam,
  listDossiers,
  assignerSpecialiste,
  refuserDossier,
  declarerConflitInterets,
  demanderComplement,
  changerStatut,
  designerMedecinLocal,
  poserQuestionMedecinLocal,
}
