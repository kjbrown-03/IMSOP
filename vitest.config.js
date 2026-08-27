import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// Configuration séparée de vite.config.js à dessein : ce dernier contient le
// durcissement du serveur de développement (fs.deny, CORS, proxy), qui n'a
// rien à faire dans un contexte de test et qu'on ne veut pas risquer de
// modifier en touchant à la configuration des tests.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // jsdom fournit localStorage, sessionStorage et window.location, dont
    // dépend toute la logique de session cloisonnée par rôle.
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
  },
})
