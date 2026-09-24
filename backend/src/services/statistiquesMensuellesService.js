const { prisma } = require('../lib/prisma')

/**
 * Les neuf indicateurs du MVP retenus (CDC §8, sans le coût moyen), mois par mois.
 *
 * Distinct de `calculerStatistiques`, qui rend un instantané sur une période :
 * ici chaque mois est une ligne, et surtout **chaque indicateur a sa propre date
 * de référence**. Un dossier créé le 28 janvier et validé le 3 février compte en
 * janvier pour « nombre de demandes » et en février pour « délai moyen ». C'est
 * voulu : rattacher le délai au mois de création ferait bouger un mois déjà
 * publié à chaque rapport rendu.
 */

// Africa/Douala est à UTC+1 toute l'année — pas d'heure d'été. Un décalage fixe
// suffit donc, là où un fuseau à changement d'heure imposerait une vraie
// bibliothèque. Sans ce calage, un dossier créé le 31 janvier à 23 h 30 à Douala
// tomberait dans le mois de février.
const DECALAGE_DOUALA_MS = 3600 * 1000

const MS_PAR_JOUR = 24 * 60 * 60 * 1000

/** Clé « AAAA-MM » du mois local auquel appartient une date. */
function moisDe(date) {
  if (!date) return null
  const local = new Date(new Date(date).getTime() + DECALAGE_DOUALA_MS)
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Les `nombre` derniers mois, du plus ancien au plus récent. */
function derniersMois(nombre, maintenant = new Date()) {
  const local = new Date(maintenant.getTime() + DECALAGE_DOUALA_MS)
  const mois = []
  for (let recul = nombre - 1; recul >= 0; recul--) {
    const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() - recul, 1))
    mois.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return mois
}

/** Début (UTC) du mois local le plus ancien de la série. */
function debutDeLaSerie(mois) {
  const [annee, m] = mois[0].split('-').map(Number)
  return new Date(Date.UTC(annee, m - 1, 1) - DECALAGE_DOUALA_MS)
}

function taux(numerateur, denominateur) {
  if (!denominateur) return null
  return Math.round((numerateur / denominateur) * 1000) / 10
}

function moyenne(valeurs, decimales = 1) {
  if (!valeurs.length) return null
  const facteur = 10 ** decimales
  return Math.round((valeurs.reduce((s, v) => s + v, 0) / valeurs.length) * facteur) / facteur
}

// Un dossier est sorti du brouillon dès qu'il a été soumis au moins une fois.
const STATUTS_SOUMIS = new Set([
  'SOUMIS', 'EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_DOCUMENTS', 'EN_VERIFICATION',
  'COMPLET', 'EN_ATTENTE_AFFECTATION', 'AFFECTE', 'ACCEPTE_PAR_SPECIALISTE',
  'EN_ANALYSE', 'INFORMATION_COMPLEMENTAIRE_DEMANDEE', 'RAPPORT_EN_PREPARATION',
  'RAPPORT_SOUMIS', 'RAPPORT_VALIDE', 'RAPPORT_TRANSMIS', 'SUIVI', 'CLOTURE',
  'ANNULE', 'REFUSE',
])

// Le dossier a franchi la vérification de complétude (§13).
const STATUTS_COMPLETS = new Set([
  'COMPLET', 'EN_ATTENTE_AFFECTATION', 'AFFECTE', 'ACCEPTE_PAR_SPECIALISTE',
  'EN_ANALYSE', 'INFORMATION_COMPLEMENTAIRE_DEMANDEE', 'RAPPORT_EN_PREPARATION',
  'RAPPORT_SOUMIS', 'RAPPORT_VALIDE', 'RAPPORT_TRANSMIS', 'SUIVI', 'CLOTURE',
])

const ACTIONS_SUIVIES = [
  'DOSSIER_ACCEPTE',
  'DOSSIER_REFUSE',
  'DOSSIER_CONFLIT_INTERETS',
  'DOSSIER_COMPLEMENT_DEMANDE',
]

