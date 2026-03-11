// src/services/handService.ts
import { supabase } from '../db.js'

interface SeatData {
  userId?:      string
  playerName:   string
  seatIndex:    number
  holeCards:    string[]
  startBalance: number
  endBalance:   number
  betTotal:     number
  action:       string
  bestHand?:    string
}

interface SaveHandParams {
  roomId:       string
  handNumber:   number
  pot:          number
  board:        string[]
  winnerId?:    string
  winnerName?:  string
  winAmount?:   number
  winningHand?: string
  phase:        string
  seats:        SeatData[]
}

// ── Crear sala en DB al crearla en el servidor ─────────────────
export async function createRoom(
  roomId:     string,
  host:       string,
  type:       string,
  isPublic:   boolean,
  smallBlind: number,
  bigBlind:   number,
) {
  const { data, error } = await supabase
    .from('rooms')
    .upsert({ id: roomId, host, type, is_public: isPublic, small_blind: smallBlind, big_blind: bigBlind })
    .select()
    .single()

  if (error) throw new Error(`Error creando sala: ${error.message}`)
  return data
}

// ── Cerrar sala cuando todos se van ───────────────────────────
export async function closeRoom(roomId: string) {
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
    .eq('id', roomId)

  if (error) throw new Error(`Error cerrando sala: ${error.message}`)
}

// ── Contar manos de una sala (para handNumber) ─────────────────
export async function getHandCount(roomId: string): Promise<number> {
  const { count, error } = await supabase
    .from('hands')
    .select('*', { count: 'exact', head: true })
    .eq('room_id', roomId)

  if (error) return 0
  return count ?? 0
}

// ── Guardar mano completa al terminar ──────────────────────────
export async function saveHand(params: SaveHandParams) {
  const {
    roomId, handNumber, pot, board,
    winnerId, winnerName, winAmount, winningHand,
    phase, seats,
  } = params

  // 1. Insertar la mano
  const { data: hand, error: handError } = await supabase
    .from('hands')
    .insert({
      room_id:      roomId,
      hand_number:  handNumber,
      pot,
      board,
      winner_id:    winnerId,
      winner_name:  winnerName,
      win_amount:   winAmount,
      winning_hand: winningHand,
      phase,
      ended_at:     new Date().toISOString(),
    })
    .select()
    .single()

  if (handError) throw new Error(`Error guardando mano: ${handError.message}`)

  // 2. Insertar los asientos de esa mano
  const seatRows = seats.map(s => ({
    hand_id:       hand.id,
    user_id:       s.userId ?? null,
    player_name:   s.playerName,
    seat_index:    s.seatIndex,
    hole_cards:    s.holeCards,
    start_balance: s.startBalance,
    end_balance:   s.endBalance,
    bet_total:     s.betTotal,
    action:        s.action,
    best_hand:     s.bestHand ?? null,
  }))

  const { error: seatsError } = await supabase
    .from('hand_seats')
    .insert(seatRows)

  if (seatsError) throw new Error(`Error guardando asientos: ${seatsError.message}`)

  return hand
}

// ── Historial de manos de una sala ────────────────────────────
export async function getRoomHands(roomId: string, limit = 20) {
  const { data, error } = await supabase
    .from('hands')
    .select('*, hand_seats(*)')
    .eq('room_id', roomId)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Error obteniendo manos: ${error.message}`)
  return data
}

// ── Historial de manos de un jugador ──────────────────────────
export async function getPlayerHands(address: string, limit = 20) {
  const { data, error } = await supabase
    .from('hand_seats')
    .select('*, hands(*, hand_seats(*))')
    .eq('user_id', address)
    .order('hand_id', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`Error obteniendo manos del jugador: ${error.message}`)
  return data
}