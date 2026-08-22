const PDFDocument = require('pdfkit')

function buildRapportPdf({ dossier, rapport, patientName, specialisteName }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(20).fillColor('#003f87').text('IMSOP - Rapport de deuxième avis médical', { align: 'center' })
    doc.moveDown()
    doc.fontSize(10).fillColor('#424752').text(`Dossier : ${dossier.reference}`)
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`)
    doc.moveDown()

    doc.fontSize(12).fillColor('#191c21').text(`Patient : ${patientName}`)
    doc.text(`Spécialiste : ${specialisteName}`)
    doc.moveDown()

    doc.fontSize(14).fillColor('#003f87').text('Synthèse du cas')
    doc.fontSize(11).fillColor('#191c21').text(rapport.synthese || '-')
    doc.moveDown()

    doc.fontSize(14).fillColor('#003f87').text('Diagnostic & Analyse')
    doc.fontSize(11).fillColor('#191c21').text(rapport.diagnostic || '-')
    doc.moveDown()

    doc.fontSize(14).fillColor('#003f87').text('Options thérapeutiques')
    doc.fontSize(11).fillColor('#191c21').text(rapport.optionsTherapeutiques || '-')
    doc.moveDown(2)

    doc.fontSize(9).fillColor('#727784').text(
      "Ce document constitue un deuxième avis médical et ne remplace pas la relation entre le patient et son médecin traitant.",
      { align: 'center' },
    )

    doc.end()
  })
}

module.exports = { buildRapportPdf }
