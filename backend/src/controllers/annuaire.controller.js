const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { safeUserSelect } = require('../lib/selectors')
const { trier } = require('../lib/triage')
const { PAYS_CEMAC, villesDe, estPaysCemac } = require('../lib/cemac')
const { SPECIALITES_LOCALES } = require('../lib/specialitesLocales')
const paiements = require('./paiements.controller')
const env = require('../config/env')

/**
 * Annuaire « Trouver un médecin » (zone CEMAC).
 *
 * Le parcours : on décrit ses symptômes → on obtient un NOMBRE de médecins et
 * des fiches floutées → on paie → la mise en relation est faite, les
 * coordonnées apparaissent.
 *
 * Ce que le patient paie, c'est la MISE EN RELATION : le travail de la
 * plateforme qui a lu ses symptômes, cherché parmi des médecins vérifiés de sa
 * zone, et l'a relié à ceux qui peuvent le recevoir. Les coordonnées ne sont
 * que le résultat visible de ce service - elles ne sont pas la marchandise.
 * Cette distinction compte : une mise en relation est un service ; vendre des
 * coordonnées serait de la publicité médicale, encadrée autrement.
 *
 * Le médecin ne touche rien et n'est pas consulté à chaque mise en relation -
 * il a simplement accepté d'être relié à des patients (annuaireVisible).
 *
 * Deux garde-fous qui ne se négocient pas :
 *  - une urgence détectée dans les symptômes ne donne lieu à aucune mise en
 *    relation payante ;
 *  - on ne fait payer que s'il y a au moins un médecin à relier.
 */

const MAX_RESULTATS = 20

// Ce qu'on montre AVANT paiement : de quoi juger que ça vaut le coup (la
// spécialité, la ville) sans rien qui permette de retrouver la personne. Ni
// nom, ni établissement, ni quartier, ni identifiant du médecin - on expose
// l'identifiant du résultat, qui ne mène nulle part.
function ficheFloutee(resultat, specialitesRecherchees) {
  const m = resultat.medecin
  return {
    id: resultat.id,
    specialites: m.annuaireSpecialites.filter((s) => specialitesRecherchees.includes(s)),
    ville: m.ville,
    score: resultat.score,
  }
}

// Ce qu'on montre APRÈS paiement.
function ficheComplete(resultat, specialitesRecherchees) {
  const m = resultat.medecin
  return {
    ...ficheFloutee(resultat, specialitesRecherchees),
    nom: m.user.fullName,
    telephone: m.user.phone,
    email: m.user.email,
    etablissement: m.etablissement,
    pays: m.pays,
    quartier: m.quartier,
    presentation: m.annuairePresentation,
    toutesSpecialites: m.annuaireSpecialites,
  }
}

const INCLUDE_RESULTATS = {
  resultats: {
    orderBy: { score: 'desc' },
    include: { medecin: { include: { user: { select: safeUserSelect } } } },
  },
}

function serialiser(recherche) {
  const debloquee = recherche.statut === 'DEBLOQUEE'
  return {
    id: recherche.id,
    statut: recherche.statut,
    urgence: recherche.urgence,
    specialites: recherche.specialites,
    pays: recherche.pays,
    ville: recherche.ville,
    nombre: recherche.resultats.length,
    tarif: { amount: env.tarifs.ANNUAIRE, currency: env.tarifs.devise },
    createdAt: recherche.createdAt,
    debloqueeLe: recherche.debloqueeLe,
    resultats: recherche.resultats.map((r) =>
      debloquee ? ficheComplete(r, recherche.specialites) : ficheFloutee(r, recherche.specialites),
    ),
  }
}

/** Un pays n'est proposé que si l'on sait y encaisser (voir env.annuaire). */
function paysOuvert(code) {
  return env.annuaire.paysOuverts.includes(String(code || '').toLowerCase())
}

