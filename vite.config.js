import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Machine du poste de travail ou du réseau local privé — les seules qui ont une
 * raison légitime d'interroger un serveur de développement. Écrit sans expression
 * régulière : une adresse se compare octet par octet, c'est plus lisible et on ne
 * risque pas un point non échappé qui accepterait « 192x168 ».
 */
function estHoteLocal(hote) {
  if (hote === 'localhost' || hote === '127.0.0.1' || hote === '[::1]' || hote === '::1') return true
  const octets = hote.split('.').map(Number)
  if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return false
  const [a, b] = octets
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // cobe (le globe de la page 404) embarque sa carte du monde sous forme de
  // données binaires. Le pré-bundling des dépendances par esbuild l'abîme : en
  // développement le globe s'affiche lisse et figé, sans continents, alors que
  // le build de production est correct. On laisse donc Vite servir cobe tel quel.
  optimizeDeps: {
    exclude: ['cobe'],
  },
  server: {
    port: 5173,

    // Durcissement du serveur de DÉVELOPPEMENT.
    //
    // Il n'est pas censé être joignable par autre chose que le navigateur de la
    // machine — sauf qu'on l'expose sur le Wi-Fi (`npm run dev -- --host`) pour
    // tester sur téléphone. À ce moment-là, toute machine du réseau local peut
    // l'interroger, et plusieurs failles connues de Vite 5 (dont un contournement
    // de `fs.deny` propre à Windows, GHSA-fx2h-pf6j-xcff) visent exactement ça.
    // Le correctif amont impose Vite 8 ; en attendant, on réduit la surface.

    // Démonstration à distance : le serveur de dev est exposé ponctuellement par
    // un tunnel ngrok, qui présente un `Host` en .ngrok-free.dev / .ngrok-free.app.
    // Vite bloque par défaut tout hôte inconnu (protection contre le DNS
    // rebinding), d'où cette liste. Le préfixe « . » couvre le sous-domaine
    // aléatoire, qui change à chaque redémarrage de ngrok.
    //
    // Ça n'ouvre rien de plus que le tunnel lui-même : sans l'URL ngrok en cours,
    // la machine reste injoignable. Le verrou CORS ci-dessous, lui, ne bouge pas.
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],

    // Aucun fichier hors du frontend n'a de raison d'être servi. `backend/`
    // contient .env (mot de passe SMTP, clés CinetPay) et les sauvegardes.
    fs: {
      strict: true,
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key,p12,pfx}',
        '**/backend/**',
        '**/.git/**',
        '**/node_modules/.cache/**',
      ],
    },

    // Par défaut Vite renvoie un Access-Control-Allow-Origin permissif : n'importe
    // quel site web ouvert dans le même navigateur peut alors interroger le serveur
    // de dev et LIRE la réponse (GHSA-67mh-4wv8-2f99). L'application appelle son
    // API en même origine, donc restreindre ne casse rien.
    cors: {
      origin(origine, repondre) {
        // Pas d'en-tête Origin : requête en même origine, ou un outil local
        // (curl). Rien à autoriser au sens CORS, on laisse passer.
        if (!origine) return repondre(null, true)
        let hote
        try {
          hote = new URL(origine).hostname
        } catch {
          return repondre(null, false)
        }
        repondre(null, estHoteLocal(hote))
      },
    },

    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },

  // `vite preview` sert le build de production (un seul bundle) au lieu des
  // centaines de modules du serveur de dev : c'est ce qu'il faut derrière un
  // tunnel, où chaque requête coûte un aller-retour. Cette section ne réutilise
  // rien de `server` — Vite les traite séparément —, d'où la répétition du proxy
  // et des hôtes autorisés.
  preview: {
    port: 4173,

    // Sans ça, le serveur n'écoute que sur ::1 (IPv6). ngrok, lui, résout
    // `localhost` en 127.0.0.1 et se connecte en IPv4 : la connexion partait
    // dans le vide, le tunnel renvoyait un 200 sans corps et le navigateur
    // affichait une page blanche. `host: true` écoute sur les deux piles.
    host: true,

    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
