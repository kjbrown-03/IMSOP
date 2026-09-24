const { prisma } = require('../lib/prisma')
const env = require('../config/env')
const { logAction } = require('./auditService')
const fapshi = require('./fapshi.service')
const { normaliserNumero } = require('../lib/sms')

/**
 * Relevé d'honoraires : ce que la plateforme doit à chaque spécialiste.
 *
 * Le modèle économique, tel que décidé :
 *   - le demandeur paie en XAF ;
 *   - la plateforme retient une commission sur chaque transaction ;
 *   - le reste revient au spécialiste, converti dans sa devise.
 *
 * Le reversement lui-même dépend du pays : Mobile Money par Fapshi au
 * Cameroun, virement SEPA en Europe. Le relevé est le même dans les deux cas —
 * seul le dernier kilomètre change.
 */

// Devise de chaque pays d'exercice. Le champ `pays` est saisi librement, on
// normalise avant de comparer. Un pays inconnu tombe en EUR : la majorité des
// spécialistes internationaux y sont, et une devise erronée se voit sur le
// relevé avant tout virement.
const DEVISE_PAR_PAYS = {
  cameroun: 'XAF', cm: 'XAF',
  gabon: 'XAF', congo: 'XAF', tchad: 'XAF', centrafrique: 'XAF', 'guinee equatoriale': 'XAF',
  senegal: 'XOF', sn: 'XOF', 'cote d ivoire': 'XOF', ci: 'XOF', mali: 'XOF', 'burkina faso': 'XOF',
  benin: 'XOF', togo: 'XOF', niger: 'XOF',
  france: 'EUR', fr: 'EUR', belgique: 'EUR', be: 'EUR', portugal: 'EUR', espagne: 'EUR',
  italie: 'EUR', allemagne: 'EUR', luxembourg: 'EUR',
  suisse: 'CHF', ch: 'CHF',
  'royaume uni': 'GBP', uk: 'GBP',
  'etats unis': 'USD', usa: 'USD',
  algerie: 'DZD', maroc: 'MAD', tunisie: 'TND',
}

function normaliser(texte) {
  return String(texte || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function deviseDuSpecialiste(specialiste) {
  return DEVISE_PAR_PAYS[normaliser(specialiste?.pays)] || 'EUR'
}

/**
 * Taux XAF -> devise. Le franc CFA (XAF comme XOF) est arrimé à l'euro à
 * 655,957 pour 1 € — un taux fixe, pas une cotation. Les autres devises
 * viennent de la configuration et doivent être tenues à jour à la main : il
 * n'y a pas de source de cours en ligne branchée, et en brancher une est une
 * décision (fournisseur, coût, fréquence) qui n'a pas encore été prise.
 */
const XAF_PAR_EURO = 655.957

function tauxXafVers(devise) {
  if (devise === 'XAF' || devise === 'XOF') return 1
  if (devise === 'EUR') return 1 / XAF_PAR_EURO
  const parEuro = env.honoraires.tauxParEuro[devise]
  if (!parEuro) throw new Error(`Aucun taux de change configuré pour ${devise}`)
  // 1 XAF = (1 / XAF_PAR_EURO) € ; 1 € = parEuro unités de la devise.
  return parEuro / XAF_PAR_EURO
}

const arrondir = (n, decimales = 2) => Math.round(n * 10 ** decimales) / 10 ** decimales

/** Ventilation d'un montant payé entre la plateforme et le spécialiste. */
function calculerVentilation(montantBrut, specialiste) {
  const tauxCommission = env.honoraires.commissionPourcent
  const commission = arrondir((montantBrut * tauxCommission) / 100)
  const montantNet = arrondir(montantBrut - commission)
  const deviseNet = deviseDuSpecialiste(specialiste)
  const tauxChange = tauxXafVers(deviseNet)
  // Les devises sans centime (XAF, XOF) s'arrondissent à l'unité.
  const sansCentime = deviseNet === 'XAF' || deviseNet === 'XOF'
  const montantNetDevise = arrondir(montantNet * tauxChange, sansCentime ? 0 : 2)

  return {
    montantBrut,
    deviseBrut: 'XAF',
    tauxCommission,
    commission,
    montantNet,
    deviseNet,
    tauxChange,
    montantNetDevise,
    canal: deviseNet === 'XAF' ? 'FAPSHI' : 'VIREMENT',
  }
}

/**
 * Crée l'honoraire d'un dossier dont le rapport vient d'être transmis.
 *
 * Idempotent : un avis n'est payé qu'une fois. Sans paiement confirmé sur le
 * dossier — parcours médecin, qui ne passe pas par le paiement patient — il n'y
 * a rien à ventiler, et la fonction rend null plutôt que d'inventer un montant.
 */
async function creerHonorairePourDossier(dossierId) {
  const existant = await prisma.honoraire.findUnique({ where: { dossierId } })
  if (existant) return existant

  const dossier = await prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      specialiste: true,
      paiements: { where: { status: 'PAYE' }, orderBy: { confirmedAt: 'desc' }, take: 1 },
    },
  })
  if (!dossier?.specialiste) return null
  const paiement = dossier.paiements[0]
  if (!paiement) return null

  const ventilation = calculerVentilation(Number(paiement.amount), dossier.specialiste)

  return prisma.honoraire.create({
    data: { dossierId, specialisteId: dossier.specialiste.id, ...ventilation },
  })
}

