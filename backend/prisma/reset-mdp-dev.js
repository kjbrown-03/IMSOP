// Outil de developpement : reattribue un mot de passe connu aux comptes de
// test. Un hash bcrypt n'etant pas reversible, c'est le seul moyen de
// reprendre la main sur un compte seede avec un mot de passe aleatoire.
//
//   $env:SEED_PASSWORD = 'Imsop.Test2026!'
//   node prisma/reset-mdp-dev.js                 # tous les comptes @imsop.dev
//   node prisma/reset-mdp-dev.js admin@imsop.dev # ou une liste ciblee
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

// Garde-fou : ce script rend des comptes a privileges accessibles avec un mot
// de passe partage. Il n'a rien a faire ailleurs qu'en local.
if (process.env.NODE_ENV === 'production') {
  console.error('[reset-mdp] refus : NODE_ENV=production')
  process.exit(1)
}

const PASSWORD = process.env.SEED_PASSWORD
if (!PASSWORD) {
  console.error('[reset-mdp] definir SEED_PASSWORD avant de lancer ce script')
  process.exit(1)
}

async function main() {
  const cibles = process.argv.slice(2)
  const where = cibles.length ? { email: { in: cibles } } : { email: { endsWith: '@imsop.dev' } }

  const users = await prisma.user.findMany({ where, select: { id: true, email: true, role: true } })
  if (!users.length) {
    console.log('[reset-mdp] aucun compte correspondant')
    return
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12)
  await prisma.user.updateMany({ where: { id: { in: users.map((u) => u.id) } }, data: { passwordHash } })

  // Les sessions ouvertes doivent tomber : sinon un refresh token emis avant
  // le changement continuerait de donner acces au compte.
  const { count } = await prisma.refreshToken.deleteMany({ where: { userId: { in: users.map((u) => u.id) } } })

  console.log(`\n[reset-mdp] ${users.length} compte(s) mis a jour, ${count} session(s) revoquee(s)\n`)
  console.table(users.map((u) => ({ role: u.role, email: u.email, motDePasse: PASSWORD })))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
