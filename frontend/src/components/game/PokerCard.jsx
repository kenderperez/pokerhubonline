/**
 * PokerCard — carta individual con flip 3D
 *
 * Estructura:
 *   <div class="hand-slot">          ← outer: posición/abanico (en PlayerHand)
 *     <div class="card-inner">       ← inner: flip 3D (este componente)
 *       <div class="card__back" />
 *       <div class="card__face" />
 *     </div>
 *   </div>
 *
 * Props:
 *   rank, suit  — "A", "♠"
 *   revealed    — boolean, true = cara visible
 *   isWinner    — boolean
 *   isHidden    — boolean (oponente, solo dorso)
 */
export default function PokerCard({ rank, suit, revealed = false, isWinner = false, isHidden = false }) {
  const isRed = suit === '♥' || suit === '♦'
  const colorCls = isRed ? 'card-inner--red' : 'card-inner--black'

  const cls = [
    'card-inner',
    colorCls,
    revealed  ? 'card-inner--flip'   : '',
    isWinner  ? 'card-inner--winner' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      {/* DORSO — visible cuando NOT flipped */}
      <div className="card__back" />

      {/* CARA — solo si tenemos datos y no está oculta */}
      {!isHidden && rank && suit && (
        <div className="card__face">
          <div className="card__corner tl">
            <span className="rank">{rank}</span>
            <span className="suit">{suit}</span>
          </div>
          <div className="card__center">{suit}</div>
          <div className="card__corner br">
            <span className="rank">{rank}</span>
            <span className="suit">{suit}</span>
          </div>
        </div>
      )}
    </div>
  )
}