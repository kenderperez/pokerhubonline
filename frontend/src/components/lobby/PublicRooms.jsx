import { useGameStore }  from '../../store/gameStore.js'
import { socket }         from '../../socket/socket.js'

export default function PublicRooms() {
  const { publicRooms, playerName, userAddress, setLoading } = useGameStore()

  const join = (roomId) => {
    setLoading(true)
    socket.emit('joinRoom', { roomId, name: playerName, address: userAddress || '' })
  }

  return (
    <div className="border-t border-[#1a2940] pt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[#d4af37] text-xs font-bold tracking-widest uppercase">🌐 Salas Públicas</span>
        <span className="text-[#2a4060] text-[10px]">En vivo</span>
      </div>

      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
        {publicRooms.length === 0 ? (
          <div className="text-[#2a4060] text-xs text-center py-4">
            No hay salas públicas activas.
          </div>
        ) : (
          publicRooms.map(room => (
            <div key={room.id}
              className="flex items-center justify-between bg-[#080c14] border border-[#1a2940]
                         rounded-lg px-3 py-2 hover:border-[#22d3a040] transition-colors">
              <div>
                <span className="text-white text-xs font-bold">Sala {room.id}</span>
                <span className="text-[#3a5878] text-[10px] ml-2">{room.players}/6 jugadores</span>
              </div>
              <button
                onClick={() => join(room.id)}
                className="bg-[#22d3a015] border border-[#22d3a040] text-[#22d3a0]
                           text-[10px] font-bold px-3 py-1 rounded tracking-wider
                           hover:bg-[#22d3a030] transition-all"
              >
                UNIRSE
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