async function referentiels(req, res) {
  res.json({
    // Le formulaire ne propose que les pays ouverts : inutile de laisser un
    // patient choisir un pays où sa recherche ne pourra jamais être payée.
    pays: Object.entries(PAYS_CEMAC)
      .filter(([code]) => paysOuvert(code))
      .map(([code, p]) => ({ code, nom: p.nom, villes: p.villes })),
    specialites: SPECIALITES_LOCALES,
    tarif: { amount: env.tarifs.ANNUAIRE, currency: env.tarifs.devise },
  })
}

async function rechercher(req, res) {
  const { symptomes, pays, ville } = req.body

  // Le formulaire ne propose déjà que les pays ouverts, mais rien n'empêche
  // d'appeler l'API directement : on refuse ici aussi, avant d'enregistrer quoi
  // que ce soit. Mieux vaut un refus net tout de suite qu'un parcours complet
  // qui s'effondre au moment de payer.
  if (!paysOuvert(pays)) {
    return res.status(400).json({
      message: "La mise en relation n'est pas encore disponible dans ce pays.",
    })
  }

  const { urgence, specialites } = trier(symptomes)

  // L'urgence est enregistrée (elle compte, et on veut la voir dans l'audit)
  // mais aucun médecin n'est cherché : pas de mise en relation à proposer à quelqu'un qui doit
  // appeler les secours.
  if (urgence) {
    const recherche = await prisma.rechercheAnnuaire.create({
      data: { userId: req.userId ?? null, symptomes, specialites, pays, ville: ville || null, urgence: true },
      include: INCLUDE_RESULTATS,
    })
    await logAction({ userId: req.userId, action: 'ANNUAIRE_URGENCE_DETECTEE', entityType: 'RechercheAnnuaire', entityId: recherche.id, ipAddress: req.ip })
    return res.status(201).json(serialiser(recherche))
  }

  // Volontaires, habilités, actifs, avec au moins une spécialité recherchée -
  // dans TOUTE la zone, pas seulement le pays du patient. La géographie
  // n'exclut personne : un dermatologue à Libreville peut résoudre le problème
  // d'un patient de Douala. Elle classe : les plus proches passent devant.
  const candidats = await prisma.medecinLocal.findMany({
    where: {
      annuaireVisible: true,
      verificationStatus: 'VALIDE',
      annuaireSpecialites: { hasSome: specialites },
      user: { active: true },
    },
    select: { id: true, pays: true, ville: true, annuaireSpecialites: true },
  })

  // Score : la spécialité la plus probable pèse le plus ; puis même pays, puis
  // même ville. Comparaisons insensibles à la casse : l'inscription stocke
  // parfois « CM », l'annuaire travaille en « cm ».
  const poids = Object.fromEntries(specialites.map((s, i) => [s, specialites.length - i]))
  const paysCherche = pays.toLowerCase()
  const villeCherchee = (ville || '').toLowerCase()
  const classes = candidats
    .map((m) => {
      const parSpecialite = m.annuaireSpecialites.reduce((acc, s) => acc + (poids[s] || 0), 0)
      const memePays = (m.pays || '').toLowerCase() === paysCherche
      const memeVille = memePays && villeCherchee && (m.ville || '').toLowerCase() === villeCherchee
      return { medecinId: m.id, score: parSpecialite * 2 + (memePays ? 3 : 0) + (memeVille ? 2 : 0) }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTATS)

  const recherche = await prisma.rechercheAnnuaire.create({
    data: {
      userId: req.userId ?? null,
      symptomes,
      specialites,
      pays,
      ville: ville || null,
      resultats: { create: classes },
    },
    include: INCLUDE_RESULTATS,
  })

  await logAction({
    userId: req.userId,
    action: 'ANNUAIRE_RECHERCHE',
    entityType: 'RechercheAnnuaire',
    entityId: recherche.id,
    metadata: { pays, ville: ville || null, specialites, nombre: classes.length },
    ipAddress: req.ip,
  })

  res.status(201).json(serialiser(recherche))
}

async function chargerRecherche(req) {
  const recherche = await prisma.rechercheAnnuaire.findUnique({ where: { id: req.params.id }, include: INCLUDE_RESULTATS })
  if (!recherche) return { error: 404, message: 'Recherche introuvable' }
  // Une recherche rattachée à un compte n'est lisible que par lui. Une recherche
  // anonyme (avant paiement) reste lisible par qui en a l'identifiant : elle ne
  // contient que des fiches floutées, et l'identifiant n'est pas devinable.
  if (recherche.userId && recherche.userId !== req.userId) return { error: 403, message: 'Cette recherche ne vous appartient pas' }
  return { recherche }
}

async function consulter(req, res) {
  const { recherche, error, message } = await chargerRecherche(req)
  if (error) return res.status(error).json({ message })
  res.json(serialiser(recherche))
}

async function initierPaiement(req, res) {
  const { recherche, error, message } = await chargerRecherche(req)
  if (error) return res.status(error).json({ message })

  if (recherche.urgence) return res.status(400).json({ message: 'Cette recherche a signalé une urgence : contactez les services d\'urgence, aucun paiement n\'est requis' })
  if (recherche.statut === 'DEBLOQUEE') return res.status(400).json({ message: 'Cette recherche est déjà débloquée' })
  if (recherche.resultats.length === 0) return res.status(400).json({ message: 'Aucun médecin à relier pour cette recherche' })

  // Pas de compte requis. L'e-mail vient du corps, ou du compte si la
  // personne est connectée et n'en a pas donné d'autre.
  let email = req.body.email
  let nom = req.body.nom
  if (req.userId) {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true, fullName: true } })
    email = email || user?.email
    nom = nom || user?.fullName
  }
  if (!email) return res.status(400).json({ message: 'Indiquez une adresse e-mail pour être mis en relation' })

  // Si la personne est connectée, la recherche lui est rattachée (elle devient
  // privée). Sinon elle reste accessible par son lien - sans compte, c'est le
  // seul moyen d'y revenir.
  await prisma.rechercheAnnuaire.update({
    where: { id: recherche.id },
    data: { emailContact: email, ...(req.userId && !recherche.userId ? { userId: req.userId } : {}) },
  })

  let resultat
  try {
    resultat = await paiements.creerPaiementAnnuaire({
      recherche,
      amount: env.tarifs.ANNUAIRE,
      email,
      customerName: nom || email,
    })
  } catch (err) {
    console.warn('Paiement annuaire impossible :', err.message)
    return res.status(502).json({ message: 'Le service de paiement est indisponible, réessayez dans un instant' })
  }

  await logAction({ userId: req.userId, action: 'ANNUAIRE_PAIEMENT_INITIE', entityType: 'Paiement', entityId: resultat.paiement.id, metadata: { rechercheId: recherche.id }, ipAddress: req.ip })

  res.status(201).json({
    paiement: resultat.paiement,
    paymentUrl: resultat.paymentUrl,
    amount: env.tarifs.ANNUAIRE,
    currency: env.tarifs.devise,
    ...(resultat.paymentUrl ? {} : { warning: 'Fournisseur de paiement indisponible (mode développement)' }),
  })
}

