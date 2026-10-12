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
      // Sans option `cache` : la même raison que pour la navigation plus bas —
      // tous les moteurs n'acceptent pas ce réglage dans un service worker, et
      // l'échec y est une exception, pas un simple repli. nginx sert déjà
      // index.html en `no-store`, donc ce préchargement obtient une copie
      // fraîche sans avoir à le forcer ici.
      .then((cache) => cache.addAll(PRECHARGE))
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
  // TOUT le gestionnaire est sous filet.
  //
  // `respondWith` doit etre appele de maniere synchrone : si quoi que ce soit
  // leve avant, le navigateur fait ce qu'il aurait fait sans service worker,
  // c'est-a-dire aller au reseau. C'est exactement le comportement qu'on veut en
  // cas d'imprevu. Sans ce filet, une exception ici rend le site ENTIEREMENT
  // inutilisable — page blanche a chaque ouverture, y compris pour l'application
  // installee, et sans moyen simple de s'en sortir pour l'utilisateur. C'est
  // arrive avec une option `cache` non supportee par WebKit.
  //
  // Regle a retenir : un service worker ne doit jamais rendre le site pire que
  // son absence.
  try {
    traiterRequete(event)
  } catch (err) {
    console.error('[sw] requete laissee au reseau :', err && err.message)
  }
})

function traiterRequete(event) {
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
  // La requête est passée TELLE QUELLE, sans option `cache`. Une version
  // précédente forçait `cache: 'no-store'` pour garantir un index.html frais ;
  // là où ce mode n'est pas accepté dans un service worker — WebKit, donc tout
  // iPhone — la construction de la requête lève une exception SYNCHRONE, que le
  // `.catch()` d'une promesse n'attrape pas. L'exception traversait le
  // gestionnaire, le navigateur traitait la navigation comme une erreur réseau,
  // et l'application s'ouvrait sur une page blanche.
  //
  // La fraîcheur n'a pas besoin de ce forçage : nginx sert index.html en
  // `no-store` (deploy/nginx/imsop.conf), ce qui est l'endroit juste pour le
  // dire — le serveur décide de la durée de vie de ce qu'il sert.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          // Une copie fraîche remplace la coquille hors ligne à chaque passage :
          // sans ça, le repli servirait l'index.html du jour de l'installation,
          // qui désigne un bundle que le serveur ne sert plus.
          const copie = reponse.clone()
          caches
            .open(COQUILLE)
            .then((cache) => cache.put('/index.html', copie))
            .catch(() => undefined)
          return reponse
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
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
}
