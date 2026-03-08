import { useEffect, useRef } from 'react'
import { useGameStore }  from '../../store/gameStore.js'

function getCardColorClass(suit) {
  return suit === '♥' || suit === '♦' ? 'card-red' : 'card-black'
}

function CardEl({ cardStr, animate }) {
  const rank = cardStr.slice(0, -1)
  const suit = cardStr.slice(-1)
  const isRed = suit === '♥' || suit === '♦'

  return (
    <div className={`card community-card-anim ${isRed ? 'card-red' : 'card-black'}`}>
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
}

export default function CommunityCards() {
  const board        = useGameStore(s => s.gameState?.board || [])
  const prevLenRef   = useRef(0)
  const [visible, setVisible] = [board, () => {}]

  // Animación incremental: solo aparecen las cartas nuevas
  const prevLen = prevLenRef.current
  useEffect(() => { prevLenRef.current = board.length }, [board.length])

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                    flex gap-2 z-10" style={{ marginTop: '10px' }}>
      {board.map((card, i) => (
        <CardEl key={i} cardStr={card} animate={i >= prevLen} />
      ))}
    </div>
  )
}
