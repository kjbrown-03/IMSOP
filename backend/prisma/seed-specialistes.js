const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const prisma = new PrismaClient()

// Meme convention que seed.js : aucun mot de passe en dur dans le depot.
const PASSWORD = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString('base64url')
if (!process.env.SEED_PASSWORD) {
  console.warn(`[seed:specialistes] SEED_PASSWORD non defini — mot de passe genere pour ce run: ${PASSWORD}`)
}

// Un expert habilite par specialite canonique (cf. SPECIALITE_FR cote front).
// Les bios sont volontairement riches en termes metier : le critere
// « expertise » du score croise les mots du dossier avec ceux de la bio, un
// profil vide ne permettrait donc de tester que la correspondance de
// specialite et la charge de travail.
const EXPERTS = [
  {
    email: 'oncologie@imsop.dev',
    fullName: 'Dr. Awa Ndiaye',
    specialite: 'Oncologie',
    pays: 'France',
    etablissement: 'Institut Curie, Paris',
    langues: 'FR, EN',
    bio: "Oncologue medicale. Tumeurs mammaires et pulmonaires, chimiotherapie, immunotherapie, relecture de biopsies, staging tumoral et decision de traitement en reunion de concertation.",
  },
  {
    email: 'cardiologie@imsop.dev',
    fullName: 'Dr. Marc Vasseur',
    specialite: 'Cardiologie',
    pays: 'France',
    etablissement: 'CHU de Bordeaux',
    langues: 'FR, EN',
    bio: "Cardiologue interventionnel. Insuffisance cardiaque, coronaropathie, arythmie et fibrillation, hypertension arterielle, echographie cardiaque et coronarographie.",
  },
  {
    email: 'neurologie@imsop.dev',
    fullName: 'Dr. Léa Fontaine',
    specialite: 'Neurologie',
    pays: 'France',
    etablissement: 'Hôpital Pitié-Salpêtrière, Paris',
    langues: 'FR, EN',
    bio: "Neurologue. Epilepsie, sclerose en plaques, accident vasculaire cerebral, cephalees chroniques, troubles cognitifs, electroencephalogramme.",
  },
  {
    email: 'orthopedie@imsop.dev',
    fullName: 'Dr. Samuel Etoa',
    specialite: 'Orthopédie',
    pays: 'Cameroun',
    etablissement: 'Hôpital Général de Douala',
    langues: 'FR, EN',
    bio: "Chirurgien orthopediste. Fractures complexes, prothese de hanche et de genou, chirurgie du rachis, traumatologie sportive, pseudarthrose.",
  },
  {
    email: 'radiologie@imsop.dev',
    fullName: 'Dr. Hélène Roux',
    specialite: 'Radiologie',
    pays: 'Suisse',
    etablissement: 'Hôpitaux Universitaires de Genève',
    langues: 'FR, EN, DE',
    bio: "Radiologue. Relecture de scanner et imagerie par resonance magnetique, echographie, radiographie thoracique, imagerie abdominale et osteoarticulaire.",
  },
  {
    email: 'anatomopathologie@imsop.dev',
    fullName: 'Dr. Pierre Lemoine',
    specialite: 'Anatomopathologie',
    pays: 'France',
    etablissement: 'CHU de Lyon',
    langues: 'FR, EN',
    bio: "Anatomopathologiste. Relecture de lames histologiques, biopsies tumorales, immunohistochimie, diagnostic differentiel des cancers, marges de resection.",
  },
  {
    email: 'pediatrie@imsop.dev',
    fullName: 'Dr. Fatou Sow',
    specialite: 'Pédiatrie',
    pays: 'Sénégal',
    etablissement: "Hôpital d'Enfants Albert Royer, Dakar",
    langues: 'FR, EN',
    bio: "Pediatre. Nourrisson et enfant, retard de croissance, infections respiratoires pediatriques, malnutrition, drepanocytose, vaccination.",
  },
  {
    email: 'gynecologie@imsop.dev',
    fullName: 'Dr. Claire Mbarga',
    specialite: 'Gynécologie-obstétrique',
    pays: 'Cameroun',
    etablissement: 'Hôpital Gynéco-Obstétrique de Yaoundé',
    langues: 'FR, EN',
    bio: "Gynecologue obstetricienne. Grossesse a haut risque, fibrome uterin, endometriose, suivi prenatal, cesarienne, infertilite.",
  },
  {
    email: 'nephrologie@imsop.dev',
    fullName: 'Dr. Karim Benali',
    specialite: 'Néphrologie',
    pays: 'Algérie',
    etablissement: 'CHU Mustapha, Alger',
    langues: 'FR, AR, EN',
    bio: "Nephrologue. Insuffisance renale chronique, dialyse, transplantation renale, proteinurie, hypertension refractaire, glomerulonephrite.",
  },
  {
    email: 'gastroenterologie@imsop.dev',
    fullName: 'Dr. Antoine Girard',
    specialite: 'Gastro-entérologie',
    pays: 'France',
    etablissement: 'Hôpital Saint-Antoine, Paris',
    langues: 'FR, EN',
    bio: "Gastroenterologue. Endoscopie digestive, maladie de Crohn, colite ulcereuse, hepatite chronique, cirrhose, coloscopie de depistage.",
  },
  {
    email: 'pneumologie@imsop.dev',
    fullName: 'Dr. Inês Ferreira',
    specialite: 'Pneumologie',
    pays: 'Portugal',
    etablissement: 'Hospital de Santa Maria, Lisbonne',
    langues: 'PT, FR, EN',
    bio: "Pneumologue. Asthme severe, bronchopneumopathie chronique obstructive, tuberculose, apnee du sommeil, fibrose pulmonaire, nodule pulmonaire.",
  },
]

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  const crees = []

  for (const expert of EXPERTS) {
    const profil = {
      specialite: expert.specialite,
      pays: expert.pays,
      etablissement: expert.etablissement,
      langues: expert.langues,
      bio: expert.bio,
      disponible: true,
      // Sans VALIDE, getRecommandations ecarte le profil : le compte
      // existerait mais ne remonterait jamais dans les propositions.
      verificationStatus: 'VALIDE',
      verifiedAt: new Date(),
    }

    const user = await prisma.user.upsert({
      where: { email: expert.email },
      // Re-jouer le script reactualise le profil et le mot de passe : utile
      // quand on refait une passe de tests apres avoir modifie le score.
      update: {
        passwordHash,
        fullName: expert.fullName,
        active: true,
        emailVerified: true,
        specialiste: { update: profil },
      },
      create: {
        email: expert.email,
        passwordHash,
        fullName: expert.fullName,
        role: 'SPECIALISTE',
        emailVerified: true,
        specialiste: { create: profil },
      },
      include: { specialiste: true },
    })

    crees.push({ specialite: expert.specialite, email: user.email, nom: user.fullName, pays: expert.pays })
  }

  console.log(`\n[seed:specialistes] ${crees.length} experts habilites (VALIDE + disponible)\n`)
  console.table(crees)
  console.log(`\nMot de passe commun a tous ces comptes : ${PASSWORD}`)
  console.log('Role SPECIALISTE => 2FA obligatoire au login. Sans SMTP configure,')
  console.log("le code a 6 chiffres s'affiche dans la console du backend (prefixe [mailer:dev]).\n")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
