import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './i18n/config'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

/**
 * Enregistrement du service worker (voir public/sw.js).
 *
 * Uniquement en production : en développement, un service worker sert des
 * fichiers mis en cache par-dessus le rechargement à chaud de Vite, et on passe
 * son temps à se demander pourquoi une modification ne s'affiche pas.
 *
 * Après le chargement de la page, jamais pendant : l'enregistrement se
 * disputerait la bande passante avec les fichiers dont l'écran a besoin pour
 * s'afficher.
 */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      // Un enregistrement refusé (navigation privée, réglage du navigateur) ne
      // doit rien casser : l'application marche sans, elle n'est simplement
      // pas installable.
      console.warn('Service worker non enregistré :', err.message)
    })
  })
}
