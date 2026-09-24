const { z } = require('zod')
const { paramsWithId } = require('./common.schema')
const { CODES_PAYS } = require('../lib/cemac')
const { SPECIALITES_LOCALES } = require('../lib/specialitesLocales')

const rechercher = {
  body: z.object({
    symptomes: z.string().trim().min(10, 'Décrivez vos symptômes en quelques mots').max(2000),
    pays: z.enum(CODES_PAYS),
    ville: z.string().trim().max(100).optional(),
  }).strict(),
}

const rechercheParId = { params: paramsWithId('id') }

// Aucun compte requis pour payer : l'e-mail est ce que le fournisseur de
// paiement exige et ce qui identifie la personne mise en relation. Facultatif
// dans le corps si la personne est connectée - on prend alors celui du compte.
const initierPaiement = {
  params: paramsWithId('id'),
  body: z.object({
    email: z.string().trim().toLowerCase().email().optional(),
    nom: z.string().trim().min(2).max(120).optional(),
  }).strict(),
}

// Ce qu'un médecin règle pour apparaître (ou non) dans l'annuaire.
const mettreAJourAnnuaire = {
  body: z.object({
    annuaireVisible: z.boolean(),
    annuaireSpecialites: z.array(z.enum(SPECIALITES_LOCALES)).max(6).optional(),
    pays: z.enum(CODES_PAYS).optional(),
    ville: z.string().trim().max(100).optional().nullable(),
    quartier: z.string().trim().max(120).optional().nullable(),
    annuairePresentation: z.string().trim().max(600).optional().nullable(),
  }).strict().refine(
    // Être visible sans spécialité déclarée n'aurait aucun sens : le médecin ne
    // ressortirait dans aucune recherche.
    (d) => !d.annuaireVisible || (d.annuaireSpecialites && d.annuaireSpecialites.length > 0),
    { message: 'Choisissez au moins une spécialité pour apparaître dans l\'annuaire', path: ['annuaireSpecialites'] },
  ),
}

module.exports = { rechercher, rechercheParId, initierPaiement, mettreAJourAnnuaire }
