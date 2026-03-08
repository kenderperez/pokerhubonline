import { useGameStore }  from '../../store/gameStore.js'
import { socket }         from '../../socket/socket.js'

const CHIP_VALUES = [100, 50, 25, 10, 5, 1]

function calculateChips(amount) {
  let remaining = amount
  const chips = []
  for (const val of CHIP_VALUES) {
    const count = Math.floor(remaining / val)
    for (let i = 0; i < count; i++) {
      chips.push(val)
      if (chips.length >= 8) return chips.reverse()
    }
    remaining %= val
  }
  return chips.reverse()
}

export default function PlayerSeat({ seatIndex, data, gameState }) {
  const { socketId, myCards, BB_VALUE } = useGameStore()

  const toBB = (v) => (v / BB_VALUE).toFixed(1) + ' BB'

  // Asiento vacío
  if (!data) {
    const canSit = gameState?.gameState === 'WAITING'
    return (
      <div className={`seat pos-${seatIndex}`}>
        {canSit ? (
          <div
            className="empty-seat-btn"
            onClick={() => socket.emit('sitDown', seatIndex)}
          >
            SENTARSE
          </div>
        ) : (
          <div className="empty-seat-btn locked">—</div>
        )}
      </div>
    )
  }

  const isMe      = data.id === socketId
  const isTurn    = seatIndex === gameState?.currentTurnIndex
  const isDealer  = seatIndex === gameState?.dealerIndex
  const isSB      = seatIndex === gameState?.sbIndex
  const isBB      = seatIndex === gameState?.bbIndex
  const handState = gameState?.handState

  // Cartas
  let cardsToRender = []
  if (data.active && handState && handState !== 'WAITING') {
    if (isMe) {
      cardsToRender = myCards.length > 0 ? myCards : (data.holeCards || ['?', '?'])
    } else if (handState === 'SHOWDOWN') {
      cardsToRender = data.holeCards || ['?', '?']
    } else {
      cardsToRender = (data.holeCards || ['?', '?']).map(() => '?')
    }
  }

  const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`

  return (
    <div className={`seat pos-${seatIndex} ${isTurn ? 'active-turn' : ''}`}>

      {/* Apuesta del jugador */}
      {data.currentBet > 0 && (
        <div className="player-bet visible">
          <div className="chip-stack" style={{ height: 28 + calculateChips(data.currentBet).length * 3 }}>
            {calculateChips(data.currentBet).map((val, i) => (
              <div key={i} className={`poker-chip chip-${val}`}
                   style={{ bottom: i * 3, zIndex: i }} />
            ))}
          </div>
          <span style={{ marginBottom: 4, fontSize: 12 }}>${data.currentBet}</span>
        </div>
      )}

      {/* Label de acción */}
      {data.lastAction && (
        <div className="action-label">{data.lastAction}</div>
      )}

      {/* Cartas del jugador */}
      <div className="player-cards">
        {cardsToRender.map((c, i) => {
          if (c === '?') return <div key={i} className="card hidden" />
          const rank = c.slice(0, -1)
          const suit = c.slice(-1)
          const isRed = suit === '♥' || suit === '♦'
          const isWinner = gameState?.winningCards?.includes(c)
          return (
            <div key={i} className={`card ${isRed ? 'card-red' : 'card-black'} ${isWinner ? 'winner-highlight' : ''}`}>
              <div className="card-corner top-left">
                <span className="rank">{rank}</span>
                <span className="suit">{suit}</span>
              </div>
              <div className="card-center">{suit}</div>
              <div className="card-corner bottom-right">
                <span className="rank">{rank}</span>
                <span className="suit">{suit}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Avatar */}
      <div className="avatar-wrapper">
        <img src={avatarUrl} className="avatar-img"
             style={{ opacity: data.active ? 1 : 0.3, filter: data.active ? 'none' : 'grayscale(1)' }} />
        {isDealer && <div className="blind-btn btn-dealer">D</div>}
        {isSB     && <div className="blind-btn btn-sb">SB</div>}
        {isBB     && <div className="blind-btn btn-bb">BB</div>}
      </div>

      {/* Info del jugador */}
      <div className="player-info-panel">
        <b>{data.name}</b>
        <span>{toBB(data.balance)}</span>
        <div className="timer-container">
          <div className="timer-bar" id={`timer-bar-${seatIndex}`} />
        </div>
        {data.bestHand && (isMe || handState === 'SHOWDOWN') && (
          <div style={{ fontSize: 10, lineHeight: 1.2, marginTop: 3 }}>{data.bestHand}</div>
        )}
      </div>

    </div>
  )
}
