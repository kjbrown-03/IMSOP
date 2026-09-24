const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const prisma = new PrismaClient()

// Meme convention que seed.js : aucun mot de passe en dur dans le depot.
const PASSWORD = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString('base64url')
if (!process.env.SEED_PASSWORD) {
  console.warn(`[seed:medecins-locaux] SEED_PASSWORD non defini — mot de passe genere pour ce run: ${PASSWORD}`)
}

// Medecins traitants de la zone CEMAC, volontaires pour la mise en relation.
// Repartis sur plusieurs pays et villes pour que le classement geographique
// (meme ville > meme pays > reste de la zone) soit visible dans les resultats.
// Les cles de `annuaireSpecialites` viennent de src/lib/specialitesLocales.js.
const MEDECINS = [
  {
    email: 'dr.tchoumi@imsop.dev', fullName: 'Dr. Aline Tchoumi', phone: '+237 6 77 12 34 56',
    pays: 'cm', ville: 'Douala', quartier: 'Logpom', etablissement: 'Cabinet medical Logpom',
    annuaireSpecialites: ['medecine_generale', 'pediatrie'],
    annuairePresentation: 'Medecine generale et suivi des enfants. Lundi au samedi, 8h-17h. Francais, anglais.',
  },
  {
    email: 'dr.nkeng@imsop.dev', fullName: 'Dr. Samuel Nkeng', phone: '+237 6 99 87 65 43',
    pays: 'cm', ville: 'Douala', quartier: 'Bonapriso', etablissement: 'Clinique Bonapriso',
    annuaireSpecialites: ['dermatologie'],
    annuairePresentation: 'Dermatologie adulte et enfant : eczema, acne, mycoses, taches. Sur rendez-vous.',
  },
  {
    email: 'dr.essomba@imsop.dev', fullName: 'Dr. Marie-Claire Essomba', phone: '+237 6 55 44 33 22',
    pays: 'cm', ville: 'Yaoundé', quartier: 'Bastos', etablissement: 'Centre medical de Bastos',
    annuaireSpecialites: ['gynecologie'],
    annuairePresentation: 'Gynecologie, suivi de grossesse, contraception. Consultations du mardi au vendredi.',
  },
  {
    email: 'dr.fotso@imsop.dev', fullName: 'Dr. Jean-Paul Fotso', phone: '+237 6 90 11 22 33',
    pays: 'cm', ville: 'Bafoussam', quartier: 'Tamdja', etablissement: 'Cabinet dentaire Tamdja',
    annuaireSpecialites: ['dentaire'],
    annuairePresentation: 'Soins dentaires, caries, extractions, detartrage. Urgences dentaires acceptees.',
  },
  {
    email: 'dr.mbourou@imsop.dev', fullName: 'Dr. Pauline Mbourou', phone: '+241 06 12 34 56',
    pays: 'ga', ville: 'Libreville', quartier: 'Glass', etablissement: 'Polyclinique de Glass',
    annuaireSpecialites: ['dermatologie', 'medecine_generale'],
    annuairePresentation: 'Dermatologie et medecine generale. Teleconsultation possible pour un premier avis.',
  },
  {
    email: 'dr.okemba@imsop.dev', fullName: 'Dr. Patrice Okemba', phone: '+242 06 654 32 10',
    pays: 'cg', ville: 'Brazzaville', quartier: 'Poto-Poto', etablissement: 'Cabinet Okemba',
    annuaireSpecialites: ['cardiologie', 'medecine_generale'],
    annuairePresentation: 'Cardiologie : hypertension, palpitations, bilan cardiaque. ECG au cabinet.',
  },
  {
    email: 'dr.mahamat@imsop.dev', fullName: 'Dr. Halima Mahamat', phone: '+235 66 12 34 56',
    pays: 'td', ville: "N'Djaména", quartier: 'Moursal', etablissement: 'Centre de sante de Moursal',
    annuaireSpecialites: ['medecine_generale', 'infectiologie'],
    annuairePresentation: 'Medecine generale, paludisme, fievres, infections. Ouvert tous les jours.',
  },
]

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  const crees = []

  for (const m of MEDECINS) {
    const profil = {
      specialite: m.annuaireSpecialites[0],
      etablissement: m.etablissement,
      pays: m.pays,
      ville: m.ville,
      quartier: m.quartier,
      numeroOrdre: `ORD-${m.pays.toUpperCase()}-${crypto.randomInt(10000, 99999)}`,
      annuaireVisible: true,
      annuaireSpecialites: m.annuaireSpecialites,
      annuairePresentation: m.annuairePresentation,
      // Sans VALIDE, la recherche ecarte le profil : la mise en relation
      // n'engage la plateforme que sur des medecins habilites.
      verificationStatus: 'VALIDE',
      verifiedAt: new Date(),
    }

    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {
        passwordHash,
        fullName: m.fullName,
        phone: m.phone,
        active: true,
        emailVerified: true,
        medecinLocal: { update: profil },
      },
      create: {
        email: m.email,
        passwordHash,
        fullName: m.fullName,
        phone: m.phone,
        role: 'MEDECIN_LOCAL',
        emailVerified: true,
        medecinLocal: { create: profil },
      },
    })

    crees.push({ nom: user.fullName, pays: m.pays, ville: m.ville, specialites: m.annuaireSpecialites.join(', ') })
  }

  console.log(`\n[seed:medecins-locaux] ${crees.length} medecins traitants visibles dans l'annuaire\n`)
  console.table(crees)
  console.log(`\nMot de passe commun a tous ces comptes : ${PASSWORD}`)
  console.log('Role MEDECIN_LOCAL => 2FA obligatoire au login.\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
