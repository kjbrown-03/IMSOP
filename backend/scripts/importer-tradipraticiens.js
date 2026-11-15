#!/usr/bin/env node
/**
 * Enrôle des tradipraticiens à partir d'une cartographie (fichier JSON tiré du
 * tableur « Cartographie des TPS »).
 *
 * Usage :
 *   node scripts/importer-tradipraticiens.js <fichier.json>           # essai, n'écrit rien
 *   node scripts/importer-tradipraticiens.js <fichier.json> --ecrire  # importe
 *
 * Le fichier de données n'est PAS dans le dépôt : il contient des noms et des
 * numéros de téléphone, et le dépôt est public.
 *
 * Chaque entrée : { nom, telephones[], region, departement, arrondissement,
 * district, aireSante, localite, maladies[], experience }.
 *
 * Choix assumés (décidés par le porteur du projet le 2026-11-15) :
 *  - Ces praticiens ne se sont pas inscrits eux-mêmes ; ils sont rendus
 *    visibles d'emblée, sauf ceux sans téléphone exploitable : une mise en
 *    relation payée vers une fiche sans numéro ne servirait à rien.
 *  - Toutes les maladies déclarées sont reprises, y compris les plus graves.
 *  - Le « district de santé » du tableur vaut arrondissement ; Ngaoundéré
 *    urbain et rural, qui recouvrent plusieurs arrondissements, restent au
 *    niveau du département de la Vina.
 *
 * Les comptes n'ont pas d'adresse : on leur en donne une sous `.invalid`
 * (domaine réservé, jamais attribué), dérivée du nom, du téléphone et du
 * district. Relancer le script met donc à jour les mêmes fiches au lieu d'en
 * créer des doubles, et aucun courriel n'y est envoyé (voir lib/mailer.js).
 * Le mot de passe est aléatoire et jeté : personne ne peut s'y connecter tant
 * que la coordination n'a pas attaché une vraie adresse au compte.
 */
const crypto = require('crypto')
const fs = require('fs')
const bcrypt = require('bcrypt')
const { prisma } = require('../src/lib/prisma')
const { trier } = require('../src/lib/triage')
const { lieuCamerounValide } = require('../src/lib/cemac')

// « Tout maladie » ne désigne aucune spécialité : la médecine générale, qui
// sert de filet à toute recherche, suffit à faire ressortir ces praticiens.
const SANS_SPECIALITE = /^tou(te)?s?\s+(les\s+)?maladies?$/i

function specialitesDe(maladies) {
  const cles = new Set(['medecine_generale'])
  for (const m of maladies) {
    if (SANS_SPECIALITE.test(m.trim())) continue
    for (const s of trier(m).specialites) cles.add(s)
  }
  return [...cles]
}

function presentation(tp) {
  const morceaux = []
  if (tp.maladies.length) morceaux.push(`Soins déclarés : ${tp.maladies.join(', ')}.`)
  if (tp.aireSante) morceaux.push(`Aire de santé : ${tp.aireSante}.`)
  if (tp.telephones.length > 1) morceaux.push(`Autre numéro : ${tp.telephones.slice(1).join(', ')}.`)
  const texte = morceaux.join(' ')
  return texte.length > 600 ? `${texte.slice(0, 597)}...` : texte
}

function adresseImport(tp) {
  const empreinte = crypto.createHash('sha256').update([tp.nom, tp.telephones[0] || '', tp.district].join('|')).digest('hex')
  return `tp-${empreinte.slice(0, 16)}@tradipraticiens.imsop.invalid`
}

async function main() {
  const [fichier, option] = process.argv.slice(2)
  if (!fichier) {
    console.error('Usage : node scripts/importer-tradipraticiens.js <fichier.json> [--ecrire]')
    process.exit(1)
  }
  const ecrire = option === '--ecrire'
  const entrees = JSON.parse(fs.readFileSync(fichier, 'utf8'))

  const bilan = { total: entrees.length, crees: 0, misAJour: 0, visibles: 0, masques: 0, lieuInvalide: 0 }

  for (const tp of entrees) {
    const lieu = { region: tp.region, departement: tp.departement, arrondissement: tp.arrondissement || null }
    if (!lieuCamerounValide(lieu)) {
      bilan.lieuInvalide++
      console.warn(`Lieu inconnu, ignoré : ${tp.nom} (${tp.district})`)
      continue
    }
    const visible = tp.telephones.length > 0
    visible ? bilan.visibles++ : bilan.masques++

    const email = adresseImport(tp)
    const fiche = {
      typePratique: 'TRADITIONNEL',
      specialite: 'Tradipraticien',
      pays: 'cm',
      ville: null,
      ...lieu,
      quartier: tp.localite || null,
      verificationStatus: 'VALIDE',
      valideParComite: true,
      annuaireVisible: visible,
      annuaireSpecialites: specialitesDe(tp.maladies),
      annuaireExperience: tp.experience ?? null,
      annuairePresentation: presentation(tp),
    }

    if (!ecrire) continue

    const existant = await prisma.user.findUnique({ where: { email }, include: { medecinLocal: true } })
    if (existant?.medecinLocal) {
      await prisma.user.update({ where: { id: existant.id }, data: { fullName: tp.nom, phone: tp.telephones[0] || null } })
      await prisma.medecinLocal.update({ where: { id: existant.medecinLocal.id }, data: fiche })
      bilan.misAJour++
      continue
    }
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
    await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'MEDECIN_LOCAL',
        fullName: tp.nom,
        phone: tp.telephones[0] || null,
        medecinLocal: { create: { ...fiche, valideParComiteLe: new Date() } },
      },
    })
    bilan.crees++
  }

  console.log(ecrire ? 'Import terminé :' : 'Essai (rien n\'a été écrit) :', bilan)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
