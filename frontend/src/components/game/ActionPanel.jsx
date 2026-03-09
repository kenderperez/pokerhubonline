import { useState, useEffect } from 'react'
import { useGameStore }  from '../../store/gameStore.js'
import { socket }        from '../../socket/socket.js'

export default function ActionPanel() {
  const { isMyTurn, turnData, gameState, myBalance, BB_VALUE } = useGameStore()
  const [raiseVal, setRaiseVal] = useState(turnData?.minRaise || 20)
  const [sending, setSending]   = useState(false)

  // ── Todos los hooks ANTES de cualquier return condicional ──

  // Resetear slider y estado de envío cuando llega un nuevo turno
  useEffect(() => {
    if (turnData?.minRaise) setRaiseVal(turnData.minRaise)
    setSending(false)
  }, [turnData?.minRaise])

  // Re-habilitar botones si el servidor rechaza la acción y re-emite yourTurn
  useEffect(() => {
    const onYourTurn = () => setSending(false)
    socket.on('yourTurn', onYourTurn)
    return () => socket.off('yourTurn', onYourTurn)
  }, [])

  // ── Early return después de todos los hooks ──
  if (!isMyTurn || !turnData) return null

  const { callAmount = 0, minRaise = 20, maxRaise = myBalance } = turnData
  const pot   = gameState?.pot || 0
  const toBB  = (v) => (v / BB_VALUE).toFixed(1) + ' BB'

  const send = (action, amount = 0) => {
    if (sending) return
    setSending(true)
    socket.emit('playerAction', { action, amount })
  }

  const setPercent = (pct) => {
    const amount = callAmount + Math.floor((pct / 100) * (pot + callAmount))
    setRaiseVal(Math.min(Math.max(amount, minRaise), maxRaise))
  }

  return (
    <div className="fixed bottom-4 left-4 z-50
                    bg-[#0d1626] border border-[#1a2940] rounded-2xl p-4
                    w-85 shadow-2xl shadow-black/60">

      {/* Apuestas rápidas */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[25, 50, 75, 100].map(pct => (
          <button key={pct}
            onClick={() => setPercent(pct)}
            className="bg-[#111d2e] border border-[#1a2940] text-[#8aacd0] text-xs
                       font-bold py-1.5 rounded hover:border-[#22d3a040] hover:text-white
                       transition-all">
            {pct === 100 ? 'POT' : `${pct}%`}
          </button>
        ))}
      </div>

      {/* Slider */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[#3a5878] text-[10px]">BB</span>
        <input
          type="range"
          min={minRaise}
          max={maxRaise}
          value={raiseVal}
          onChange={e => setRaiseVal(Number(e.target.value))}
          className="flex-1 accent-[#22d3a0]"
        />
        <span className="text-[#3a5878] text-[10px]">MAX</span>
      </div>
      <div className="text-center text-[#d4af37] text-xs font-bold mb-3">
        Subida: ${raiseVal} <span className="text-[#3a5878] font-normal">({toBB(raiseVal)})</span>
      </div>

      {/* Botones de acción */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => send('fold')}
          disabled={sending}
          className="bg-red-900/80 border border-red-800 text-white text-[11px]
                     font-bold py-2.5 rounded-lg hover:bg-red-800 transition-all active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed">
          ✕ RETIRARSE
        </button>
        <button
          onClick={() => send(callAmount > 0 ? 'call' : 'check')}
          disabled={sending}
          className="bg-yellow-600/80 border border-yellow-600 text-black text-[11px]
                     font-bold py-2.5 rounded-lg hover:bg-yellow-500 transition-all active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed">
          {callAmount > 0 ? `📞 $${callAmount}` : '✓ PASAR'}
        </button>
        <button
          onClick={() => send('raise', raiseVal)}
          disabled={sending}
          className="bg-green-800/80 border border-green-700 text-white text-[11px]
                     font-bold py-2.5 rounded-lg hover:bg-green-700 transition-all active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed">
          ↑ SUBIR
        </button>
        <button
          onClick={() => send('allin', myBalance)}
          disabled={sending}
          className="text-white text-[11px] font-bold py-2.5 rounded-lg
                     hover:brightness-110 transition-all active:scale-95
                     disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(45deg, #c0392b, #ff4757)', border: '1px solid #ff9f43' }}>
          ⚡ ALL-IN
        </button>
      </div>

    </div>
  )
}