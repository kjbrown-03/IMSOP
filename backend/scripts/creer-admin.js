#!/usr/bin/env node
/**
 * Crée le premier compte d'administration d'une installation neuve.
 *
 * `prisma/seed.js` ne convient pas en production : il crée cinq comptes de
 * démonstration dont les adresses (@imsop.dev) n'existent pas. Comme tous les
 * rôles autres que PATIENT exigent un code de vérification envoyé par courriel
 * à chaque connexion, aucun de ces comptes ne pourrait jamais servir.
 *
 * Usage :
 *   node scripts/creer-admin.js <email> "<Nom complet>" [ROLE]
 *
 * ROLE vaut ADMIN par défaut ; COORDINATEUR est l'autre valeur utile.
 * Le mot de passe est généré et affiché une seule fois — il n'est ni stocké en
 * clair ni journalisé.
 */
const crypto = require('crypto')
const bcrypt = require('bcrypt')
const { prisma } = require('../src/lib/prisma')

const ROLES_AUTORISES = new Set(['ADMIN', 'COORDINATEUR'])

async function main() {
  const [email, fullName, role = 'ADMIN'] = process.argv.slice(2)

  if (!email || !fullName) {
    console.error('Usage : node scripts/creer-admin.js <email> "<Nom complet>" [ADMIN|COORDINATEUR]')
    process.exit(1)
  }
  if (!ROLES_AUTORISES.has(role)) {
    console.error(`Rôle inattendu : ${role}. Valeurs acceptées : ADMIN, COORDINATEUR.`)
    process.exit(1)
  }

  const adresse = email.trim().toLowerCase()
  if (await prisma.user.findUnique({ where: { email: adresse } })) {
    console.error(`Un compte existe déjà avec ${adresse}.`)
    process.exit(1)
  }

  // Même longueur que le mot de passe envoyé à un praticien recruté : assez
  // long pour résister, assez court pour être recopié à la main.
  const motDePasse = crypto.randomBytes(11).toString('base64url').slice(0, 14)

  const user = await prisma.user.create({
    data: {
      email: adresse,
      passwordHash: await bcrypt.hash(motDePasse, 12),
      fullName,
      role,
      // L'adresse est celle de la personne qui lance ce script sur son propre
      // serveur : lui demander de la vérifier par courriel n'apporterait rien.
      emailVerified: true,
      // Non négociable pour un compte qui voit des données de santé.
      twoFactorEnabled: true,
    },
  })

  console.log('')
  console.log('Compte créé.')
  console.log(`  Rôle           : ${user.role}`)
  console.log(`  Identifiant    : ${user.email}`)
  console.log(`  Mot de passe   : ${motDePasse}`)
  console.log('')
  console.log('Notez-le maintenant : il ne sera plus affiché.')
  console.log('À chaque connexion, un code de vérification sera envoyé à cette adresse —')
  console.log('elle doit donc être une boîte que vous relevez réellement.')
  console.log('')
}

main()
  .catch((err) => {
    console.error('Échec :', err.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
