const { z } = require('zod')
const { paramsWithId } = require('./common.schema')

// Formulaire public : multipart, la photo passe par multer et le reste arrive
// en chaînes. Les champs vides sont retirés côté écran, on tolère donc
// l'absence mais pas la chaîne vide.
const champTexte = (max) => z.string().trim().min(1).max(max).optional()

// Le médecin traitant exerce en clinique, à l'hôpital, ou dans les deux. Le
// comité appelle la structure pour vérifier l'exercice, d'où le contact.
const TYPES_STRUCTURE = ['CLINIQUE', 'HOPITAL', 'LES_DEUX']
const emailStructure = z.string().trim().toLowerCase().email().max(254).optional()

const deposer = {
  body: z.object({
    type: z.enum(['SPECIALISTE', 'MEDECIN_LOCAL']),
    fullName: z.string().trim().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(254),
    phone: champTexte(40),
    specialite: z.string().trim().min(2).max(200),
    etablissement: champTexte(200),
    pays: champTexte(100),
    ville: champTexte(100),
    langues: champTexte(200),
    numeroOrdre: champTexte(100),
    typeStructure: z.enum(TYPES_STRUCTURE).optional(),
    nomClinique: champTexte(200),
    telClinique: champTexte(40),
    emailClinique: emailStructure,
    nomHopital: champTexte(200),
    telHopital: champTexte(40),
    emailHopital: emailStructure,
    // Assez long pour un parcours, assez court pour rester lisible par le comité.
    presentation: z.string().trim().min(50).max(4000),
  }).strict().superRefine((val, ctx) => {
    const exige = (champ, message) => {
      if (!val[champ]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [champ], message })
    }

    if (val.type === 'MEDECIN_LOCAL') {
      if (!val.typeStructure) {
        return ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['typeStructure'],
          message: "Indiquez si vous exercez en clinique, à l'hôpital, ou dans les deux",
        })
      }
      if (val.typeStructure !== 'HOPITAL') exige('nomClinique', 'Le nom de la clinique est obligatoire')
      if (val.typeStructure !== 'CLINIQUE') exige('nomHopital', "Le nom de l'hôpital est obligatoire")
      return
    }

    // Un spécialiste international n'a pas de structure d'exercice locale :
    // accepter ces champs laisserait croire qu'ils comptent, et ils
    // ressortiraient dans le courriel du comité sans que personne les ait
    // remplis sciemment.
    for (const champ of ['typeStructure', 'nomClinique', 'telClinique', 'emailClinique', 'nomHopital', 'telHopital', 'emailHopital']) {
      if (val[champ] !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [champ],
          message: "Ce champ ne concerne que les candidatures de médecin traitant",
        })
      }
    }
  }),
}

const lister = {
  query: z.object({
    statut: z.enum(['EN_ATTENTE', 'ACCEPTEE', 'REFUSEE', 'COMPTE_CREE']).optional(),
  }).strict(),
}

const idParam = { params: paramsWithId('id') }

// Le motif est facultatif : c'est le comite qui motive sa decision aupres du
// candidat, hors de la plateforme. Ce champ n'est qu'une note interne.
const ecarter = {
  params: paramsWithId('id'),
  body: z.object({ motif: z.string().trim().max(1000).optional() }).strict(),
}

module.exports = { deposer, lister, idParam, ecarter }
