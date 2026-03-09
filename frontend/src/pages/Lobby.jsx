import { useGameStore }  from '../store/gameStore.js'
import AuthScreen         from '../components/lobby/AuthScreen.jsx'
import LobbyScreen        from '../components/lobby/LobbyScreen.jsx'

export default function Lobby() {
  const playerName = useGameStore(s => s.playerName)
  const loading    = useGameStore(s => s.loading)

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center relative overflow-hidden">

      {/* Fondo — orbes */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-15%] left-[-10%] w-150 h-150 rounded-full"
             style={{ background: 'radial-gradient(circle, #22d3a012 0%, transparent 65%)' }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-125 h-125 rounded-full"
             style={{ background: 'radial-gradient(circle, #ef444412 0%, transparent 65%)' }} />
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-[#080c14]/90 flex flex-col items-center justify-center z-50">
          <div className="w-10 h-10 border-2 border-[#22d3a0] border-t-transparent rounded-full animate-spin mb-4" />
          <span className="text-[#22d3a0] text-sm tracking-widest">BUSCANDO MESA...</span>
        </div>
      )}

      <div className="w-115 relative z-10 px-4">

        {/* Logo imagen */}
        <div className="flex justify-center mb-8">
          <img
            src="/assets/pokerhubSSSSS.png"
            alt="PokerHub"
            className="h-24 object-contain drop-shadow-2xl"
          />
        </div>

        {/* Panel */}
        <div className="bg-[#0d1626] border border-[#1a2940] rounded-2xl shadow-2xl overflow-hidden">
          {!playerName ? <AuthScreen /> : <LobbyScreen />}
        </div>

      </div>
    </div>
  )
}