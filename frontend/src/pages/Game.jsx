import { useEffect }  from 'react'
import TopBar      from '../components/game/TopBar.jsx'
import PokerTable  from '../components/game/PokerTable.jsx'
import ActionPanel from '../components/game/ActionPanel.jsx'
import InfoPanel   from '../components/game/InfoPanel.jsx'

export default function Game() {
  // Habilitar scroll en body solo mientras estamos en la página de juego
  useEffect(() => {
    document.body.style.overflow = 'auto'
    return () => { document.body.style.overflow = 'hidden' }
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-[#080c14]">

      <TopBar />

      {/* Margen top de la mesa */}
      <div className="h-20" />

      {/* Mesa centrada */}
      <div className="flex justify-center px-4">
        <PokerTable />
      </div>

      {/* Margen bottom de la mesa */}
      <div className="h-10" />

      {/* InfoPanel — solo 40% izquierdo, fluye con la página */}
      <div className="w-[40%] border-t border-r border-[#1a2940]">
        <InfoPanel />
      </div>

      <ActionPanel />

    </div>
  )
}