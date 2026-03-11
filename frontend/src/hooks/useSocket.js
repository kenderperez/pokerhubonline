import { useEffect } from 'react'
import { socket }        from '../socket/socket.js'
import { useGameStore }  from '../store/gameStore.js'

export function useSocket() {
  const {
    setSocketId, setGameState, setTurn, clearTurn,
    setPublicRooms, setRoom, setPage, setLoading, addLog,
  } = useGameStore()

  useEffect(() => {
    console.log('[Socket] Iniciando conexión...')
    socket.connect()

    socket.on('connect', () => {
      console.log('[Socket] ✅ Conectado! ID:', socket.id)
      setSocketId(socket.id)
    })

    socket.on('connect_error', (err) => {
      console.error('[Socket] ❌ Error de conexión:', err.message)
      setLoading(false)
    })

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Desconectado:', reason)
    })

    socket.on('gameState', (data) => {
      console.log('[Socket] gameState recibido:', data)
      setGameState(data)
      const sid = socket.id
      const isMyTurn = data.seats?.[data.currentTurnIndex]?.id === sid
      if (!isMyTurn) clearTurn()
    })

    socket.on('yourTurn', (data) => {
      console.log('[Socket] yourTurn:', data)
      setTurn(data)
    })

    socket.on('roomJoined', (data) => {
      const { roomId, isHost, type } = data
        setRoom({ roomId, type, isHost })
        setTimeout(() => {
          setLoading(false)
          setPage('game')
        }, 2400)                
})

    socket.on('matchmakingResult', (roomId) => {
      const { playerName } = useGameStore.getState()
      setTimeout(() => {
        socket.emit('joinRoom', { roomId, name: playerName, address: playerName })
      }, 1500)  
})

    socket.on('publicRooms', (rooms) => {
      setPublicRooms(rooms || [])
    })

    socket.on('serverLog', (data) => {
      console.log('[Socket] serverLog:', data.message)
      addLog(data.message)
      if (data.message?.includes('No hay salas')) {
        setLoading(false)
      }
    })

    socket.on('error', (msg) => {
      console.error('[Socket] Error del servidor:', msg)
      setLoading(false)
    })

    socket.on('timerStart', ({ seatIndex, duration }) => {
      const bar = document.getElementById(`timer-bar-${seatIndex}`)
      if (!bar) return
      bar.style.transition = 'none'
      bar.style.width = '100%'
      bar.getBoundingClientRect()
      bar.style.transition = `width ${duration / 1000}s linear`
      bar.style.width = '0%'
    })

    return () => {
      socket.off('connect')
      socket.off('connect_error')
      socket.off('disconnect')
      socket.off('gameState')
      socket.off('yourTurn')
      socket.off('roomJoined')
      socket.off('matchmakingResult')
      socket.off('publicRooms')
      socket.off('serverLog')
      socket.off('error')
      socket.off('timerStart')
    }
  }, [])
}