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
})