// Pendant du simulatePaiement des dossiers : en développement seulement, pour
// dérouler le parcours sans fournisseur réel. Jamais en production.
async function simulerPaiement(req, res) {
  if (env.nodeEnv !== 'development') return res.status(404).json({ message: 'Introuvable' })

  const { recherche, error, message } = await chargerRecherche(req)
  if (error) return res.status(error).json({ message })
  if (recherche.statut === 'DEBLOQUEE') return res.json(serialiser(recherche))

  // S'il n'y a pas encore de paiement (fournisseur injoignable, ou bouton
  // cliqué directement), on en crée un fictif : la simulation sert justement
  // à dérouler le parcours sans dépendre du fournisseur.
  let paiement = await prisma.paiement.findFirst({ where: { rechercheAnnuaireId: recherche.id }, orderBy: { createdAt: 'desc' } })
  if (!paiement) {
    paiement = await prisma.paiement.create({
      data: {
        rechercheAnnuaireId: recherche.id,
        amount: env.tarifs.ANNUAIRE,
        currency: env.tarifs.devise,
        status: 'EN_ATTENTE',
        cinetpayTransactionId: `IMSOP-ANN-SIM-${recherche.id.slice(0, 8)}-${Date.now()}`,
      },
    })
  }

  await paiements.confirmerPaiement(paiement)
  await logAction({ userId: req.userId, action: 'PAIEMENT_SIMULE_DEV', entityType: 'Paiement', entityId: paiement.id })

  const apres = await prisma.rechercheAnnuaire.findUnique({ where: { id: recherche.id }, include: INCLUDE_RESULTATS })
  res.json(serialiser(apres))
}

