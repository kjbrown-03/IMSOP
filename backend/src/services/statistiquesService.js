const { prisma } = require('../lib/prisma')

/**
 * Statistiques et indicateurs de la plateforme — CDC §62 (Business Intelligence)
 * et §63 (les 13 indicateurs clés).
 *
 * Trois des treize indicateurs ne peuvent pas être calculés avec le modèle de
 * données actuel : ils sont renvoyés avec `disponible: false` et un motif, plutôt
 * qu'avec un zéro. Un zéro se lit comme « aucune réclamation, aucun coût », ce
 * qui est faux et trompeur ; l'absence doit se voir comme une absence.
 */

// Un dossier est « sorti du brouillon » dès qu'il a été soumis au moins une fois.
const STATUTS_SOUMIS = [
  'SOUMIS', 'EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_DOCUMENTS', 'EN_VERIFICATION',
  'COMPLET', 'EN_ATTENTE_AFFECTATION', 'AFFECTE', 'ACCEPTE_PAR_SPECIALISTE',
  'EN_ANALYSE', 'INFORMATION_COMPLEMENTAIRE_DEMANDEE', 'RAPPORT_EN_PREPARATION',
  'RAPPORT_SOUMIS', 'RAPPORT_VALIDE', 'RAPPORT_TRANSMIS', 'SUIVI', 'CLOTURE',
  'ANNULE', 'REFUSE',
]

// Le dossier a franchi la vérification de complétude (§13).
const STATUTS_COMPLETS = [
  'COMPLET', 'EN_ATTENTE_AFFECTATION', 'AFFECTE', 'ACCEPTE_PAR_SPECIALISTE',
  'EN_ANALYSE', 'INFORMATION_COMPLEMENTAIRE_DEMANDEE', 'RAPPORT_EN_PREPARATION',
  'RAPPORT_SOUMIS', 'RAPPORT_VALIDE', 'RAPPORT_TRANSMIS', 'SUIVI', 'CLOTURE',
]

// Le deuxième avis a été rendu au patient.
const STATUTS_TERMINES = ['RAPPORT_TRANSMIS', 'SUIVI', 'CLOTURE']

// Le spécialiste a répondu à l'affectation, dans un sens ou dans l'autre (§18).
const STATUTS_REPONDU = [
  'ACCEPTE_PAR_SPECIALISTE', 'EN_ANALYSE', 'INFORMATION_COMPLEMENTAIRE_DEMANDEE',
  'RAPPORT_EN_PREPARATION', 'RAPPORT_SOUMIS', 'RAPPORT_VALIDE',
  'RAPPORT_TRANSMIS', 'SUIVI', 'CLOTURE', 'REFUSE',
]

const MS_PAR_JOUR = 24 * 60 * 60 * 1000

/** Pourcentage arrondi à une décimale. `null` si le dénominateur est nul : un
 *  taux sur zéro dossier n'est pas 0 %, il n'existe pas. */
function taux(numerateur, denominateur) {
  if (!denominateur) return null
  return Math.round((numerateur / denominateur) * 1000) / 10
}

function moyenneJours(durees) {
  if (!durees.length) return null
  const total = durees.reduce((somme, d) => somme + d, 0)
  return Math.round((total / durees.length / MS_PAR_JOUR) * 10) / 10
}

/** Filtre de période réutilisable, appliqué sur la date de création. */
function filtrePeriode(depuis, jusquA) {
  if (!depuis && !jusquA) return {}
  return {
    createdAt: {
      ...(depuis ? { gte: depuis } : {}),
      ...(jusquA ? { lte: jusquA } : {}),
    },
  }
}

/** Moyenne d'une note sur 5, à une décimale. */
function moyenneNote(notes) {
  if (!notes || notes.length === 0) return null
  return Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10
}

