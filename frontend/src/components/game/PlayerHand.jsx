import { useState, useEffect, useRef } from 'react'
import PokerCard from './PokerCard.jsx'

/**
 * PlayerHand — abanico de 2 cartas con animación de reparto tipo Vue.
 *
 * Fase 0 (entering):  sin transición, slot arriba-centro, dorso, opacidad 0
 * Fase 1 (traveling): transición 620ms, slot a posición abanico, dorso, opacidad 1
 * Fase 2 (revealed):  flip inner → cara visible (600ms ease-out)
 */
export default function PlayerHand({ cards, isMe, winningCards = [] }) {
  // phases[i]: 0 | 1 | 2
  const [phases, setPhases] = useState([0, 0])
  const prevCards = useRef([])

  useEffect(() => {
    if (!cards || cards.length === 0) {
      setPhases([0, 0])
      prevCards.current = []
      return
    }

    // Detectar cartas nuevas
    const isNew = cards.map((c, i) => c !== prevCards.current[i])
    prevCards.current = [...cards]

    // Reiniciar fases de cartas nuevas
    setPhases(prev => prev.map((p, i) => isNew[i] ? 0 : p))

    // Fase 1: viajar a posición de abanico (tras un frame para que CSS vea el estado 0)
    const t1 = setTimeout(() => {
      setPhases(prev => prev.map((p, i) => isNew[i] ? 1 : p))
    }, 32)

    // Fase 2: flip reveal (tras el viaje + 50ms)
    const timers = cards.map((_, i) => {
      if (!isNew[i]) return null
      return setTimeout(() => {
        setPhases(prev => {
          const next = [...prev]
          next[i] = 2
          return next
        })
      }, 32 + 620 + i * 120 + 50)
    })

    return () => {
      clearTimeout(t1)
      timers.forEach(t => t && clearTimeout(t))
    }
  }, [cards?.join?.(',')])

  if (!cards || cards.length === 0) return null

  return (
    <div className="player-hand">
      {cards.map((cardStr, i) => {
        const isHidden  = cardStr === '?' || !cardStr
        const rank      = (!isHidden) ? cardStr.slice(0, -1) : ''
        const suit      = (!isHidden) ? cardStr.slice(-1)    : ''
        const isWinner  = !isHidden && winningCards.includes(cardStr)
        const phase     = phases[i] ?? 0
        const entering  = phase === 0
        const revealed  = !isHidden && isMe && phase >= 2

        return (
          <div
            key={i}
            className={`hand-slot${entering ? ' hand-slot--entering' : ''}`}
          >
            <PokerCard
              rank={rank}
              suit={suit}
              revealed={revealed}
              isHidden={isHidden}
              isWinner={isWinner}
            />
          </div>
        )
      })}
    </div>
  )
}