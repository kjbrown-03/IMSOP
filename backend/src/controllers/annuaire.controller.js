const { prisma } = require('../lib/prisma')
const { logAction } = require('../services/auditService')
const { safeUserSelect } = require('../lib/selectors')
const { trier } = require('../lib/triage')
const {
  PAYS_CEMAC, villesDe, estPaysCemac, DECOUPAGE_CAMEROUN, lieuCamerounValide, situerAuCameroun, distanceKm,
} = require('../lib/cemac')
const { SPECIALITES_LOCALES } = require('../lib/specialitesLocales')
const paiements = require('./paiements.controller')
const env = require('../config/env')
const transcription = require('../services/transcriptionService')
const { estAdresseFictive } = require('../lib/mailer')

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

function tarifAnnuaire() {
  return {
    amount: env.tarifs.ANNUAIRE,
    baseAmount: env.tarifs.ANNUAIRE_BASE,
    fraisEstimes: Math.max(0, env.tarifs.ANNUAIRE - env.tarifs.ANNUAIRE_BASE),
    fraisPourcent: env.tarifs.ANNUAIRE_FRAIS_PAIEMENT_POURCENT,
    currency: env.tarifs.devise,
  }
}

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
    // Région, département, arrondissement : la même finesse que la ville. Le
    // quartier, qui permettrait de retrouver le cabinet, reste après paiement.
    region: m.region,
    departement: m.departement,
    arrondissement: m.arrondissement,
    score: resultat.score,
    // Donne avant le paiement : c'est l'un des rares reperes dont dispose un
    // patient qui ne connait personne, et il lui sert a CHOISIR. Le lui cacher
    // jusqu'apres le paiement le ferait choisir a l'aveugle.
    experience: m.annuaireExperience ?? null,
  }
}

