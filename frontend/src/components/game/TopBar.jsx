import { useGameStore }  from '../../store/gameStore.js'
import { socket }         from '../../socket/socket.js'

export default function TopBar() {
  const { roomId, myBalance, BB_VALUE, setPage } = useGameStore()

  const toBB = (val) => (val / BB_VALUE).toFixed(1) + ' BB'

  const handleExit = () => {
    socket.disconnect()
    setPage('lobby')
  }

  return (
    <div className="flex items-center justify-between px-5 py-2
                    bg-[#0a1020] border-b border-[#1a2940] z-40">

      {/* Salir */}
      <button
        onClick={handleExit}
        className="text-[#3a5878] text-xs hover:text-white transition-colors tracking-widest"
      >
        ← SALIR
      </button>

      <img
        src="/assets/adsdsa.png"
        alt="PokerHub"
        className="h-10 object-contain"
      />

      {/* Balance con pokerhubchip.png */}
      <div className="flex items-center gap-3">
        {roomId && (
          <span className="text-[#3a5878] text-xs tracking-wider">
            SALA: <span className="text-white">{roomId}</span>
          </span>
        )}
        <div className="flex items-center gap-2 bg-[#111d2e] border border-[#1a2940] rounded-full px-3 py-1">
          <img
            src="/assets/pokerhubchip.svg"
            alt="chip"
            className="w-5 h-5 object-contain"
            onError={e => {
              // fallback a png si el svg no existe
              e.target.src = '/assets/pokerhubchip.png'
            }}
          />
          <span className="text-white font-bold text-sm">${myBalance.toLocaleString()}</span>
          <span className="text-[#3a5878] text-[10px]">{toBB(myBalance)}</span>
        </div>
      </div>

    </div>
  )
}