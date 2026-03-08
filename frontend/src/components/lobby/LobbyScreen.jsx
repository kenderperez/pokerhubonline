import { useEffect }     from 'react'
import { socket }        from '../../socket/socket.js'
import { useGameStore }  from '../../store/gameStore.js'
import CreateRoom        from './CreateRoom.jsx'
import PublicRooms       from './PublicRooms.jsx'

export default function LobbyScreen() {
  const { playerName, setPlayerName } = useGameStore()

  useEffect(() => {
    socket.emit('getPublicRooms')
  }, [])

  const handleLogout = () => {
    setPlayerName('')
  }

  return (
    <div>
      {/* Header del lobby */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a2940]">
        <div>
          <div className="text-white font-bold text-sm tracking-wide">👋 {playerName}</div>
          <div className="text-[#3a5878] text-[10px] tracking-widest uppercase">Listo para jugar</div>
        </div>
        <button
          onClick={handleLogout}
          className="text-[#2a4060] text-[10px] tracking-widest uppercase hover:text-red-400 transition-colors">
          Cerrar sesión
        </button>
      </div>

      <div className="p-6 space-y-4">
        <CreateRoom />
        <PublicRooms />
      </div>
    </div>
  )
}