/* eslint-env serviceworker */
/**
 * Service worker d'IMSOP.
 *
 * Son rôle est volontairement étroit : rendre l'application installable et
 * ouvrable hors ligne sur sa coquille, rien de plus.
 *
 * CE QU'IL NE FAIT PAS, ET POURQUOI
 *
 * Il ne met en cache AUCUNE réponse de /api. Un cache de service worker survit
 * à la déconnexion, n'est pas vidé quand on quitte la session, et reste lisible
 * par tout ce qui tourne sur l'origine. Y déposer un dossier médical, un
 * rapport ou une pièce d'identité reviendrait à laisser des données de santé
 * sur l'appareil, hors de tout contrôle d'accès — sur un téléphone partagé ou
 * perdu, c'est une fuite. Les requêtes d'API passent donc toujours par le
 * réseau, et échouent franchement si le réseau manque.
 *
 * Il ne met pas non plus en cache les documents servis par l'application
 * (photos de candidature, CV, PDF de rapport) : même raisonnement.
 */

// __EMPREINTE_BUILD__ est remplacé à la construction par le plugin
// `versionnerServiceWorker` de vite.config.js, à partir du hachage d'index.html.
// C'est ce qui fait que le fichier CHANGE d'un déploiement à l'autre : sans
// différence d'octets, le navigateur ne réinstalle rien et garde son vieux cache
// jusqu'à la fin des temps. Ne pas figer cette valeur à la main.
const VERSION = 'imsop-__EMPREINTE_BUILD__'
const COQUILLE = `${VERSION}-coquille`

// Le strict minimum pour afficher quelque chose sans réseau. Les fichiers
// d'assets portent une empreinte dans leur nom et sont mis en cache à l'usage :
// les lister ici obligerait à régénérer ce fichier à chaque construction.
const PRECHARGE = ['/', '/index.html', '/manifest.webmanifest', '/icons/icone-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(COQUILLE)
      // `cache: 'reload'` force chaque requête à passer par le réseau au lieu du
      // cache HTTP du navigateur. Sans ça, une installation neuve pourrait
      // recopier dans son cache la version périmée d'index.html que le cache
      // HTTP détient encore — et reconduire le bug qu'on cherche à corriger.
      .then((cache) => cache.addAll(PRECHARGE.map((url) => new Request(url, { cache: 'reload' }))))
      // Une ressource absente ne doit pas empêcher l'installation : mieux vaut
      // un service worker partiel qu'aucun.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => !c.startsWith(VERSION)).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Hors de notre origine : on ne s'en mêle pas.
  if (url.origin !== self.location.origin) return

  // Données de santé et sessions : jamais de cache, jamais d'interception.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return

  // Navigation : on tente le réseau, et on retombe sur la coquille si l'appareil
  // est hors ligne. L'application est une SPA, index.html suffit à l'amorcer.
  //
  // `cache: 'no-store'` court-circuite le cache HTTP du navigateur dans les deux
  // sens. index.html ne porte pas d'empreinte dans son nom — c'est lui qui
  // désigne le bundle à charger — donc le resservir depuis le cache fait démarrer
  // une version périmée alors que les fichiers neufs sont en ligne. nginx pose
  // déjà `no-store` sur ce fichier ; on le redit ici parce qu'un service worker
  // survit aux changements de configuration du serveur.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request.url, { cache: 'no-store', credentials: 'same-origin' }).catch(() =>
        caches.match('/index.html').then((r) => r || Response.error()),
      ),
    )
    return
  }

  // Fichiers statiques : le cache d'abord, puisqu'ils portent une empreinte
  // dans leur nom et ne changent jamais sous un même nom.
  event.respondWith(
    caches.match(request).then((enCache) => {
      if (enCache) return enCache
      return fetch(request).then((reponse) => {
        // Une réponse partielle ou opaque n'a rien à faire en cache.
        if (reponse.ok && reponse.type === 'basic') {
          const copie = reponse.clone()
          caches.open(COQUILLE).then((cache) => cache.put(request, copie))
        }
        return reponse
      })
    }),
  )
})
