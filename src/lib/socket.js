import { io } from 'socket.io-client'
import { sessionActive } from './session'

let socket = null

// Lazy singleton: the call signaling connection is only opened once a
// messaging page actually needs it, and reused across conversation switches.
export function getCallSocket() {
  if (socket) return socket

  socket = io('/', {
    path: '/socket.io',
    autoConnect: false,
    auth: (cb) => cb({ token: sessionActive()?.accessToken ?? null }),
    // Le repli en polling est une requête HTTP ordinaire : derrière un tunnel
    // ngrok gratuit, elle recevrait la page d'avertissement au lieu de la
    // réponse du serveur. Voir l'explication dans api.js.
    extraHeaders: { 'ngrok-skip-browser-warning': 'true' },
  })

  return socket
}