// Ce qu'on montre APRÈS paiement.
function ficheComplete(resultat, specialitesRecherchees) {
  const m = resultat.medecin
  return {
    ...ficheFloutee(resultat, specialitesRecherchees),
    nom: m.user.fullName,
    telephone: m.user.phone,
    // Une adresse d'import (`.invalid`) n'est pas un moyen de contact.
    email: estAdresseFictive(m.user.email) ? null : m.user.email,
    etablissement: m.etablissement,
    pays: m.pays,
    quartier: m.quartier,
    // Apres paiement seulement, comme le telephone : c'est precisement ce que la
    // mise en relation achete. Le patient construit lui-meme le lien vers son
    // application de carte — on ne stocke aucune coordonnee.
    adresse: m.annuaireAdresse || null,
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

// Nombre de contacts payés qui restent à choisir.
function contactsDisponibles(recherche) {
  return Math.max(0, recherche.contactsPayes - recherche.contactsChoisis.length)
}

function serialiser(recherche) {
  const debloquee = recherche.statut === 'DEBLOQUEE'
  const dateFinSimulationPublique = Date.parse(env.annuaire.simulationPubliqueJusqua)
  return {
    id: recherche.id,
    statut: recherche.statut,
    urgence: recherche.urgence,
    specialites: recherche.specialites,
    typePratique: recherche.typePratique,
    pays: recherche.pays,
    paysResidence: recherche.paysResidence,
    ville: recherche.ville,
    region: recherche.region,
    departement: recherche.departement,
    arrondissement: recherche.arrondissement,
    nombre: recherche.resultats.length,
    tarif: tarifAnnuaire(),
    simulationPubliqueActive: Number.isFinite(dateFinSimulationPublique) && Date.now() < dateFinSimulationPublique,
    createdAt: recherche.createdAt,
    debloqueeLe: recherche.debloqueeLe,
    specialisteChoisiId: debloquee ? recherche.specialisteChoisiId : null,
    contactsPayes: recherche.contactsPayes,
    contactsChoisis: recherche.contactsChoisis,
    contactsDisponibles: contactsDisponibles(recherche),
    // Seuls les contacts choisis partent en clair. Avant, le paiement révélait
    // toutes les fiches jusqu'au premier choix : le patient lisait tous les
    // numéros pour le prix d'un seul.
    resultats: recherche.resultats.map((r) =>
      recherche.contactsChoisis.includes(r.id)
        ? ficheComplete(r, recherche.specialites)
        : ficheFloutee(r, recherche.specialites),
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
    // Toute la zone est proposée — un patient de Libreville doit pouvoir dire
    // où il vit — mais `ouvert` dit honnêtement où la mise en relation peut
    // être payée aujourd'hui. Le formulaire n'offre pas de bouton de recherche
    // ailleurs : ce bouton échouerait.
    pays: Object.entries(PAYS_CEMAC)
      .map(([code, p]) => ({ code, nom: p.nom, villes: p.villes, ouvert: paysOuvert(code) })),
    decoupage: { cm: DECOUPAGE_CAMEROUN.regions },
    specialites: SPECIALITES_LOCALES,
    tarif: tarifAnnuaire(),
  })
}

async function rechercher(req, res) {
  const { symptomes, pays, ville, typePratique } = req.body
  const paysResidence = req.body.paysResidence || null
  // Le découpage n'existe que pour le Cameroun : ailleurs on l'ignore plutôt
  // que d'enregistrer une région qui ne veut rien dire.
  const lieu = pays === 'cm'
    ? { region: req.body.region || null, departement: req.body.departement || null, arrondissement: req.body.arrondissement || null }
    : { region: null, departement: null, arrondissement: null }

  // Le formulaire ne propose déjà que les pays ouverts, mais rien n'empêche
  // d'appeler l'API directement : on refuse ici aussi, avant d'enregistrer quoi
  // que ce soit. Mieux vaut un refus net tout de suite qu'un parcours complet
  // qui s'effondre au moment de payer.
  if (!paysOuvert(pays)) {
    return res.status(400).json({
      message: "La mise en relation n'est pas encore disponible dans ce pays.",
    })
  }
  if (!lieuCamerounValide(lieu)) {
    return res.status(400).json({ message: "Ce lieu n'existe pas dans le découpage du Cameroun." })
  }

  const { urgence, specialites } = trier(symptomes)

  // L'urgence est enregistrée (elle compte, et on veut la voir dans l'audit)
  // mais aucun médecin n'est cherché : pas de mise en relation à proposer à quelqu'un qui doit
  // appeler les secours.
  if (urgence) {
    const recherche = await prisma.rechercheAnnuaire.create({
      data: { userId: req.userId ?? null, symptomes, specialites, typePratique, pays, paysResidence, ville: ville || null, ...lieu, urgence: true },
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
      // Conventionnel et traditionnel ne se mélangent jamais : le patient a
      // choisi avant de décrire ses symptômes, lui proposer l'autre serait
      // répondre à côté de sa demande.
      typePratique,
      annuaireVisible: true,
      verificationStatus: 'VALIDE',
      annuaireSpecialites: { hasSome: specialites },
      user: { active: true },
    },
    select: { id: true, pays: true, ville: true, region: true, departement: true, arrondissement: true, annuaireSpecialites: true, annuaireExperience: true },
  })

  // Score : la spécialité la plus probable pèse le plus ; puis même pays, puis
  // la proximité. Comparaisons insensibles à la casse : l'inscription stocke
  // parfois « CM », l'annuaire travaille en « cm ».
  const poids = Object.fromEntries(specialites.map((s, i) => [s, specialites.length - i]))
  const paysCherche = pays.toLowerCase()
  const villeCherchee = (ville || '').toLowerCase()
  const lieuPatient = paysCherche === 'cm' ? situerAuCameroun({ ...lieu, ville }) : null
  const classes = candidats
    .map((m) => {
      const parSpecialite = m.annuaireSpecialites.reduce((acc, s) => acc + (poids[s] || 0), 0)
      const memePays = (m.pays || '').toLowerCase() === paysCherche
      let proximite = 0
      if (memePays && lieuPatient) {
        proximite = proximiteCameroun(lieuPatient, situerAuCameroun(m))
      } else if (memePays && villeCherchee && (m.ville || '').toLowerCase() === villeCherchee) {
        proximite = 2
      }
      return { medecinId: m.id, score: parSpecialite * 2 + (memePays ? 3 : 0) + proximite }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_RESULTATS)

  const recherche = await prisma.rechercheAnnuaire.create({
    data: {
      userId: req.userId ?? null,
      symptomes,
      specialites,
      typePratique,
      pays,
      paysResidence,
      ville: ville || null,
      ...lieu,
      resultats: { create: classes },
    },
    include: INCLUDE_RESULTATS,
  })

  await logAction({
    userId: req.userId,
    action: 'ANNUAIRE_RECHERCHE',
    entityType: 'RechercheAnnuaire',
    entityId: recherche.id,
    metadata: { pays, paysResidence, ville: ville || null, ...lieu, specialites, typePratique, nombre: classes.length },
    ipAddress: req.ip,
  })

  res.status(201).json(serialiser(recherche))
}

/**
 * Bonus de proximité entre le lieu du patient et celui d'un médecin, au
 * Cameroun. La distance entre arrondissements fait le gros du travail : deux
 * arrondissements voisins de départements différents (Mfou et Yaoundé IVe)
 * sont plus proches que deux bouts du Haut-Nyong. Les niveaux administratifs
 * ne servent que quand une coordonnée manque.
 *
 * Plafonné à 6 : la spécialité doit continuer de primer — un dermatologue à
 * 30 km répond mieux à un problème de peau qu'un généraliste voisin.
 */
function proximiteCameroun(patient, medecin) {
  if (!patient || !medecin) return 0
  if (patient.arrondissement && patient.arrondissement === medecin.arrondissement) return 6
  if (patient.lat != null && medecin.lat != null) {
    const d = distanceKm(patient, medecin)
    if (d <= 15) return 5
    if (d <= 50) return 4
    if (d <= 150) return 2
    return patient.region === medecin.region ? 1 : 0
  }
  if (patient.departement && patient.departement === medecin.departement) return 3
  return patient.region === medecin.region ? 1 : 0
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

async function choisirSpecialiste(req, res) {
  const { recherche, error, message } = await chargerRecherche(req)
  if (error) return res.status(error).json({ message })
  if (recherche.contactsPayes === 0) return res.status(403).json({ message: 'La mise en relation doit être payée avant de choisir un praticien' })

  const resultat = recherche.resultats.find((r) => r.id === req.params.resultatId)
  if (!resultat) return res.status(404).json({ message: 'Ce praticien ne fait pas partie de cette recherche' })
  // Déjà choisi : rien à faire, et surtout rien à décompter une seconde fois.
  if (recherche.contactsChoisis.includes(resultat.id)) return res.json(serialiser(recherche))

  // Écriture conditionnelle, en une seule requête : deux clics simultanés sur
  // deux fiches ne doivent pas consommer un même paiement deux fois. Une
  // lecture suivie d'une écriture laisserait passer les deux.
  const maj = await prisma.$executeRaw`
    UPDATE "RechercheAnnuaire"
    SET "contactsChoisis" = array_append("contactsChoisis", ${resultat.id}),
        "specialisteChoisiId" = ${resultat.id}
    WHERE "id" = ${recherche.id}
      AND NOT (${resultat.id} = ANY("contactsChoisis"))
      AND cardinality("contactsChoisis") < "contactsPayes"`
  const actuelle = await prisma.rechercheAnnuaire.findUnique({ where: { id: recherche.id }, include: INCLUDE_RESULTATS })
  if (maj === 0 && !actuelle.contactsChoisis.includes(resultat.id)) {
    return res.status(402).json({ message: 'Chaque mise en relation donne un seul contact. Payez une nouvelle mise en relation pour obtenir celui-ci.' })
  }

  await logAction({
    userId: req.userId,
    action: 'ANNUAIRE_SPECIALISTE_CHOISI',
    entityType: 'RechercheAnnuaire',
    entityId: recherche.id,
    metadata: { resultatId: resultat.id, contactsPayes: actuelle.contactsPayes, contactsChoisis: actuelle.contactsChoisis.length },
    ipAddress: req.ip,
  })
  return res.json(serialiser(actuelle))
}

async function initierPaiement(req, res) {
  const { recherche, error, message } = await chargerRecherche(req)
  if (error) return res.status(error).json({ message })

  if (recherche.urgence) return res.status(400).json({ message: 'Cette recherche a signalé une urgence : contactez les services d\'urgence, aucun paiement n\'est requis' })
  if (recherche.resultats.length === 0) return res.status(400).json({ message: 'Aucun médecin à relier pour cette recherche' })
  // On ne fait pas payer un contact de plus tant qu'un contact payé attend
  // d'être choisi, ni quand il ne reste plus personne à qui être relié.
  if (contactsDisponibles(recherche) > 0) return res.status(400).json({ message: 'Un contact payé vous attend : choisissez d\'abord votre praticien' })
  if (recherche.contactsChoisis.length >= recherche.resultats.length) return res.status(400).json({ message: 'Vous avez déjà obtenu tous les contacts de cette recherche' })

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
/**
 * Deroule le parcours de deblocage SANS passer par le fournisseur de paiement.
 *
 * QUI Y A DROIT
 *
 * En developpement, tout le monde. En production, la coordination et
 * l'administration seulement — elles doivent pouvoir verifier le parcours sur
 * les vraies donnees, et elles voient deja ces medecins depuis leurs propres
 * ecrans : rien ne leur est revele qu'elles ne puissent consulter autrement.
 *
 * Un patient ne peut pas s'en servir pour contourner le paiement : son role ne
 * figure pas dans la liste, et la route exige un jeton valide.
 *
 * Chaque usage laisse une trace nominative dans le journal d'audit. C'est la
 * contrepartie d'un point d'entree qui donne acces a des coordonnees sans
 * paiement : on doit pouvoir dire qui s'en est servi, et quand.
 */
const ROLES_SIMULATION = ['COORDINATEUR', 'ADMIN']

async function simulerPaiement(req, res) {
  // Jeton presente mais rejete : on repond 401 pour que le navigateur renouvelle
  // la session et reessaie. Repondre 404 laissait l'appelant bloque alors qu'il
  // lui suffisait de rafraichir son jeton.
  if (req.jetonRejete) return res.status(401).json({ message: 'Session expirée' })

  const dateFinSimulationPublique = Date.parse(env.annuaire.simulationPubliqueJusqua)
  const simulationPublique = Number.isFinite(dateFinSimulationPublique) && Date.now() < dateFinSimulationPublique
  const autorise = env.nodeEnv === 'development' || ROLES_SIMULATION.includes(req.userRole) || simulationPublique
  // 404 plutot que 403 : pour un appelant sans droit, ce point d'entree n'a pas
  // a exister. Annoncer « interdit » revient a confirmer qu'il y a une porte.
  if (!autorise) return res.status(404).json({ message: 'Introuvable' })

  const { recherche, error, message } = await chargerRecherche(req)
  if (error) return res.status(error).json({ message })
  if (contactsDisponibles(recherche) > 0 || recherche.contactsChoisis.length >= recherche.resultats.length) {
    return res.json(serialiser(recherche))
  }

  // En mode public de test, ne jamais convertir une tentative réelle de
  // paiement en paiement simulé : le webhook du fournisseur peut encore aboutir.
  if (simulationPublique) {
    const paiementEnAttente = await prisma.paiement.findFirst({
      where: { rechercheAnnuaireId: recherche.id, status: 'EN_ATTENTE' },
    })
    if (paiementEnAttente) {
      return res.status(409).json({ message: 'Un paiement réel est déjà en cours pour cette recherche' })
    }
  }

  // S'il n'y a pas encore de paiement (fournisseur injoignable, ou bouton
  // cliqué directement), on en crée un fictif : la simulation sert justement
  // à dérouler le parcours sans dépendre du fournisseur.
  // Le paiement le plus récent encore en attente : un paiement déjà confirmé a
  // déjà donné son contact, le reconfirmer ne compterait rien.
  let paiement = await prisma.paiement.findFirst({ where: { rechercheAnnuaireId: recherche.id, status: { not: 'PAYE' } }, orderBy: { createdAt: 'desc' } })
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
  await logAction({
    userId: req.userId,
    action: 'PAIEMENT_SIMULE',
    entityType: 'Paiement',
    entityId: paiement.id,
    metadata: {
      rechercheId: recherche.id,
      role: req.userRole || (simulationPublique ? 'VISITEUR_TEST' : undefined),
      environnement: env.nodeEnv,
      ...(simulationPublique ? { simulationPublique: true } : {}),
    },
    ipAddress: req.ip,
  })

  const apres = await prisma.rechercheAnnuaire.findUnique({ where: { id: recherche.id }, include: INCLUDE_RESULTATS })
  res.json(serialiser(apres))
}

// --- Côté médecin ------------------------------------------------------------

const SELECT_ANNUAIRE_MEDECIN = {
  annuaireVisible: true, annuaireSpecialites: true, annuaireExperience: true, annuaireAdresse: true, avisLocalActif: true, pays: true, ville: true, quartier: true,
  region: true, departement: true, arrondissement: true,
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

  const { annuaireVisible, annuaireSpecialites, annuaireExperience, annuaireAdresse, avisLocalActif, pays, ville, quartier, annuairePresentation } = req.body
  const { region, departement, arrondissement } = req.body
  const paysFinal = pays ?? medecin.pays

  // Un médecin non habilité peut préparer sa fiche, mais pas se rendre visible :
  // c'est la vérification de son numéro d'ordre qui fonde la confiance que la
  // plateforme engage
  // au patient.
  // Le tradipraticien ne modifie pas ce qu'il soigne : il le demande à la
  // coordination, justificatifs à l'appui (prisesEnCharge.controller). Le
  // renvoi de la liste à l'identique reste accepté, pour qu'un ancien écran
  // qui l'envoie encore ne casse pas l'enregistrement du reste.
  if (annuaireSpecialites !== undefined && req.userRole === 'TRADIPRATICIEN') {
    const memes = annuaireSpecialites.length === medecin.annuaireSpecialites.length
      && annuaireSpecialites.every((s) => medecin.annuaireSpecialites.includes(s))
    if (!memes) {
      return res.status(403).json({
        message: 'Les maladies prises en charge se modifient sur demande à la coordination, avec justificatifs.',
      })
    }
  }
  // Être visible sans spécialité n'aurait aucun sens : le praticien ne
  // ressortirait dans aucune recherche.
  const specialitesFinales = annuaireSpecialites ?? medecin.annuaireSpecialites
  if (annuaireVisible && specialitesFinales.length === 0) {
    return res.status(400).json({ message: 'Choisissez au moins une spécialité pour apparaître dans l\'annuaire' })
  }
  if (annuaireVisible && medecin.verificationStatus !== 'VALIDE') {
    return res.status(403).json({ message: 'Votre habilitation doit être validée avant d\'apparaître dans l\'annuaire' })
  }
  // L'annuaire n'est pas la suite logique de l'inscription : c'est un service
  // que la plateforme vend, où elle recommande un médecin à un patient qui ne
  // connaît personne. Elle ne recommande que des praticiens que le comité
  // scientifique a examinés sur dossier. Un médecin inscrit seul suit ses
  // propres patients — pour rejoindre l'annuaire, il dépose une candidature.
  if (annuaireVisible && !medecin.valideParComite) {
    return res.status(403).json({
      message: "L'annuaire est réservé aux médecins retenus par le comité scientifique. Déposez une candidature pour le rejoindre.",
    })
  }
  // Meme confiance engagee que l'annuaire : la plateforme designe ce medecin a un
  // patient qui ne le connait pas. L'accepter ici lui ferait croire qu'il recevra
  // des dossiers, alors que l'affectation l'ecarterait sans jamais le lui dire.
  // L'avis sur dossier est un parcours de medecine conventionnelle : le
  // tradipraticien n'a pas de dossiers dans son espace.
  if (avisLocalActif && req.userRole === 'TRADIPRATICIEN') {
    return res.status(403).json({ message: 'La rédaction d\'avis sur dossier n\'est pas ouverte aux tradipraticiens.' })
  }
  if (avisLocalActif && (medecin.verificationStatus !== 'VALIDE' || !medecin.valideParComite)) {
    return res.status(403).json({
      message: 'Rédiger des avis est réservé aux médecins habilités et retenus par le comité scientifique.',
    })
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
  const lieuCm = { region: region ?? null, departement: departement ?? null, arrondissement: arrondissement ?? null }
  if ((region || departement || arrondissement) && (String(paysFinal).toLowerCase() !== 'cm' || !lieuCamerounValide(lieuCm))) {
    return res.status(400).json({ message: "Ce lieu n'existe pas dans le découpage du Cameroun." })
  }

  const data = { annuaireVisible }
  if (annuaireSpecialites !== undefined) data.annuaireSpecialites = annuaireSpecialites
  if (annuaireExperience !== undefined) data.annuaireExperience = annuaireExperience
  if (annuaireAdresse !== undefined) data.annuaireAdresse = annuaireAdresse
  if (avisLocalActif !== undefined) data.avisLocalActif = avisLocalActif
  if (pays !== undefined) data.pays = pays
  if (ville !== undefined) data.ville = ville
  if (quartier !== undefined) data.quartier = quartier
  // Les trois niveaux s'écrivent ensemble : garder l'ancien arrondissement
  // sous un nouveau département donnerait une fiche impossible.
  if (region !== undefined || departement !== undefined || arrondissement !== undefined) Object.assign(data, lieuCm)
  // Quitter le Cameroun efface le découpage, qui n'y aurait plus de sens.
  if (pays !== undefined && String(pays).toLowerCase() !== 'cm') Object.assign(data, { region: null, departement: null, arrondissement: null })
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

/**
 * Transcrit un message vocal decrivant des symptomes.
 *
 * Le patient qui ne peut pas ecrire — illettrisme, douleur, main blessee,
 * telephone malcommode — doit pouvoir dire son mal. Le texte obtenu revient au
 * navigateur, qui le place dans le champ de description : il reste MODIFIABLE
 * avant l envoi. C est volontaire. La transcription est excellente mais pas
 * infaillible, et personne ne doit lancer une recherche medicale sur des mots
 * qu il n a pas relus.
 *
 * Rien n est enregistre ici : ni l audio, qui n existe qu en memoire le temps du
 * traitement, ni le texte, qui n est conserve que si le patient lance ensuite
 * une recherche. Un essai abandonne ne laisse aucune trace.
 */
async function transcrireSymptomes(req, res, next) {
  try {
    if (!env.transcription.url) {
      return res.status(503).json({ message: "La description vocale n'est pas disponible" })
    }
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun enregistrement recu' })
    }

    const langue = ['fr', 'en'].includes(req.body?.langue) ? req.body.langue : undefined
    const { texte, langue: detectee } = await transcription.transcrire(
      req.file.buffer,
      req.file.originalname || 'message.webm',
      req.file.mimetype,
      langue,
    )

    if (!texte) {
      return res.status(422).json({ message: "Aucune parole n'a ete reconnue dans cet enregistrement" })
    }

    res.json({ texte, langue: detectee })
  } catch (err) {
    next(err)
  }
}

module.exports = { referentiels, rechercher, consulter, choisirSpecialiste, initierPaiement, simulerPaiement, monAnnuaire, mettreAJourAnnuaire, transcrireSymptomes }
