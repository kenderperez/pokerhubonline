import { useGameStore }    from '../../store/gameStore.js'
import PlayerSeat           from './PlayerSeat.jsx'
import CommunityCards       from './CommunityCards.jsx'
import PotDisplay           from './PotDisplay.jsx'

export default function PokerTable() {
  const gameState = useGameStore(s => s.gameState)
  const seats     = gameState?.seats || Array(6).fill(null)

  return (
    <div className="table-wrapper">
      <div className="table-border">
        <div className="poker-table" id="poker-table">

          <PotDisplay />
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
  )
}
