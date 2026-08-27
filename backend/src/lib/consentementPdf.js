const PDFDocument = require('pdfkit')

/**
 * Formulaire de consentement à la transmission des données par la plateforme.
 *
 * Portée volontairement étroite : ce document ne couvre QUE le point du §4.2 du
 * cahier des charges — le patient accepte que son dossier circule par IMSOP vers
 * un spécialiste situé dans un autre pays. Les consentements accessoires
 * (téléconsultation, recherche anonymisée) font l'objet de cases distinctes dans
 * l'application et n'ont pas leur place ici : mélanger tout dans un seul document
 * signé rendrait impossible de refuser l'un sans refuser l'autre, ce que le §30
 * interdit explicitement.
 *
 * Les champs non renseignés deviennent des pointillés : le même générateur sert
 * donc à produire un formulaire vierge à imprimer et un document pré-rempli pour
 * un dossier donné.
 */

const NOIR = '#000000'
const ENCRE = '#191c21'
const GRIS = '#5b6068'
const LIGNE = '#d4d8de'

const VERSION = '1.0'

function pointilles(valeur, longueur = 46) {
  if (valeur) return String(valeur)
  return '.'.repeat(longueur)
}

function titreSection(doc, texte) {
  doc.moveDown(0.8)
  doc.fontSize(12).fillColor(NOIR).font('Helvetica-Bold').text(texte)
  doc.moveDown(0.3)
  doc.fontSize(10).fillColor(ENCRE).font('Helvetica')
}

function paragraphe(doc, texte, options = {}) {
  doc.fontSize(10).fillColor(ENCRE).font('Helvetica').text(texte, { align: 'justify', ...options })
  doc.moveDown(0.4)
}

const COLONNE_LIBELLE = 170

function ligneChamp(doc, libelle, valeur) {
  const x = doc.page.margins.left
  const y = doc.y
  const largeurValeur = doc.page.width - x - doc.page.margins.right - COLONNE_LIBELLE

  doc.fontSize(10).font('Helvetica-Bold').fillColor(GRIS)
    .text(`${libelle} :`, x, y, { width: COLONNE_LIBELLE - 8, lineBreak: false, ellipsis: true })

  doc.font('Helvetica').fillColor(ENCRE)
    .text(pointilles(valeur), x + COLONNE_LIBELLE, y, { width: largeurValeur, lineBreak: false, ellipsis: true })

  doc.x = x
  doc.moveDown(0.45)
}

/** Case à cocher dessinée : un caractère « ☐ » ne rend pas dans les polices de base. */
function caseACocher(doc, texte, cochee = false) {
  const y = doc.y
  const x = doc.page.margins.left
  doc.rect(x, y + 1.5, 9, 9).lineWidth(0.8).strokeColor(GRIS).stroke()
  if (cochee) {
    doc.moveTo(x + 2, y + 6).lineTo(x + 4, y + 8.5).lineTo(x + 7, y + 3.5)
      .lineWidth(1.2).strokeColor(NOIR).stroke()
  }
  doc.fontSize(10).fillColor(ENCRE).font('Helvetica')
    .text(texte, x + 16, y, {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 16,
      align: 'justify',
    })
  doc.moveDown(0.3)
}

function separateur(doc) {
  doc.moveDown(0.5)
  const x = doc.page.margins.left
  const largeur = doc.page.width - x - doc.page.margins.right
  doc.moveTo(x, doc.y).lineTo(x + largeur, doc.y).lineWidth(0.5).strokeColor(LIGNE).stroke()
  doc.moveDown(0.5)
}

function blocSignature(doc, titre, mentions = []) {
  doc.fontSize(10).font('Helvetica-Bold').fillColor(NOIR).text(titre)
  doc.moveDown(0.2)
  for (const m of mentions) {
    doc.fontSize(9).font('Helvetica').fillColor(GRIS).text(m, { align: 'justify' })
  }
  doc.moveDown(0.5)
  doc.fontSize(9).fillColor(GRIS).font('Helvetica')
  doc.text(`Nom et prénom : ${'.'.repeat(40)}`)
  doc.moveDown(0.3)
  doc.text(`Fait à ${'.'.repeat(22)}   le ${'.'.repeat(6)} / ${'.'.repeat(6)} / ${'.'.repeat(8)}`)
  doc.moveDown(0.3)
  doc.text('Signature :')
  doc.moveDown(2)
}

