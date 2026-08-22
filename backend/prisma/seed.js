const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const prisma = new PrismaClient()

// Never hardcode a real credential here: SEED_PASSWORD lets each environment
// set its own dev password, and a random fallback means an accidental seed
// run against a reachable environment doesn't leave a known password on
// privileged accounts (ADMIN, COORDINATEUR, SPECIALISTE).
const PASSWORD = process.env.SEED_PASSWORD || crypto.randomBytes(9).toString('base64url')
if (!process.env.SEED_PASSWORD) {
  console.warn(`[seed] SEED_PASSWORD non défini — mot de passe généré aléatoirement pour ce run: ${PASSWORD}`)
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const patientUser = await prisma.user.upsert({
    where: { email: 'patient@imsop.dev' },
    update: {},
    create: {
      email: 'patient@imsop.dev',
      passwordHash,
      fullName: 'Jean Dupont',
      role: 'PATIENT',
      phone: '+237600000001',
      patient: {
        create: {
          patientRef: 'IMS-2026-0001',
          dob: new Date('1975-03-12'),
          gender: 'homme',
          country: 'cm',
        },
      },
    },
    include: { patient: true },
  })

  const specialisteUser = await prisma.user.upsert({
    where: { email: 'specialiste@imsop.dev' },
    update: {},
    create: {
      email: 'specialiste@imsop.dev',
      passwordHash,
      fullName: 'Dr. Alain Lemaire',
      role: 'SPECIALISTE',
      twoFactorEnabled: true,
      specialiste: {
        create: {
          specialite: 'Cardiologie',
          pays: 'France',
          etablissement: 'Hôpital Pitié-Salpêtrière, Paris',
          langues: 'FR, EN',
          verified: true,
          disponible: true,
        },
      },
    },
    include: { specialiste: true },
  })

  await prisma.user.upsert({
    where: { email: 'coordinateur@imsop.dev' },
    update: {},
    create: {
      email: 'coordinateur@imsop.dev',
      passwordHash,
      fullName: 'Marie Coordinatrice',
      role: 'COORDINATEUR',
      twoFactorEnabled: true,
    },
  })

  await prisma.user.upsert({
    where: { email: 'admin@imsop.dev' },
    update: {},
    create: {
      email: 'admin@imsop.dev',
      passwordHash,
      fullName: 'Admin IMSOP',
      role: 'ADMIN',
      twoFactorEnabled: true,
    },
  })

  await prisma.dossier.upsert({
    where: { reference: 'MLA-2026-0001' },
    update: {},
    create: {
      reference: 'MLA-2026-0001',
      patientId: patientUser.patient.id,
      specialisteId: specialisteUser.specialiste.id,
      specialiteRequise: 'Cardiologie',
      motif: 'Avis sur ECG atypique',
      symptomes: 'Palpitations régulières, douleurs thoraciques intermittentes.',
      urgence: 'NORMAL',
      status: 'EN_ANALYSE',
      assignedAt: new Date(),
      messagingClosesAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  })

  console.log('Seed OK:', {
    patient: patientUser.email,
    specialiste: specialisteUser.email,
    coordinateur: 'coordinateur@imsop.dev',
    admin: 'admin@imsop.dev',
    password: PASSWORD,
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
