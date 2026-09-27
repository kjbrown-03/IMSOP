const s3 = require('./s3')

/**
 * Sert un objet du stockage directement dans la réponse HTTP.
 *
 * Remplace les URL signées, qui ne pouvaient pas fonctionner en production :
 * elles sont construites à partir de `S3_ENDPOINT`, lequel vaut
 * `http://garage:3900` — un nom résolu à l'intérieur du réseau Docker et nulle
 * part ailleurs. Le navigateur du patient ou du coordinateur tombait sur un
 * `DNS_PROBE_FINISHED_NXDOMAIN`.
 *
 * L'exposer publiquement aurait été l'autre issue, mais elle est moins bonne :
 * une URL signée vaut laissez-passer pour quiconque la détient, et elle survit
 * à la révocation d'un accès jusqu'à son expiration. Ici, chaque octet servi
 * passe par l'authentification et les contrôles de rôle du point d'entrée
 * appelant — et le stockage reste invisible depuis Internet.
 *
 * L'appelant a déjà vérifié les droits : cette fonction ne fait que servir.
 */
async function servirObjet(res, cle, { filename, contentType, inline = true } = {}) {
  let objet
  try {
    objet = await s3.getObjectStream(cle)
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      res.status(404).json({ message: 'Fichier introuvable dans le stockage' })
      return
    }
    throw err
  }

  res.setHeader('Content-Type', contentType || objet.contentType || 'application/octet-stream')
  if (objet.contentLength) res.setHeader('Content-Length', objet.contentLength)
  if (filename) {
    // `inline` pour un PDF ou une image : la visionneuse du navigateur s'ouvre
    // au lieu d'un téléchargement muet. `attachment` pour le reste.
    res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${nomSur(filename)}"`)
  }
  // Privé : ces fichiers sont des données de santé, aucun cache partagé ne doit
  // les retenir. Court, parce qu'un onglet rouvert ne doit pas redemander.
  res.setHeader('Cache-Control', 'private, max-age=600')

  objet.body.on('error', (err) => {
    console.error(`flux interrompu pour ${cle}`, err)
    res.destroy(err)
  })
  objet.body.pipe(res)
}

/**
 * Nom de fichier sûr pour un en-tête HTTP : ASCII, sans guillemet ni accent.
 *
 * Un nom accentué demande un encodage RFC 5987 que tous les navigateurs ne
 * gèrent pas de la même façon, et un guillemet non échappé casse l'en-tête.
 */
function nomSur(nom) {
  const base = String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '')
  return base.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'fichier'
}

module.exports = { servirObjet, nomSur }
