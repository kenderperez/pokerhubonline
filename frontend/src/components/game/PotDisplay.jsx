import { useGameStore }  from '../../store/gameStore.js'

export default function PotDisplay() {
  const { gameState, BB_VALUE } = useGameStore()
  const pot = gameState?.pot || 0
  const toBB = (v) => (v / BB_VALUE).toFixed(1) + ' BB'

  if (!pot) return null

  return (
    <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20
                    flex items-center gap-2 bg-black/70 border border-[#d4af37]
                    rounded-full px-5 py-2 pointer-events-none">
      <div className="w-4 h-4 rounded-full shrink-0"
           style={{ background: 'conic-gradient(#d4af37, #b8860b, #d4af37)' }} />
      <span className="text-[#d4af37] font-bold text-sm tracking-wider">
        {toBB(pot)} <span className="text-white/60 font-normal">(${pot})</span>
      </span>
    </div>
  )
}
