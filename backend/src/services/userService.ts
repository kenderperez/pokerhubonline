// src/services/userService.ts
import { supabase } from '../db.js'

// ── Obtener o crear usuario al conectarse ──────────────────────
export async function getOrCreateUser(address: string, name: string) {
  // Buscar si ya existe
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('address', address)
    .single()

  if (existing) {
    // Actualizar nombre si cambió
    const { data } = await supabase
      .from('users')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('address', address)
      .select()
      .single()
    return data
  }

  // Crear nuevo usuario
  const { data, error } = await supabase
    .from('users')
    .insert({ address, name, balance: 1000 })
    .select()
    .single()

  if (error) throw new Error(`Error creando usuario: ${error.message}`)
  return data
}

// ── Obtener usuario por address ────────────────────────────────
export async function getUserByAddress(address: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('address', address)
    .single()

  if (error) return null
  return data
}

// ── Actualizar balance ─────────────────────────────────────────
export async function updateBalance(address: string, newBalance: number) {
  const { data, error } = await supabase
    .from('users')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('address', address)
    .select()
    .single()

  if (error) throw new Error(`Error actualizando balance: ${error.message}`)
  return data
}

// ── Registrar victoria ─────────────────────────────────────────
export async function recordWin(address: string, amount: number) {
  // Primero obtenemos los valores actuales
  const { data: user } = await supabase
    .from('users')
    .select('total_won, hands_won, hands_played')
    .eq('address', address)
    .single()

  if (!user) return

  const { data, error } = await supabase
    .from('users')
    .update({
      total_won:    user.total_won    + amount,
      hands_won:    user.hands_won    + 1,
      hands_played: user.hands_played + 1,
      updated_at:   new Date().toISOString(),
    })
    .eq('address', address)
    .select()
    .single()

  if (error) throw new Error(`Error registrando victoria: ${error.message}`)
  return data
}

// ── Registrar derrota ──────────────────────────────────────────
export async function recordLoss(address: string, amount: number) {
  const { data: user } = await supabase
    .from('users')
    .select('total_lost, hands_played')
    .eq('address', address)
    .single()

  if (!user) return

  const { data, error } = await supabase
    .from('users')
    .update({
      total_lost:   user.total_lost   + amount,
      hands_played: user.hands_played + 1,
      updated_at:   new Date().toISOString(),
    })
    .eq('address', address)
    .select()
    .single()

  if (error) throw new Error(`Error registrando derrota: ${error.message}`)
  return data
}

// ── Leaderboard global (top 20) ────────────────────────────────
export async function getLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_won', { ascending: false })
    .limit(20)

  if (error) throw new Error(`Error obteniendo leaderboard: ${error.message}`)
  return data
}

// ── Actualizar leaderboard tras victoria ───────────────────────
export async function upsertLeaderboard(
  address:   string,
  name:      string,
  wonAmount: number,
  potSize:   number,
) {
  const { data: existing } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('address', address)
    .single()

  if (existing) {
    const { data, error } = await supabase
      .from('leaderboard')
      .update({
        name,
        total_won:    existing.total_won    + wonAmount,
        hands_won:    existing.hands_won    + 1,
        hands_played: existing.hands_played + 1,
        biggest_pot:  Math.max(existing.biggest_pot, potSize),
        updated_at:   new Date().toISOString(),
      })
      .eq('address', address)
      .select()
      .single()

    if (error) throw new Error(`Error actualizando leaderboard: ${error.message}`)
    return data
  }

  // Primera victoria — crear entrada
  const { data, error } = await supabase
    .from('leaderboard')
    .insert({
      address, name,
      total_won:    wonAmount,
      hands_won:    1,
      hands_played: 1,
      biggest_pot:  potSize,
    })
    .select()
    .single()

  if (error) throw new Error(`Error creando entrada leaderboard: ${error.message}`)
  return data
}