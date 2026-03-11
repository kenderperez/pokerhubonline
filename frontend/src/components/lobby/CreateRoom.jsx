import { useState }     from 'react'
import { socket }        from '../../socket/socket.js'
import { useGameStore }  from '../../store/gameStore.js'

export default function CreateRoom() {
  const { playerName, userAddress, setLoading, loading } = useGameStore()
  const [type,       setType]       = useState('free')
  const [visibility, setVisibility] = useState('public')
  const [joinCode,   setJoinCode]   = useState('')
  const [error,      setError]      = useState('')

  // Emite con garantía de conexión + timeout de seguridad
  const safeEmit = (event, data) => {
    setError('')
    setLoading(true)

    const emit = () => {
      socket.emit(event, data)

      // Si en 5 segundos no llega roomJoined, cancela el loading
      const timeout = setTimeout(() => {
        const { page } = useGameStore.getState()
        if (page !== 'game') {
          setLoading(false)
          setError('Sin respuesta del servidor. ¿Está corriendo el backend?')
        }
      }, 5000)

      // Limpia el timeout si roomJoined llega antes
      socket.once('roomJoined', () => clearTimeout(timeout))
      socket.once('serverLog',  () => clearTimeout(timeout))
    }

    if (socket.connected) {
      emit()
    } else {
      socket.connect()
      socket.once('connect', emit)
    }
  }

  const handleMatchmaking = () => {
    safeEmit('requestMatchmaking', { name: playerName, address: userAddress || playerName })
  }

  const handleCreate = () => {
    safeEmit('createRoom', { name: playerName, type, visibility, address: userAddress || playerName })
  }

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    safeEmit('joinRoom', { roomId: code, name: playerName, address: userAddress || playerName })
  }

  return (
    <div className="space-y-3">

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-lg px-4 py-2.5
                        text-red-400 text-xs tracking-wide">
          ⚠ {error}
        </div>
      )}

      {/* Matchmaking */}
      <button
        onClick={handleMatchmaking}
        disabled={loading}
        className="w-full bg-linear-to-r from-red-600 to-red-500 text-white font-bold
                   py-3 rounded-lg tracking-widest text-sm hover:brightness-110
                   transition-all active:scale-95 flex items-center justify-center gap-2
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>⚡</span> PARTIDA RÁPIDA
      </button>

      {/* Selects */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[#3a5878] text-[10px] tracking-widest uppercase block mb-1">Tipo</label>
          <select value={type} onChange={e => setType(e.target.value)}
            className="w-full bg-[#080c14] border border-[#1a2940] text-white text-xs
                       rounded-lg px-3 py-2 focus:outline-none focus:border-[#22d3a0]">
            <option value="free">GRATIS</option>
            <option value="paid">PAID (CRYPTO)</option>
          </select>
        </div>
        <div>
          <label className="text-[#3a5878] text-[10px] tracking-widest uppercase block mb-1">Visibilidad</label>
          <select value={visibility} onChange={e => setVisibility(e.target.value)}
            className="w-full bg-[#080c14] border border-[#1a2940] text-white text-xs
                       rounded-lg px-3 py-2 focus:outline-none focus:border-[#22d3a0]">
            <option value="public">PÚBLICA</option>
            <option value="private">PRIVADA</option>
          </select>
        </div>
      </div>

      {/* Crear sala */}
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full bg-[#111d2e] border border-[#1a2940] text-white font-bold
                   py-2 rounded-lg tracking-wider text-xs hover:border-[#22d3a0]
                   hover:text-[#22d3a0] transition-all active:scale-95
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ➕ CREAR NUEVA SALA
      </button>

      {/* Unirse con código */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleJoin()}
          placeholder="CÓDIGO PRIVADO"
          className="flex-1 bg-[#080c14] border border-[#1a2940] rounded-lg px-3 py-2
                     text-white placeholder-[#2a4060] text-xs tracking-widest
                     focus:outline-none focus:border-[#22d3a0] transition-colors"
        />
        <button
          onClick={handleJoin}
          disabled={loading}
          className="bg-[#111d2e] border border-[#1a2940] text-white px-4 py-2
                     rounded-lg text-xs font-bold hover:border-[#22d3a0] transition-all
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          UNIRSE
        </button>
      </div>

      {/* Estado conexión */}
      <div className="flex items-center gap-1.5 pt-1">
        <div className={`w-1.5 h-1.5 rounded-full ${socket.connected ? 'bg-[#22d3a0]' : 'bg-red-500'}`} />
        <span className="text-[#2a4060] text-[10px] tracking-wider">
          {socket.connected ? 'Conectado al servidor' : 'Sin conexión al servidor'}
        </span>
      </div>

    </div>
  )
}