function buildConsentementPdf({ patient = {}, dossier = {}, medecinLocal = null } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // ---------- En-tête ----------
    doc.fontSize(16).fillColor(NOIR).font('Helvetica-Bold')
      .text('CONSENTEMENT À LA TRANSMISSION DES DONNÉES DE SANTÉ', { align: 'center' })
    doc.moveDown(0.2)
    doc.fontSize(10).fillColor(GRIS).font('Helvetica')
      .text('IMSOP — Plateforme internationale de deuxième avis médical', { align: 'center' })
    doc.fontSize(8).fillColor(GRIS)
      .text(`Formulaire version ${VERSION} — généré le ${new Date().toLocaleString('fr-FR')}`, { align: 'center' })
    doc.moveDown(1)

    separateur(doc)

    // ---------- Identification ----------
    titreSection(doc, '1. Identification')
    ligneChamp(doc, 'Patient', patient.fullName)
    ligneChamp(doc, 'Date de naissance', patient.dob)
    ligneChamp(doc, 'Référence patient', patient.patientRef)
    ligneChamp(doc, 'Référence du dossier', dossier.reference)
    ligneChamp(doc, 'Spécialité demandée', dossier.specialiteRequise)
    if (medecinLocal) {
      ligneChamp(doc, 'Médecin traitant', medecinLocal.fullName)
      ligneChamp(doc, "Numéro d'inscription à l'ordre", medecinLocal.numeroOrdre)
    }

    separateur(doc)

    // ---------- Objet ----------
    titreSection(doc, '2. Objet du présent consentement')
    paragraphe(doc,
      "Vous demandez un deuxième avis médical. Pour l'obtenir, votre dossier médical doit être " +
      "transmis à un médecin spécialiste exerçant dans un autre pays. Cette transmission s'effectue " +
      "par l'intermédiaire de la plateforme IMSOP, qui sert de canal sécurisé entre vous, votre " +
      "médecin traitant, la coordination médicale et ce spécialiste.")
    paragraphe(doc,
      "Le présent document ne porte que sur ce point : votre accord pour que vos données de santé " +
      "circulent par la plateforme et soient communiquées aux personnes énumérées à l'article 4.")

    // ---------- Données transmises ----------
    titreSection(doc, '3. Données qui transiteront par la plateforme')
    paragraphe(doc, "Sont concernés les éléments suivants, dans la mesure où ils existent :")
    const donnees = [
      "votre identité et vos informations administratives ;",
      "vos antécédents médicaux et chirurgicaux, vos allergies et vos traitements en cours ;",
      "votre diagnostic initial, vos symptômes et la question posée au spécialiste ;",
      "vos examens : analyses biologiques, imagerie (radiographie, scanner, IRM, échographie, ECG), anatomopathologie, comptes rendus ;",
      "les documents que vous ou votre médecin traitant déposez sur la plateforme ;",
      "les échanges de la messagerie sécurisée rattachés à ce dossier.",
    ]
    for (const d of donnees) {
      doc.fontSize(10).fillColor(ENCRE).font('Helvetica').text(`•  ${d}`, { indent: 8, align: 'justify' })
    }
    doc.moveDown(0.4)

    // ---------- Destinataires ----------
    titreSection(doc, '4. Destinataires')
    paragraphe(doc,
      "Le spécialiste international auquel votre dossier est affecté, et lui seul parmi les " +
      "spécialistes, y a accès. La coordination médicale IMSOP y accède pour vérifier que le dossier " +
      "est complet et en assurer le suivi. Votre médecin traitant n'y accède que si vous l'avez " +
      "expressément désigné. L'administration technique de la plateforme n'a, elle, aucun accès au " +
      "contenu médical.")
    paragraphe(doc,
      "Toute consultation, transmission ou téléchargement de votre dossier est enregistré dans un " +
      "journal d'audit conservé par la plateforme.")

    // ---------- Transfert international ----------
    titreSection(doc, '5. Transfert hors du pays de résidence')
    paragraphe(doc,
      "Le spécialiste exerçant hors du Cameroun, notamment en Europe, vos données franchiront une " +
      "frontière. Ce transfert est soumis au droit camerounais ainsi qu'à celui du pays de destination.")
    doc.fontSize(9).fillColor('#8a5a00').font('Helvetica-Oblique')
      .text("[À compléter par le conseil juridique : base légale du transfert, garanties encadrant " +
            "celui-ci, autorité de contrôle compétente et voies de recours.]", { align: 'justify' })
    doc.moveDown(0.4)

    // ---------- Limites ----------
    titreSection(doc, '6. Ce que le deuxième avis ne remplace pas')
    paragraphe(doc,
      "Le spécialiste international n'intervient pas à la place de votre médecin traitant : il " +
      "l'accompagne. Votre médecin traitant reste l'acteur central de votre parcours de soins et " +
      "demeure seul responsable des décisions thérapeutiques vous concernant.")
    paragraphe(doc,
      "La plateforme ne remplace en aucun cas les services d'urgence. En cas de situation urgente, " +
      "contactez immédiatement les services médicaux d'urgence locaux.")
    paragraphe(doc,
      "L'avis est rendu sur la seule base des documents transmis, sans examen physique. Sa qualité " +
      "dépend directement de l'exactitude et de la complétude de ces documents.")

    // ---------- Retrait ----------
    titreSection(doc, '7. Retrait du consentement')
    paragraphe(doc,
      "Vous pouvez retirer votre consentement à tout moment, sans avoir à vous justifier, depuis " +
      "votre espace patient ou en écrivant à la coordination médicale. Le retrait prend effet " +
      "immédiatement et interrompt toute nouvelle transmission. Il ne remet pas en cause la " +
      "validité des opérations réalisées avant sa date.")

    // ---------- Déclaration ----------
    doc.addPage()
    titreSection(doc, '8. Déclaration')
    paragraphe(doc,
      "Je déclare avoir lu et compris le présent document, en particulier l'article 6 relatif aux " +
      "limites du deuxième avis. J'ai pu poser mes questions et obtenir des réponses.")
    doc.moveDown(0.3)

    caseACocher(doc,
      "J'ACCEPTE que mes données de santé soient transmises par la plateforme IMSOP aux " +
      "destinataires énumérés à l'article 4, y compris hors de mon pays de résidence.")
    doc.moveDown(0.2)
    caseACocher(doc,
      "JE REFUSE. Je comprends que ma demande de deuxième avis ne pourra alors pas être traitée.")

    doc.moveDown(1)
    separateur(doc)

    // ---------- Signatures ----------
    titreSection(doc, '9. Signatures')

    blocSignature(doc, 'Le patient')

    blocSignature(doc, 'Le représentant légal — si le patient est mineur ou protégé', [
      "À compléter uniquement lorsque le patient n'est pas en mesure de consentir personnellement.",
      "Qualité :  parent  /  tuteur  /  curateur  /  autre : ...........................",
    ])

    blocSignature(doc, 'Le médecin traitant — attestation', [
      "Cette attestation ne remplace pas le consentement du patient. Le praticien atteste avoir " +
      "informé le patient de l'objet et des limites de la demande, avoir recueilli son accord au " +
      "préalable, et que les documents transmis sont exacts et complets à sa connaissance.",
      "Numéro d'inscription à l'ordre : ...........................................",
    ])

    // ---------- Pied de page ----------
    doc.moveDown(0.5)
    separateur(doc)
    doc.fontSize(8).fillColor(GRIS).font('Helvetica')
      .text(
        `Formulaire IMSOP version ${VERSION}. Lorsque le consentement est recueilli en ligne, la ` +
        "plateforme enregistre le type de consentement, l'acceptation ou le refus, la version du " +
        "formulaire, l'horodatage, l'adresse IP d'origine et, le cas échéant, la date de retrait. " +
        "Un retrait n'efface jamais l'enregistrement initial : il est inscrit comme un nouvel " +
        "événement, afin que l'historique reste vérifiable.",
        { align: 'justify' },
      )

    doc.end()
  })
}

module.exports = { buildConsentementPdf, VERSION_CONSENTEMENT: VERSION }
