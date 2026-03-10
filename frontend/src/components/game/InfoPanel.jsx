import { useState, useEffect, useRef } from 'react'
import { socket }       from '../../socket/socket.js'
import { useGameStore } from '../../store/gameStore.js'

const TABS = ['Chat', 'Manos', 'Jugadores', 'Info']

// ── Tab: Chat ──────────────────────────────────────────────
function ChatTab() {
  const logs        = useGameStore(s => s.logs)
  const playerName  = useGameStore(s => s.playerName)
  const [msg, setMsg] = useState('')
  const bottomRef   = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const send = () => {
    const trimmed = msg.trim()
    if (!trimmed) return
    socket.emit('sendChat', trimmed)
    setMsg('')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 min-h-0">
        {logs.length === 0 && (
          <p className="text-[#2a4060] text-[10px] text-center pt-2">Sin mensajes aún...</p>
        )}
        {logs.map((entry, i) => {
          const isSystem = typeof entry === 'string'
          const user = isSystem ? null : entry.user
          const text = isSystem ? entry : entry.message
          const isMe = user === playerName

          if (isSystem) {
            return (
              <div key={i} className="flex items-start gap-1">
                <span className="text-[#2a4060] text-[9px] mt-0.5 shrink-0">•</span>
                <span className="text-[#3a5878] text-[10px] leading-3.5">{text}</span>
              </div>
            )
          }
          return (
            <div key={i} className={`flex gap-1.5 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`max-w-[80%] px-2 py-1 rounded-lg text-[10px] leading-3.5 ${
                isMe
                  ? 'bg-[#1a3a5c] text-white rounded-tr-sm'
                  : 'bg-[#111d2e] text-[#c0d8f0] rounded-tl-sm'
              }`}>
                {!isMe && <div className="text-[#22d3a0] text-[9px] font-bold mb-0.5">{user}</div>}
                {text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-1.5 px-2 py-1.5 border-t border-[#1a2940]">
        <input
          type="text"
          value={msg}
          onChange={e => setMsg(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Mensaje..."
          maxLength={120}
          className="flex-1 bg-[#080c14] border border-[#1a2940] rounded px-2 py-1
                     text-white placeholder-[#2a4060] text-[10px]
                     focus:outline-none focus:border-[#22d3a040] transition-colors"
        />
        <button
          onClick={send}
          className="bg-[#22d3a015] border border-[#22d3a030] text-[#22d3a0]
                     text-[10px] font-bold px-2 py-1 rounded hover:bg-[#22d3a025]
                     transition-all active:scale-95"
        >↵</button>
      </div>
    </div>
  )
}

// ── Tab: Manos ─────────────────────────────────────────────
function HandsTab() {
  const logs = useGameStore(s => s.logs)
  const bottomRef = useRef(null)

  const handLogs = logs.filter(e => {
    const text = typeof e === 'string' ? e : e.message
    return text && (
      text.includes('🏆') || text.includes('🎲') ||
      text.includes('gana') || text.includes('subió') ||
      text.includes('ALL-IN') || text.includes('igualó') ||
      text.includes('retiró') || text.includes('pasó')
    )
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [handLogs.length])

  return (
    <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5 min-h-0">
      {handLogs.length === 0 && (
        <p className="text-[#2a4060] text-[10px] text-center pt-2">Sin manos jugadas aún.</p>
      )}
      {handLogs.map((entry, i) => {
        const text = typeof entry === 'string' ? entry : entry.message
        const isWin = text.includes('🏆')
        return (
          <div key={i} className={`text-[10px] py-0.5 px-1.5 rounded leading-3.5 ${
            isWin ? 'text-[#f1c40f] bg-[#f1c40f06]' : 'text-[#3a5878]'
          }`}>
            {text}
          </div>
        )
      })}
      <div ref={bottomRef} />
    </div>
  )
}

// ── Tab: Jugadores ─────────────────────────────────────────
function PlayersTab() {
  const gameState = useGameStore(s => s.gameState)
  const socketId  = useGameStore(s => s.socketId)
  const BB_VALUE  = useGameStore(s => s.BB_VALUE)

  const seated = (gameState?.seats || [])
    .map((s, i) => s ? { ...s, seatIndex: i } : null)
    .filter(Boolean)
    .sort((a, b) => b.balance - a.balance)

  const total = seated.reduce((a, p) => a + p.balance, 0)

  if (seated.length === 0) {
    return <p className="text-[#2a4060] text-[10px] text-center pt-2">No hay jugadores.</p>
  }

  return (
    <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 min-h-0">
      {seated.map((player, rank) => {
        const isMe = player.id === socketId
        const pct  = total ? Math.round((player.balance / total) * 100) : 0
        return (
          <div key={player.id}
            className={`flex items-center gap-2 px-2 py-1.5 rounded border ${
              isMe ? 'border-[#22d3a025] bg-[#22d3a006]' : 'border-[#1a2940] bg-[#080c14]'
            }`}>
            <span className={`text-[9px] font-black w-4 ${rank === 0 ? 'text-[#d4af37]' : 'text-[#2a4060]'}`}>
              #{rank+1}
            </span>
            <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${player.name}`}
              className="w-5 h-5 rounded-full bg-[#111] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-[10px] font-bold truncate ${isMe ? 'text-[#22d3a0]' : 'text-white'}`}>
                  {player.name}
                </span>
                {player.isAllIn && <span className="text-[8px] text-[#ff4757]">AI</span>}
                {!player.active && <span className="text-[8px] text-[#3a5878]">F</span>}
              </div>
              <div className="h-0.5 bg-[#1a2940] rounded-full mt-0.5 overflow-hidden">
                <div className="h-full rounded-full" style={{
                  width: `${pct}%`,
                  background: isMe ? '#22d3a0' : '#3a5878'
                }} />
              </div>
            </div>
            <span className="text-[#d4af37] text-[10px] font-bold shrink-0">
              ${player.balance.toLocaleString()}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Info ──────────────────────────────────────────────
function InfoTab() {
  const { gameState, roomId, BB_VALUE } = useGameStore()

  const rows = [
    { label: 'Sala',    value: roomId || '—' },
    { label: 'Estado',  value: gameState?.gameState || 'WAITING' },
    { label: 'Fase',    value: gameState?.handState || '—' },
    { label: 'Pot',     value: `$${(gameState?.pot || 0).toLocaleString()}` },
    { label: 'Apuesta', value: `$${gameState?.currentBet || 0}` },
    { label: 'SB / BB', value: `$${gameState?.smallBlind || BB_VALUE/2} / $${gameState?.bigBlind || BB_VALUE}` },
    { label: 'Mesas',   value: `${(gameState?.seats||[]).filter(Boolean).length} / 6` },
  ]

  return (
    <div className="flex-1 overflow-y-auto px-2 py-1 min-h-0">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex justify-between items-center
                                    py-1 border-b border-[#1a2940] last:border-0">
          <span className="text-[#3a5878] text-[10px]">{label}</span>
          <span className="text-white text-[10px] font-bold">{value}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 pt-1.5">
        <div className={`w-1 h-1 rounded-full ${socket.connected ? 'bg-[#22d3a0]' : 'bg-red-500'}`} />
        <span className="text-[#2a4060] text-[9px]">
          {socket.connected ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  )
}

// ── Componente principal — flotante bottom-left ─────────────
export default function InfoPanel() {
  const [activeTab, setActiveTab]   = useState('Chat')
  const [chatBadge, setChatBadge]   = useState(0)
  const [collapsed, setCollapsed]   = useState(false)
  const logs = useGameStore(s => s.logs)
  const prevLen = useRef(logs.length)

  useEffect(() => {
    if (activeTab !== 'Chat' && logs.length > prevLen.current) {
      setChatBadge(b => b + (logs.length - prevLen.current))
    }
    prevLen.current = logs.length
  }, [logs.length, activeTab])

  useEffect(() => {
    if (activeTab === 'Chat') setChatBadge(0)
  }, [activeTab])

  useEffect(() => {
    const onChat = (data) => {
      useGameStore.getState().addLog({ user: data.user, message: data.message })
    }
    socket.on('receiveChat', onChat)
    return () => socket.off('receiveChat', onChat)
  }, [])

  return (
    <div className="flex flex-col" style={{ height: 200, overflow: 'hidden' }}>
      {/* Tabs header */}
      <div className="flex items-center border-b border-[#1a2940] shrink-0">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setCollapsed(false) }}
            className={`relative flex-1 py-1.5 text-[9px] font-bold tracking-widest
                        uppercase transition-all ${
              activeTab === tab && !collapsed
                ? 'text-white border-b border-[#22d3a0] bg-[#22d3a008]'
                : 'text-[#3a5878] hover:text-[#6a90b0]'
            }`}
          >
            {tab}
            {tab === 'Chat' && chatBadge > 0 && (
              <span className="absolute top-1 right-1 bg-[#ef4444] text-white
                               text-[8px] font-black rounded-full w-3.5 h-3.5
                               flex items-center justify-center leading-none">
                {chatBadge > 9 ? '9+' : chatBadge}
              </span>
            )}
          </button>
        ))}

        {/* Botón colapsar */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="px-2 py-1.5 text-[#3a5878] hover:text-white text-xs transition-colors shrink-0"
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {/* Contenido */}
      {!collapsed && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {activeTab === 'Chat'      && <ChatTab />}
          {activeTab === 'Manos'     && <HandsTab />}
          {activeTab === 'Jugadores' && <PlayersTab />}
          {activeTab === 'Info'      && <InfoTab />}
        </div>
      )}
    </div>
  )
}