import { io } from 'socket.io-client'

// Apunta directo al backend — evita problemas con el proxy de Vite en Windows
export const socket = io('http://localhost:3000', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
})