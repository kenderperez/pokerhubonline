import { useGameStore } from './store/gameStore.js'
import { useSocket }    from './hooks/useSocket.js'
import Lobby  from './pages/Lobby.jsx'
import Game   from './pages/Game.jsx'

export default function App() {
  useSocket()  // ← aquí, vive toda la sesión sin interrumpirse

  const page = useGameStore(s => s.page)
  return page === 'game' ? <Game /> : <Lobby />
}