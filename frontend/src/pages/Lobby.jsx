import { useGameStore } from '../store/gameStore.js'
import AuthScreen       from '../components/lobby/AuthScreen.jsx'
import LobbyScreen      from '../components/lobby/LobbyScreen.jsx'
import LoadingScreen    from '../components/lobby/LoadingScreen.jsx'

export default function Lobby() {
  const playerName = useGameStore(s => s.playerName)
  const loading    = useGameStore(s => s.loading)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0e0a0a',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      fontFamily: "'Rajdhani', sans-serif",
    }}>

      {/* Pantalla de carga con fichas cayendo */}
      {loading && <LoadingScreen message="BUSCANDO MESA..." />}

      {/* Glow rojo alrededor de la card */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 700, height: 700,
        background: 'radial-gradient(ellipse at center, rgba(150,20,20,0.25) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      {/* Card centrada */}
      <div style={{
        width: 340,
        background: 'rgba(18,12,12,0.92)',
        border: '1px solid rgba(180,40,40,0.25)',
        borderRadius: 10,
        boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 30px 80px rgba(0,0,0,0.9)',
        position: 'relative', zIndex: 10,
        overflow: 'hidden',
      }}>
        {!playerName ? <AuthScreen /> : <LobbyScreen />}
      </div>

      <style>{`
        input::placeholder { color: #444 !important; }
      `}</style>
    </div>
  )
}