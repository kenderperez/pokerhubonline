import { useGameStore }  from '../../store/gameStore.js'
import PlayerSeat        from './PlayerSeat.jsx'
import CommunityCards    from './CommunityCards.jsx'

const EMPTY_SEATS = Array(6).fill(null)

export default function PokerTable() {
  const gameState = useGameStore(s => s.gameState)
  const seats     = gameState?.seats ?? EMPTY_SEATS

  return (
    <div className="table-wrapper">
      {/* div extra para el rotateX de perspectiva */}
      <div className="table-tilt">
        <div className="table-border">
          <div className="poker-table" id="poker-table">

            <CommunityCards />

            {seats.map((seat, i) => (
              <PlayerSeat
                key={i}
                seatIndex={i}
                data={seat}
                gameState={gameState}
              />
            ))}

          </div>
        </div>
      </div>
    </div>
  )
}