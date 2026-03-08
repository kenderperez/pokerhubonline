import { useEffect } from 'react'
import { socket }        from '../socket/socket.js'
import { useGameStore }  from '../store/gameStore.js'

export function useSocket() {
  const {
    setSocketId, setGameState, setTurn, clearTurn,
    setPublicRooms, setRoom, setPage, setLoading, addLog,
  } = useGameStore()

  useEffect(() => {
    socket.connect()

    socket.on('connect', () => {
      setSocketId(socket.id)
    })

    socket.on('gameState', (data) => {
      setGameState(data)
      const sid = socket.id
      const isMyTurn = data.seats?.[data.currentTurnIndex]?.id === sid
      if (!isMyTurn) clearTurn()
    })

    socket.on('yourTurn', (data) => {
      setTurn(data)
    })

    socket.on('roomJoined', ({ roomId, isHost, type }) => {
      setRoom({ roomId, type, isHost })
      setLoading(false)
      setPage('game')
    })

    socket.on('matchmakingResult', (roomId) => {
      const { playerName } = useGameStore.getState()
      socket.emit('joinRoom', { roomId, name: playerName, address: '' })
    })

    socket.on('publicRooms', (rooms) => {
      setPublicRooms(rooms || [])
    })

    socket.on('serverLog', (data) => {
      addLog(data.message)
      if (data.message?.includes('No hay salas')) {
        setLoading(false)
      }
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

    // Solo limpia los listeners, NO desconecta el socket
    return () => {
      socket.off('connect')
      socket.off('gameState')
      socket.off('yourTurn')
      socket.off('roomJoined')
      socket.off('matchmakingResult')
      socket.off('publicRooms')
      socket.off('serverLog')
      socket.off('timerStart')
    }
  }, [])
}