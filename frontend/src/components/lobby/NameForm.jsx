import { useState }      from 'react'
import { useGameStore }  from '../../store/gameStore.js'

export default function NameForm() {
  const [name, setName] = useState('')
  const setPlayerName   = useGameStore(s => s.setPlayerName)

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setPlayerName(trimmed)
  }

  return (
    <div>
      <p className="text-[#4a7090] text-xs tracking-widest uppercase mb-5 text-center">
        Ingresa tu nombre para comenzar
      </p>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="Tu Nombre / Nickname"
        maxLength={20}
        className="w-full bg-[#080c14] border border-[#1a2940] rounded-lg px-4 py-3
                   text-white placeholder-[#2a4060] text-sm tracking-wider
                   focus:outline-none focus:border-[#22d3a0] transition-colors mb-4"
      />
      <button
        onClick={handleSubmit}
        className="w-full bg-linear-to-r from-red-600 to-red-500 text-white font-bold
                   py-3 rounded-lg tracking-widest text-sm hover:brightness-110
                   transition-all active:scale-95"
      >
        ENTRAR AL LOBBY
      </button>
    </div>
  )
}
