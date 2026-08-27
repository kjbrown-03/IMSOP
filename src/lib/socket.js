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
  })

  return socket
}
