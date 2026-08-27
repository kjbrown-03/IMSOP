require('./env')
const { prisma } = require('../../src/lib/prisma')

// Les tables sont lues dans le catalogue Postgres plutôt qu'énumérées à la
// main : une nouvelle table ajoutée par une migration est vidée elle aussi,
// sans que personne ait à penser à mettre cette liste à jour. Oublier une
// table produirait des tests qui passent seuls et échouent en suite complète.
async function tablesApplicatives() {
  const lignes = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `
  return lignes
    .map((l) => l.tablename)
    .filter((nom) => nom !== '_prisma_migrations')
    .map((nom) => `"public"."${nom}"`)
}

let cache = null

// CASCADE parce que les tables sont liées entre elles ; RESTART IDENTITY pour
// que deux tests consécutifs ne dépendent jamais d'un compteur laissé par le
// précédent (SequenceCompteur, notamment, sert à générer les références).
async function viderBase() {
  if (!cache) cache = await tablesApplicatives()
  if (cache.length === 0) return
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${cache.join(', ')} RESTART IDENTITY CASCADE`)
}

async function fermerBase() {
  await prisma.$disconnect()
}

module.exports = { prisma, viderBase, fermerBase }