function compter(liste, cle) {
  const parCle = new Map()
  for (const item of liste) {
    const valeur = item[cle]
    if (!valeur) continue
    parCle.set(valeur, (parCle.get(valeur) || 0) + 1)
  }
  return [...parCle.entries()]
    .map(([libelle, nombre]) => ({ libelle, nombre }))
    .sort((a, b) => b.nombre - a.nombre)
}

async function calculerStatistiques({ depuis = null, jusquA = null } = {}) {
  const periode = filtrePeriode(depuis, jusquA)

  const [
    totalPatients,
    dossiers,
    dossiersAvecRapport,
    paiementsConfirmes,
    specialistes,
    patients,
    temoignages,
  ] = await Promise.all([
    prisma.patient.count({ where: periode }),
    prisma.dossier.findMany({
      where: periode,
      select: { id: true, status: true, specialiteRequise: true, createdAt: true, assignedAt: true },
    }),
    // Le délai d'obtention se mesure de la création du dossier à la validation
    // du rapport : c'est le temps vécu par le patient, pas le temps de rédaction.
    prisma.dossier.findMany({
      where: { ...periode, rapport: { validatedAt: { not: null } } },
      select: {
        createdAt: true,
        specialiteRequise: true,
        rapport: { select: { validatedAt: true } },
        specialiste: { select: { id: true, pays: true, user: { select: { fullName: true } } } },
      },
    }),
    // Le §62 demande le chiffre d'affaires ET les remboursements : on charge les
    // deux statuts en une passe et on les sépare ensuite.
    prisma.paiement.findMany({
      where: { ...periode, status: { in: ['PAYE', 'REMBOURSE'] } },
      select: {
        status: true,
        amount: true,
        currency: true,
        dossier: {
          select: {
            specialiteRequise: true,
            specialiste: { select: { pays: true } },
            patient: { select: { country: true } },
          },
        },
      },
    }),
    prisma.specialiste.findMany({
      select: { id: true, pays: true, etablissement: true, disponible: true, verificationStatus: true },
    }),
    prisma.patient.findMany({ where: periode, select: { country: true } }),
    // Les témoignages rejetés à la modération comptent : un texte écarté pour
    // sa forme reste un ressenti réel, il n'est simplement pas publié.
    prisma.temoignage.findMany({
      where: { ...periode, note: { not: null } },
      select: { roleAuteur: true, note: true },
    }),
  ])

  const notesParRole = new Map()
  for (const t of temoignages) {
    if (!notesParRole.has(t.roleAuteur)) notesParRole.set(t.roleAuteur, [])
    notesParRole.get(t.roleAuteur).push(t.note)
  }

  const totalDossiers = dossiers.length
  const parStatut = (statuts) => dossiers.filter((d) => statuts.includes(d.status)).length

  const soumis = parStatut(STATUTS_SOUMIS)
  const complets = parStatut(STATUTS_COMPLETS)
  const termines = parStatut(STATUTS_TERMINES)
  const annules = parStatut(['ANNULE'])
  const incomplets = parStatut(['EN_ATTENTE_DOCUMENTS', 'EN_ATTENTE_PAIEMENT'])

  // Taux de réponse : parmi les dossiers effectivement affectés, ceux pour
  // lesquels le spécialiste s'est prononcé. Les dossiers jamais affectés ne
  // comptent pas — ce serait reprocher au spécialiste un délai de coordination.
  const affectes = dossiers.filter((d) => d.assignedAt !== null).length
  const repondus = dossiers.filter((d) => d.assignedAt !== null && STATUTS_REPONDU.includes(d.status)).length

  const delais = dossiersAvecRapport.map((d) => d.rapport.validatedAt - d.createdAt)

  // Délai par spécialiste (§62 Performance).
  const parSpecialiste = new Map()
  for (const d of dossiersAvecRapport) {
    if (!d.specialiste) continue
    const cle = d.specialiste.id
    if (!parSpecialiste.has(cle)) {
      parSpecialiste.set(cle, { nom: d.specialiste.user.fullName, durees: [] })
    }
    parSpecialiste.get(cle).durees.push(d.rapport.validatedAt - d.createdAt)
  }
  const delaiParSpecialiste = [...parSpecialiste.values()]
    .map(({ nom, durees }) => ({ nom, dossiers: durees.length, delaiMoyenJours: moyenneJours(durees) }))
    .sort((a, b) => a.delaiMoyenJours - b.delaiMoyenJours)

  // Finance : les montants sont agrégés PAR DEVISE. Additionner des XAF et des
  // EUR sans taux de conversion produirait un nombre qui ne veut rien dire, et
  // la table de conversion du §39 n'existe pas encore.
  const parDevise = new Map()
  const parDeviseRembourse = new Map()
  const parSpecialiteRevenu = new Map()
  const parPaysRevenu = new Map()
  for (const p of paiementsConfirmes) {
    const montant = Number(p.amount)
    if (p.status === 'REMBOURSE') {
      parDeviseRembourse.set(p.currency, (parDeviseRembourse.get(p.currency) || 0) + montant)
      continue
    }
    parDevise.set(p.currency, (parDevise.get(p.currency) || 0) + montant)

    const spe = p.dossier?.specialiteRequise
    if (spe) {
      const cle = `${spe}|${p.currency}`
      parSpecialiteRevenu.set(cle, (parSpecialiteRevenu.get(cle) || 0) + montant)
    }
    const pays = p.dossier?.patient?.country
    if (pays) {
      const cle = `${pays}|${p.currency}`
      parPaysRevenu.set(cle, (parPaysRevenu.get(cle) || 0) + montant)
    }
  }
  const eclater = (map) =>
    [...map.entries()]
      .map(([cle, montant]) => {
        const [libelle, devise] = cle.split('|')
        return { libelle, devise, montant: Math.round(montant * 100) / 100 }
      })
      .sort((a, b) => b.montant - a.montant)

  const chiffreAffaires = [...parDevise.entries()]
    .map(([devise, montant]) => ({ devise, montant: Math.round(montant * 100) / 100 }))
    .sort((a, b) => b.montant - a.montant)

  const dossiersPayes = paiementsConfirmes.filter((p) => p.status === 'PAYE').length
  const revenuMoyenParDossier = chiffreAffaires.map(({ devise, montant }) => ({
    devise,
    montant: dossiersPayes ? Math.round((montant / dossiersPayes) * 100) / 100 : null,
  }))

  const specialistesActifs = specialistes.filter(
    (s) => s.verificationStatus === 'VALIDE' && s.disponible,
  ).length

  // « Établissements partenaires » : le CDC prévoit un modèle Hôpital (§26) qui
  // relève de la phase 2. En attendant, on compte les établissements distincts
  // déclarés par les spécialistes — c'est une approximation, signalée comme telle.
  const etablissements = new Set(specialistes.map((s) => s.etablissement).filter(Boolean))

  const paysCouverts = new Set([
    ...specialistes.map((s) => s.pays).filter(Boolean),
    ...patients.map((p) => p.country).filter(Boolean),
  ])

  const indisponible = (numero, cle, raison) => ({ numero, cle, disponible: false, raison })

  return {
    periode: {
      depuis: depuis ? depuis.toISOString() : null,
      jusquA: (jusquA || new Date()).toISOString(),
    },

    // §63 — les treize indicateurs clés, dans l'ordre du cahier des charges.
    kpis: [
      { numero: 1, cle: 'patients', valeur: totalPatients, unite: 'nombre', disponible: true },
      { numero: 2, cle: 'demandes', valeur: totalDossiers, unite: 'nombre', disponible: true },
      {
        numero: 3,
        cle: 'tauxConversion',
        valeur: taux(soumis, totalDossiers),
        unite: 'pourcentage',
        disponible: true,
        note: 'Dossiers effectivement soumis rapportés aux dossiers créés (brouillons inclus).',
      },
      {
        numero: 4,
        cle: 'delaiMoyenAvis',
        valeur: moyenneJours(delais),
        unite: 'jours',
        disponible: true,
        note: 'De la création du dossier à la validation du rapport.',
        echantillon: delais.length,
      },
      { numero: 5, cle: 'tauxDossiersComplets', valeur: taux(complets, totalDossiers), unite: 'pourcentage', disponible: true },
      {
        numero: 6,
        cle: 'tauxReponseSpecialistes',
        valeur: taux(repondus, affectes),
        unite: 'pourcentage',
        disponible: true,
        echantillon: affectes,
      },
      // La mention « module de notation non implémenté » était périmée : les
      // témoignages collectent une note de 1 à 5 et retiennent le rôle de leur
      // auteur. L'effectif accompagne la moyenne — la note reste facultative,
      // et une moyenne sur trois avis n'est pas une satisfaction.
      {
        numero: 7,
        cle: 'satisfactionPatient',
        valeur: moyenneNote(notesParRole.get('PATIENT')),
        unite: 'note5',
        disponible: true,
        echantillon: (notesParRole.get('PATIENT') || []).length,
      },
      {
        numero: 8,
        cle: 'satisfactionMedecin',
        valeur: moyenneNote(notesParRole.get('MEDECIN_LOCAL')),
        unite: 'note5',
        disponible: true,
        echantillon: (notesParRole.get('MEDECIN_LOCAL') || []).length,
      },
      indisponible(9, 'coutMoyenParDossier', "Aucune donnée de coût : la rémunération des spécialistes et les commissions (CDC §39) ne sont pas modélisées."),
      { numero: 10, cle: 'revenuMoyenParDossier', valeur: revenuMoyenParDossier, unite: 'montantParDevise', disponible: true, echantillon: dossiersPayes },
      { numero: 11, cle: 'specialistesActifs', valeur: specialistesActifs, unite: 'nombre', disponible: true, note: 'Habilitation VALIDE et déclarés disponibles.' },
      {
        numero: 12,
        cle: 'etablissementsPartenaires',
        valeur: etablissements.size,
        unite: 'nombre',
        disponible: true,
        approximation: true,
        note: "Établissements distincts déclarés par les spécialistes ; le modèle Hôpital (CDC §26) relève de la phase 2.",
      },
      { numero: 13, cle: 'paysCouverts', valeur: paysCouverts.size, unite: 'nombre', disponible: true },
    ],

    // §62 — Business Intelligence, regroupée selon les quatre axes du CDC.
    activite: {
      demandes: totalDossiers,
      dossiersTermines: termines,
      specialitesDemandees: compter(dossiers, 'specialiteRequise'),
      paysPatients: compter(patients, 'country'),
    },
    performance: {
      delaiMoyenJours: moyenneJours(delais),
      delaiParSpecialiste,
      tauxIncomplets: taux(incomplets, totalDossiers),
      tauxAnnulation: taux(annules, totalDossiers),
    },
    finance: {
      chiffreAffaires,
      remboursements: [...parDeviseRembourse.entries()]
        .map(([devise, montant]) => ({ devise, montant: Math.round(montant * 100) / 100 }))
        .sort((a, b) => b.montant - a.montant),
      revenusParSpecialite: eclater(parSpecialiteRevenu),
      revenusParPays: eclater(parPaysRevenu),
      dossiersPayes,
      commissions: null,
      commissionsIndisponibles: 'Aucun barème de commission n\'est modélisé (CDC §39).',
    },
    qualite: {
      tauxReponse: taux(repondus, affectes),
      satisfaction: null,
      reclamations: null,
      incidents: null,
      indisponible: 'Notation (§43) et suivi des réclamations (§44) non implémentés.',
    },
  }
}

module.exports = { calculerStatistiques }
