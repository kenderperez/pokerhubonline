import { useGameStore }   from '../store/gameStore.js'
import TopBar              from '../components/game/TopBar.jsx'
import PokerTable          from '../components/game/PokerTable.jsx'
import ActionPanel         from '../components/game/ActionPanel.jsx'

export default function Game() {
  const { roomId, gameState } = useGameStore()

  return (
    <div className="h-screen flex flex-col bg-[#080c14] overflow-hidden">

      <TopBar />

      {/* Mesa centrada */}
      <div className="flex-1 flex items-center justify-center relative">
        <PokerTable />
      </div>

      {/* Panel de acciones */}
      <ActionPanel />

    </div>
  )
}