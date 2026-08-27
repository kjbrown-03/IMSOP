require('./env')
const bcrypt = require('bcrypt')
const { prisma } = require('../../src/lib/prisma')

// L'application hache à 12 tours. Ici 4 : la suite crée des dizaines de
// comptes, et à 12 tours elle passerait l'essentiel de son temps dans bcrypt
// pour ne rien vérifier de plus. Le coût n'est jamais lu depuis le hachage
// stocké, `bcrypt.compare` le retrouve dedans — la connexion fonctionne donc
// exactement pareil.
const COUT_BCRYPT_TEST = 4

const MOT_DE_PASSE = 'MotDePasseTest123!'

let compteur = 0
const unique = (prefixe) => `${prefixe}-${process.pid}-${++compteur}`

async function creerUtilisateur(role, { email, actif = true, emailVerified = true, motDePasse = MOT_DE_PASSE, ...reste } = {}) {
  return prisma.user.create({
    data: {
      email: email || `${unique(role.toLowerCase())}@imsop.test`,
      passwordHash: await bcrypt.hash(motDePasse, COUT_BCRYPT_TEST),
      role,
      fullName: reste.fullName || `Compte ${role}`,
      active: actif,
      emailVerified,
    },
  })
}

async function creerPatient(options = {}) {
  const user = await creerUtilisateur('PATIENT', options)
  const patient = await prisma.patient.create({
    data: { userId: user.id, patientRef: unique('IMS'), country: 'CM' },
  })
  return { user, patient }
}

async function creerSpecialiste({ verificationStatus = 'VALIDE', ...options } = {}) {
  const user = await creerUtilisateur('SPECIALISTE', options)
  const specialiste = await prisma.specialiste.create({
    data: { userId: user.id, specialite: 'Cardiologie', pays: 'FR', verificationStatus },
  })
  return { user, specialiste }
}

async function creerMedecinLocal({ verificationStatus = 'VALIDE', ...options } = {}) {
  const user = await creerUtilisateur('MEDECIN_LOCAL', options)
  const medecinLocal = await prisma.medecinLocal.create({
    data: { userId: user.id, specialite: 'Médecine générale', pays: 'CM', verificationStatus },
  })
  return { user, medecinLocal }
}

const creerCoordinateur = (options) => creerUtilisateur('COORDINATEUR', options)
const creerAdmin = (options) => creerUtilisateur('ADMIN', options)

// `patient` est volontairement facultatif : depuis l'ouverture du parcours
// médecin, un dossier peut décrire un patient anonymisé sans compte associé.
async function creerDossier({
  patient = null,
  specialiste = null,
  medecinLocal = null,
  demandeurMedecin = null,
  status = 'SOUMIS',
  ...reste
} = {}) {
  return prisma.dossier.create({
    data: {
      reference: unique('MSO-2026-CM'),
      patientId: patient?.id ?? null,
      specialisteId: specialiste?.id ?? null,
      medecinLocalId: medecinLocal?.id ?? null,
      demandeurMedecinId: demandeurMedecin?.id ?? null,
      specialiteRequise: 'Cardiologie',
      motif: 'Second avis sur un diagnostic de cardiopathie',
      status,
      ...reste,
    },
  })
}

module.exports = {
  MOT_DE_PASSE,
  COUT_BCRYPT_TEST,
  creerUtilisateur,
  creerPatient,
  creerSpecialiste,
  creerMedecinLocal,
  creerCoordinateur,
  creerAdmin,
  creerDossier,
}
