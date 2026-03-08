import { useGameStore }   from '../store/gameStore.js'
import { socket }          from '../socket/socket.js'
import TopBar              from '../components/game/TopBar.jsx'
import PokerTable          from '../components/game/PokerTable.jsx'
import ActionPanel         from '../components/game/ActionPanel.jsx'

export default function Game() {
  const { roomId, isHost, gameState } = useGameStore()
  const isPlaying = gameState?.gameState === 'PLAYING'

  return (
    <div className="h-screen flex flex-col bg-[#080c14] overflow-hidden">

      <TopBar />

      {/* Mesa centrada */}
      <div className="flex-1 flex items-center justify-center relative">
        <PokerTable />
      </div>

      {/* Botón iniciar (solo host, solo en WAITING) */}
      {isHost && !isPlaying && (
        <div className="absolute top-16 right-4 z-50">
          <button
            onClick={() => socket.emit('startGameRequest')}
            className="bg-gradient from-green-600 to-green-500 text-white font-bold
                       px-5 py-2 rounded-lg text-sm tracking-wider hover:brightness-110
                       transition-all shadow-lg shadow-green-900/40"
          >
            ▶ INICIAR PARTIDA
          </button>
        </div>
      )}

      {/* Panel de acciones */}
      <ActionPanel />

    </div>
  )
}