/**
 * Reversement par Fapshi : uniquement pour un net en XAF, vers le numéro du
 * spécialiste. Le décaissement Fapshi exige un jeu d'accès distinct de
 * l'encaissement — un même compte ne peut pas faire les deux.
 */
async function reverserParFapshi(honoraire, { userId }) {
  if (honoraire.canal !== 'FAPSHI') throw new Error('Ce reversement ne passe pas par Fapshi')
  if (!fapshi.payoutConfigure()) throw new Error("Les accès de décaissement Fapshi ne sont pas configurés")

  await prisma.honoraire.update({ where: { id: honoraire.id }, data: { statut: 'EN_COURS' } })

  // Tout ce qui peut échouer est sous le même filet : un numéro absent doit
  // laisser la même trace qu'une passerelle injoignable, sinon l'échec est
  // invisible sur le relevé.
  try {
    const specialiste = await prisma.specialiste.findUnique({
      where: { id: honoraire.specialisteId },
      include: { user: { select: { fullName: true, email: true, phone: true } } },
    })
    const numero = normaliserNumero(specialiste?.user?.phone)
    if (!numero) throw new Error("Le spécialiste n'a pas de numéro de téléphone : impossible de reverser en Mobile Money")

    const resultat = await fapshi.decaisser({
      amount: Number(honoraire.montantNetDevise),
      // Fapshi attend le numéro local sans indicatif.
      phone: numero.replace(/^\+237/, ''),
      name: specialiste.user.fullName,
      email: specialiste.user.email,
      externalId: `HON-${honoraire.id.slice(0, 8)}`,
      message: `IMSOP - Honoraires second avis`,
    })

    const misAJour = await prisma.honoraire.update({
      where: { id: honoraire.id },
      data: { statut: 'REVERSE', referenceReversement: resultat.transId, reverseLe: new Date(), reversePar: userId },
    })
    await logAction({ userId, action: 'HONORAIRE_REVERSE', entityType: 'Honoraire', entityId: honoraire.id, dossierId: honoraire.dossierId, metadata: { canal: 'FAPSHI', transId: resultat.transId } })
    return misAJour
  } catch (err) {
    await prisma.honoraire.update({
      where: { id: honoraire.id },
      data: { statut: 'ECHOUE', motifEchec: err.message.slice(0, 500) },
    })
    throw err
  }
}

/**
 * Reversement manuel : le virement a été fait hors plateforme, on l'enregistre
 * avec sa référence bancaire. C'est le parcours des spécialistes en Europe.
 */
async function marquerReverse(honoraire, { userId, reference }) {
  const misAJour = await prisma.honoraire.update({
    where: { id: honoraire.id },
    data: { statut: 'REVERSE', referenceReversement: reference, reverseLe: new Date(), reversePar: userId, motifEchec: null },
  })
  await logAction({ userId, action: 'HONORAIRE_REVERSE', entityType: 'Honoraire', entityId: honoraire.id, dossierId: honoraire.dossierId, metadata: { canal: honoraire.canal, reference } })
  return misAJour
}

module.exports = {
  deviseDuSpecialiste,
  tauxXafVers,
  calculerVentilation,
  creerHonorairePourDossier,
  reverserParFapshi,
  marquerReverse,
  XAF_PAR_EURO,
}
