import { useGameStore } from '../../store/gameStore.js'
import PokerCard from './PokerCard.jsx'

export default function CommunityCards() {
  const board = useGameStore(s => s.gameState?.board)
  const cards = board ?? []

  if (cards.length === 0) return null

  return (
    <div className="community-cards-wrapper">
      {cards.map((cardStr, i) => {
        const rank = cardStr.slice(0, -1)
        const suit = cardStr.slice(-1)
        return (
          <div
            key={`${cardStr}-${i}`}
            className="community-slot"
            style={{ animationDelay: `${i * 110}ms` }}
          >
            <PokerCard
              rank={rank}
              suit={suit}
              revealed={true}
            />
          </div>
        )
      })}
    </div>
  )
}