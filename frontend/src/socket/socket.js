import { io } from 'socket.io-client'

// En dev, Vite proxy reenvía /socket.io → localhost:3000
export const socket = io({ autoConnect: false })