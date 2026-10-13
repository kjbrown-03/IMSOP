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
      // `addAll` rangerait les réponses telles qu'elles arrivent, donc avec
      // l'en-tête `Content-Encoding: gzip` que nginx y pose — alors que le corps
      // stocké, lui, est déjà décompressé. Au rechargement, le navigateur
      // décompresserait une seconde fois et la coquille serait illisible. On
      // passe donc par mettreEnCache, qui retire cet en-tête.
      //
      // Pas d'option `cache` sur les requêtes : tous les moteurs ne l'acceptent
      // pas dans un service worker, et l'échec y est une exception plutôt qu'un
      // repli. nginx sert déjà index.html en `no-store`, la copie est fraîche.
      .then(() =>
        Promise.all(
          PRECHARGE.map((url) =>
            fetch(url)
              .then((reponse) => (reponse.ok ? mettreEnCache(url, reponse) : undefined))
              .catch(() => undefined),
          ),
        ),
      )
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

// --- Notifications poussees --------------------------------------------------
//
// Ces deux ecouteurs tournent meme quand l'application est fermee : c'est tout
// l'interet du service worker. Sur iPhone, ils ne sont appeles que si
// l'application a ete ajoutee a l'ecran d'accueil — dans un onglet Safari,
// aucune notification n'est delivree. C'est une regle d'Apple.

self.addEventListener('push', (event) => {
  // Une notification sans donnees lisibles reste affichee : mieux vaut une
  // mention generique qu'un silence, car le navigateur peut penaliser un
  // service worker qui recoit un push sans rien montrer.
  let contenu = { titre: 'IMSOP', corps: 'Vous avez une nouvelle information.', url: '/' }
  try {
    if (event.data) contenu = { ...contenu, ...event.data.json() }
  } catch {
    // Charge illisible : on garde le texte generique.
  }

  event.waitUntil(
    self.registration.showNotification(contenu.titre, {
      body: contenu.corps,
      icon: '/icons/icone-192.png',
      badge: '/icons/icone-192.png',
      // `tag` fait qu'une nouvelle notification du meme type REMPLACE la
      // precedente au lieu de s'empiler : trois messages non lus donnent une
      // ligne, pas trois.
      tag: contenu.type || 'imsop',
      // Un appel doit insister ; le reste ne doit pas reveiller la nuit pour
      // une etape de dossier.
      renotify: Boolean(contenu.urgent),
      requireInteraction: Boolean(contenu.urgent),
      data: { url: contenu.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const cible = event.notification.data?.url || '/'

  // Si l'application est deja ouverte quelque part, on y navigue au lieu d'en
  // ouvrir une seconde fenetre — sinon le patient se retrouve avec plusieurs
  // copies de l'application empilees.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((fenetres) => {
      for (const f of fenetres) {
        if ('focus' in f) {
          f.navigate?.(cible)
          return f.focus()
        }
      }
      return clients.openWindow(cible)
    }),
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
          // Par mettreEnCache, qui retire l'en-tête de compression : le corps
          // range est deja decompresse.
          mettreEnCache('/index.html', reponse.clone())
          return reponse
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    )
    return
  }

  // Fichiers construits (/assets/…) : ON NE S'EN MELE PAS.
  //
  // Ils portent une empreinte de leur contenu dans leur nom et nginx les sert
  // en `immutable` pour un an : le cache HTTP du navigateur fait deja ce travail,
  // mieux et sans nous.
  //
  // Les mettre AUSSI dans le cache du service worker avait un cout qu'on a paye :
  // depuis que nginx compresse, les reponses arrivent avec
  // `Content-Encoding: gzip`. L'API Cache range alors le corps DEJA DECOMPRESSE
  // en conservant cet en-tete ; au rechargement, le navigateur tente de
  // decompresser ce qui l'est deja et le script devient illisible. L'application
  // restait bloquee sur son ecran de demarrage, indefiniment.
  //
  // On laisse donc passer. Hors ligne, la coquille s'affiche et les fichiers
  // viennent du cache HTTP, qui les detient pour un an.
  if (url.pathname.startsWith('/assets/')) return

  // Le reste — icones, manifeste, images — passe par le cache, mais SANS son
  // en-tete de compression : on range un corps decompresse, il ne faut pas
  // affirmer le contraire.
  event.respondWith(
    caches.match(request).then((enCache) => {
      if (enCache) return enCache
      return fetch(request).then((reponse) => {
        // Une réponse partielle ou opaque n'a rien à faire en cache.
        if (reponse.ok && reponse.type === 'basic') {
          mettreEnCache(request, reponse.clone())
        }
        return reponse
      })
    }),
  )
}

// Range une reponse en retirant les en-tetes qui decrivent son encodage de
// transport. Le corps stocke par l'API Cache est deja decode : garder
// `Content-Encoding` ferait decompresser deux fois, et `Content-Length` ne
// correspondrait plus a rien.
function mettreEnCache(request, reponse) {
  return reponse
    .blob()
    .then((corps) => {
      const entetes = new Headers(reponse.headers)
      entetes.delete('content-encoding')
      entetes.delete('content-length')
      // `Vary: Accept-Encoding` sert a distinguer les variantes compressees et
      // non compressees cote serveur. Ce qu'on range ici n'est plus une variante
      // de transport : le garder ferait seulement rater des correspondances
      // selon les en-tetes de la requete suivante.
      entetes.delete('vary')
      return caches.open(COQUILLE).then((cache) =>
        cache.put(request, new Response(corps, {
          status: reponse.status,
          statusText: reponse.statusText,
          headers: entetes,
        })),
      )
    })
    .catch(() => undefined)
}