async function calculerStatistiquesMensuelles({ mois: nombreDeMois = 12 } = {}) {
  const mois = derniersMois(nombreDeMois)
  const debut = debutDeLaSerie(mois)

  const [dossiers, rapportsValides, paiements, temoignages, journal] = await Promise.all([
    prisma.dossier.findMany({
      where: { createdAt: { gte: debut } },
      select: { id: true, createdAt: true, status: true },
    }),
    // Rattachés au mois de validation : c'est là que la performance se constate.
    prisma.rapport.findMany({
      where: { validatedAt: { gte: debut } },
      select: { validatedAt: true, dossier: { select: { createdAt: true } } },
    }),
    // `confirmedAt` et non `createdAt` : le revenu appartient au mois où
    // l'argent est réellement encaissé, pas à celui où la demande est née.
    prisma.paiement.findMany({
      where: { status: 'PAYE', confirmedAt: { gte: debut } },
      select: { confirmedAt: true, amount: true, currency: true },
    }),
    // Les témoignages rejetés à la modération comptent dans la note : un texte
    // écarté pour sa forme reste un ressenti réel. Ils ne sont simplement pas
    // publiés.
    prisma.temoignage.findMany({
      where: { createdAt: { gte: debut }, note: { not: null } },
      select: { createdAt: true, roleAuteur: true, note: true },
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { gte: debut }, action: { in: ACTIONS_SUIVIES } },
      select: { createdAt: true, action: true, dossierId: true },
    }),
  ])

  // Un dossier ayant demandé un complément repasse en analyse dès qu'il l'a
  // reçu : le compter par son statut courant sous-estimerait massivement
  // l'indicateur. Le journal, lui, garde la trace après résolution.
  const dossiersAvecComplement = new Set(
    journal.filter((e) => e.action === 'DOSSIER_COMPLEMENT_DEMANDE' && e.dossierId).map((e) => e.dossierId),
  )

  const vide = () => ({
    crees: 0,
    soumis: 0,
    complets: 0,
    avecComplement: 0,
    delais: [],
    paiements: new Map(),
    notesPatient: [],
    notesMedecin: [],
    acceptes: 0,
    refuses: 0,
    recusations: 0,
  })

  const seaux = new Map(mois.map((m) => [m, vide()]))
  const dans = (date) => seaux.get(moisDe(date))

  for (const d of dossiers) {
    const seau = dans(d.createdAt)
    if (!seau) continue
    seau.crees++
    if (STATUTS_SOUMIS.has(d.status)) seau.soumis++
    if (STATUTS_COMPLETS.has(d.status)) seau.complets++
    if (dossiersAvecComplement.has(d.id)) seau.avecComplement++
  }

  for (const r of rapportsValides) {
    const seau = dans(r.validatedAt)
    if (!seau) continue
    seau.delais.push(r.validatedAt - r.dossier.createdAt)
  }

  for (const p of paiements) {
    const seau = dans(p.confirmedAt)
    if (!seau) continue
    const courant = seau.paiements.get(p.currency) || { total: 0, nombre: 0 }
    courant.total += Number(p.amount)
    courant.nombre++
    seau.paiements.set(p.currency, courant)
  }

  for (const t of temoignages) {
    const seau = dans(t.createdAt)
    if (!seau) continue
    if (t.roleAuteur === 'PATIENT') seau.notesPatient.push(t.note)
    else if (t.roleAuteur === 'MEDECIN_LOCAL') seau.notesMedecin.push(t.note)
  }

  for (const e of journal) {
    const seau = dans(e.createdAt)
    if (!seau) continue
    if (e.action === 'DOSSIER_ACCEPTE') seau.acceptes++
    else if (e.action === 'DOSSIER_REFUSE') seau.refuses++
    else if (e.action === 'DOSSIER_CONFLIT_INTERETS') seau.recusations++
  }

  const lignes = mois.map((cle) => {
    const s = seaux.get(cle)

    // La récusation pour conflit d'intérêts est exclue du dénominateur : c'est
    // une obligation déontologique, pas un refus de travailler. La compter
    // comme un refus pénaliserait l'expert qui fait exactement ce qu'on attend
    // de lui. Elle est rendue à part.
    const seProsonces = s.acceptes + s.refuses

    return {
      mois: cle,
      kpis: [
        { numero: 1, cle: 'demandes', valeur: s.crees, unite: 'nombre', disponible: true },
        { numero: 2, cle: 'dossiersComplets', valeur: s.complets, unite: 'nombre', disponible: true },
        {
          numero: 3,
          cle: 'tauxConversion',
          valeur: taux(s.soumis, s.crees),
          unite: 'pourcentage',
          disponible: true,
          note: 'Dossiers soumis rapportés aux dossiers créés dans le mois.',
        },
        {
          numero: 4,
          cle: 'delaiMoyen',
          valeur: s.delais.length ? moyenne(s.delais.map((d) => d / MS_PAR_JOUR)) : null,
          unite: 'jours',
          disponible: true,
          echantillon: s.delais.length,
          note: 'De la création du dossier à la mise à disposition du rapport, rattaché au mois de validation.',
        },
        {
          numero: 5,
          cle: 'revenuMoyen',
          // Par devise : additionner des XAF et des EUR sans table de
          // conversion produirait un nombre qui ne veut rien dire.
          valeur: [...s.paiements.entries()].map(([devise, { total, nombre }]) => ({
            devise,
            montant: Math.round((total / nombre) * 100) / 100,
            dossiers: nombre,
          })),
          unite: 'montantParDevise',
          disponible: true,
        },
        {
          numero: 6,
          cle: 'satisfactionPatient',
          valeur: moyenne(s.notesPatient),
          unite: 'note5',
          disponible: true,
          // L'effectif fait partie de l'indicateur : une moyenne sur trois avis
          // n'est pas une satisfaction, et la note reste facultative.
          echantillon: s.notesPatient.length,
        },
        {
          numero: 7,
          cle: 'satisfactionMedecin',
          valeur: moyenne(s.notesMedecin),
          unite: 'note5',
          disponible: true,
          echantillon: s.notesMedecin.length,
        },
        {
          numero: 8,
          cle: 'tauxAcceptationSpecialistes',
          valeur: taux(s.acceptes, seProsonces),
          unite: 'pourcentage',
          disponible: true,
          echantillon: seProsonces,
          note: `Acceptations rapportées aux prises de position. ${s.recusations} récusation(s) pour conflit d'intérêts exclue(s) du calcul.`,
          recusations: s.recusations,
        },
        {
          numero: 9,
          cle: 'tauxComplementsDemandes',
          valeur: taux(s.avecComplement, s.crees),
          unite: 'pourcentage',
          disponible: true,
          note: "Dossiers du mois pour lesquels un complément a été demandé au moins une fois, y compris s'il a depuis été fourni.",
        },
      ],
    }
  })

  return {
    fuseau: 'Africa/Douala',
    mois: lignes,
  }
}

module.exports = {
  calculerStatistiquesMensuelles,
  // Exportés pour être vérifiables seuls : c'est le découpage des mois qui
  // décide de la ligne dans laquelle tombe chaque événement.
  moisDe,
  derniersMois,
}