// --- Côté médecin ------------------------------------------------------------

const SELECT_ANNUAIRE_MEDECIN = {
  annuaireVisible: true, annuaireSpecialites: true, pays: true, ville: true, quartier: true,
  annuairePresentation: true, verificationStatus: true,
}

async function monAnnuaire(req, res) {
  const medecin = await prisma.medecinLocal.findUnique({ where: { userId: req.userId }, select: SELECT_ANNUAIRE_MEDECIN })
  if (!medecin) return res.status(404).json({ message: 'Profil médecin introuvable' })
  res.json(medecin)
}

async function mettreAJourAnnuaire(req, res) {
  const medecin = await prisma.medecinLocal.findUnique({ where: { userId: req.userId } })
  if (!medecin) return res.status(404).json({ message: 'Profil médecin introuvable' })

  const { annuaireVisible, annuaireSpecialites, pays, ville, quartier, annuairePresentation } = req.body
  const paysFinal = pays ?? medecin.pays

  // Un médecin non habilité peut préparer sa fiche, mais pas se rendre visible :
  // c'est la vérification de son numéro d'ordre qui fonde la confiance que la
  // plateforme engage
  // au patient.
  if (annuaireVisible && medecin.verificationStatus !== 'VALIDE') {
    return res.status(403).json({ message: 'Votre habilitation doit être validée avant d\'apparaître dans l\'annuaire' })
  }
  // Le pays doit être un code CEMAC connu, sinon la recherche géographique ne
  // trouverait jamais ce médecin : « Cameroun » ou « CM » saisis à l'inscription
  // ne suffisent pas, il faut choisir dans la liste.
  if (annuaireVisible && !estPaysCemac(paysFinal)) {
    return res.status(400).json({ message: 'Choisissez votre pays (zone CEMAC) pour apparaître dans l\'annuaire' })
  }
  if (ville && paysFinal && !villesDe(paysFinal).includes(ville)) {
    return res.status(400).json({ message: 'Cette ville n\'est pas dans la liste du pays choisi' })
  }

  const data = { annuaireVisible }
  if (annuaireSpecialites !== undefined) data.annuaireSpecialites = annuaireSpecialites
  if (pays !== undefined) data.pays = pays
  if (ville !== undefined) data.ville = ville
  if (quartier !== undefined) data.quartier = quartier
  if (annuairePresentation !== undefined) data.annuairePresentation = annuairePresentation

  const maj = await prisma.medecinLocal.update({ where: { id: medecin.id }, data, select: SELECT_ANNUAIRE_MEDECIN })

  await logAction({
    userId: req.userId,
    action: annuaireVisible ? 'ANNUAIRE_MEDECIN_VISIBLE' : 'ANNUAIRE_MEDECIN_MASQUE',
    entityType: 'MedecinLocal',
    entityId: medecin.id,
    ipAddress: req.ip,
  })

  res.json(maj)
}

module.exports = { referentiels, rechercher, consulter, initierPaiement, simulerPaiement, monAnnuaire, mettreAJourAnnuaire }
