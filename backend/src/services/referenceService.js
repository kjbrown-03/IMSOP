const { prisma } = require('../lib/prisma')

// CDC §11 : « Le système attribue un numéro unique au dossier, par exemple :
// MSO-2026-CM-000125 ». Un compteur, pas un tirage aléatoire.
//
// L'implémentation précédente tirait `crypto.randomInt(1000, 9999)` sur une
// colonne `@unique` : 9 000 valeurs seulement, donc une collision — et une
// erreur 500 à la création du dossier — devenait probable dès le ~113e dossier
// d'une même année (paradoxe des anniversaires, vérifié par simulation).

// Un seul INSERT ... ON CONFLICT DO UPDATE : l'incrément est atomique côté
// Postgres, donc deux créations simultanées ne peuvent pas obtenir le même
// numéro, contrairement à un read-then-write applicatif.
async function prochainNumero(cle, client = prisma) {
  const rows = await client.$queryRaw`
    INSERT INTO "SequenceCompteur" ("cle", "valeur")
    VALUES (${cle}, 1)
    ON CONFLICT ("cle") DO UPDATE SET "valeur" = "SequenceCompteur"."valeur" + 1
    RETURNING "valeur"
  `
  return rows[0].valeur
}

// Le pays vient du profil patient, saisi en ISO-2 minuscule ('cm'). `XX` marque
// un dossier dont le pays n'est pas renseigné plutôt que d'échouer : le numéro
// doit toujours pouvoir être attribué.
function codePays(pays) {
  if (typeof pays !== 'string') return 'XX'
  const code = pays.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : 'XX'
}

function formater(n) {
  return String(n).padStart(6, '0')
}

async function genererReferenceDossier(pays, client = prisma) {
  const annee = new Date().getFullYear()
  // Le compteur est global par année : un dossier camerounais et un dossier
  // sénégalais de 2026 ne partagent jamais le même numéro d'ordre.
  const numero = await prochainNumero(`DOSSIER-${annee}`, client)
  return `MSO-${annee}-${codePays(pays)}-${formater(numero)}`
}

async function genererPatientRef(client = prisma) {
  const annee = new Date().getFullYear()
  const numero = await prochainNumero(`PATIENT-${annee}`, client)
  return `IMS-${annee}-${formater(numero)}`
}

module.exports = { genererReferenceDossier, genererPatientRef, prochainNumero, codePays }
