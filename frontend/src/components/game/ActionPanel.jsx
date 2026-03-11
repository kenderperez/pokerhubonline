import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/gameStore.js'
import { socket }       from '../../socket/socket.js'

// colores: [fondo, sombra3D]
const COLORS = {
  fold:  ['#a63a3a', '#6e2525'],
  call:  ['#f5a800', '#a86d00'],
  check: ['#2e7d32', '#1a4e1a'],
  raise: ['#a63a3a', '#6e2525'],
  allin: ['#d32f2f', '#8b1d1d'],
}

function ActBtn({ colorKey, icon, label, onClick, disabled, pressed }) {
  const [bg, shadow] = COLORS[colorKey]
  const isPressed = pressed === colorKey

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        height: 65,
        border: 'none',
        borderRadius: 8,
        fontWeight: 800,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: '#fff',
        fontSize: 13,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        opacity: disabled ? 0.55 : 1,
        background: bg,
        boxShadow: isPressed
          ? `0 2px 0 ${shadow}, 0 4px 8px rgba(0,0,0,0.6)`
          : `0 6px 0 ${shadow}, 0 10px 15px rgba(0,0,0,0.5)`,
        transform: isPressed ? 'translateY(4px)' : 'translateY(0)',
        transition: 'transform 0.08s, box-shadow 0.08s',
      }}
    >
      {/* Brillo superior — igual que ::before del CSS */}
      <div style={{
        position: 'absolute',
        top: 2, left: 4, right: 4, height: '40%',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.13), transparent)',
        borderRadius: '6px 6px 0 0',
        pointerEvents: 'none',
      }} />
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>{label}</span>
    </button>
  )
}

export default function ActionPanel() {
  const { isMyTurn, turnData, gameState, myBalance, BB_VALUE } = useGameStore()
  const [raiseVal, setRaiseVal] = useState(turnData?.minRaise || 20)
  const [sending, setSending]   = useState(false)
  const [pressed, setPressed]   = useState(null)

  useEffect(() => {
    if (turnData?.minRaise) setRaiseVal(turnData.minRaise)
    setSending(false)
  }, [turnData?.minRaise])

  useEffect(() => {
    const onYourTurn = () => setSending(false)
    socket.on('yourTurn', onYourTurn)
    return () => socket.off('yourTurn', onYourTurn)
  }, [])

  if (!isMyTurn || !turnData) return null

  const { callAmount = 0, minRaise = 20, maxRaise = myBalance } = turnData
  const pot  = gameState?.pot || 0
  const toBB = (v) => (v / BB_VALUE).toFixed(1) + ' BB'

  const send = (action, amount = 0) => {
    if (sending) return
    setSending(true)
    socket.emit('playerAction', { action, amount })
  }

  const handleBtn = (key, action, amount = 0) => {
    if (sending) return
    setPressed(key)
    setTimeout(() => setPressed(null), 150)
    send(action, amount)
  }

  const setPercent = (pct) => {
    const amount = callAmount + Math.floor((pct / 100) * (pot + callAmount))
    setRaiseVal(Math.min(Math.max(amount, minRaise), maxRaise))
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      style={{
        width: 340,
        background: '#111111',
        borderRadius: 12,
        border: '1px solid #333',
        padding: 14,
        boxShadow: '0 20px 50px rgba(0,0,0,0.9)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Slider area */}
      <div style={{
        background: '#000',
        border: '1px solid #222',
        borderRadius: 8,
        padding: '10px 12px',
        boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.8)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ color: '#888', fontSize: 11, fontFamily: 'Arial' }}>SUBIDA:</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
            <b style={{ color: '#e0e0e0', fontSize: 13 }}>${raiseVal}</b>
            <b style={{ color: '#78ff44', fontSize: 11, textShadow: '0 0 5px rgba(120,255,68,0.3)' }}>
              {toBB(raiseVal)}
            </b>
          </span>
        </div>

        <input
          type="range"
          min={minRaise}
          max={maxRaise}
          value={raiseVal}
          onChange={e => setRaiseVal(Number(e.target.value))}
          disabled={sending}
          style={{ width: '100%', margin: '10px 0 4px', cursor: 'pointer' }}
          className="gg-slider"
        />

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#444', fontSize: 10 }}>MIN</span>
          <span style={{ color: '#444', fontSize: 10 }}>MAX</span>
        </div>
      </div>

      {/* Quick bets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
        {[
          { label: '25%', pct: 25  },
          { label: '50%', pct: 50  },
          { label: '75%', pct: 75  },
          { label: 'POT', pct: 100 },
        ].map(({ label, pct }) => (
          <button
            key={label}
            onClick={() => setPercent(pct)}
            disabled={sending}
            style={{
              background: 'linear-gradient(to bottom, #3a3f4b 0%, #22252c 100%)',
              border: '1px solid #111',
              color: '#bbb',
              fontSize: 10,
              padding: '6px 2px',
              borderRadius: 5,
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.3)',
              opacity: sending ? 0.5 : 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'linear-gradient(to bottom, #4a4f5b, #2a2e38)' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#bbb'; e.currentTarget.style.background = 'linear-gradient(to bottom, #3a3f4b, #22252c)' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        <ActBtn
          colorKey="fold"
          label="Retirarse"
          onClick={() => handleBtn('fold', 'fold')}
          disabled={sending}
          pressed={pressed}
        />
        <ActBtn
          colorKey={callAmount > 0 ? 'call' : 'check'}
          label={callAmount > 0 ? `CALL $${callAmount}` : 'Pasar'}
          onClick={() => handleBtn('call', callAmount > 0 ? 'call' : 'check', callAmount)}
          disabled={sending}
          pressed={pressed}
        />
        <ActBtn
          colorKey="raise"
          label="Subir"
          onClick={() => handleBtn('raise', 'raise', raiseVal)}
          disabled={sending}
          pressed={pressed}
        />
        <ActBtn
          colorKey="allin"
          label="All-In"
          onClick={() => handleBtn('allin', 'allin', myBalance)}
          disabled={sending}
          pressed={pressed}
        />
      </div>

      <style>{`
        .gg-slider {
          -webkit-appearance: none;
          height: 4px;
          background: #333;
          border-radius: 2px;
        }
        .gg-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 28px;
          height: 28px;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
          border: 4px dashed #333;
          box-shadow: 0 0 0 3px #ddd, 0 4px 10px rgba(0,0,0,0.8);
          background-image: radial-gradient(circle, #444 20%, #fff 21%);
          transition: transform 0.1s;
        }
        .gg-slider::-webkit-slider-thumb:hover {
          transform: scale(1.1) rotate(15deg);
        }
        .gg-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
          border: 4px dashed #333;
          box-shadow: 0 0 0 3px #ddd, 0 4px 10px rgba(0,0,0,0.8);
        }
      `}</style>
    </div>
  )
}