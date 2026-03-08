import { useState }     from 'react'
import { useGameStore } from '../../store/gameStore.js'

const USERS_KEY = 'pokerhub_users'

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}') } catch { return {} }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export default function AuthScreen() {
  const setPlayerName = useGameStore(s => s.setPlayerName)
  const [tab,      setTab]      = useState('login')   // 'login' | 'register'
  const [name,     setName]     = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')

  const handleLogin = () => {
    setError('')
    const trimmed = name.trim()
    if (!trimmed) return setError('Ingresa tu nombre de usuario.')
    const users = getUsers()
    if (!users[trimmed]) return setError('Usuario no encontrado. ¿Quieres registrarte?')
    if (users[trimmed].password !== password) return setError('Contraseña incorrecta.')
    setPlayerName(trimmed)
  }

  const handleRegister = () => {
    setError('')
    const trimmed = name.trim()
    if (!trimmed)           return setError('El nombre no puede estar vacío.')
    if (trimmed.length < 3) return setError('Mínimo 3 caracteres.')
    if (trimmed.length > 20) return setError('Máximo 20 caracteres.')
    if (!password)          return setError('Ingresa una contraseña.')
    if (password.length < 4) return setError('Mínimo 4 caracteres para la contraseña.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    const users = getUsers()
    if (users[trimmed])     return setError('Ese nombre ya está en uso.')
    users[trimmed] = { password, createdAt: Date.now() }
    saveUsers(users)
    setPlayerName(trimmed)
  }

  const handleKey = (e) => {
    if (e.key !== 'Enter') return
    tab === 'login' ? handleLogin() : handleRegister()
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex border-b border-[#1a2940]">
        {['login', 'register'].map(t => (
          <button key={t}
            onClick={() => { setTab(t); setError('') }}
            className={[
              'flex-1 py-4 text-sm font-bold tracking-widest uppercase transition-all',
              tab === t
                ? 'text-white border-b-2 border-[#ef4444] bg-[#ef444408]'
                : 'text-[#3a5878] hover:text-white'
            ].join(' ')}>
            {t === 'login' ? '🔑 Ingresar' : '📝 Registrarse'}
          </button>
        ))}
      </div>

      <div className="p-8 space-y-4">

        {/* Nombre */}
        <div>
          <label className="text-[#3a5878] text-[10px] tracking-widest uppercase block mb-1.5">
            Nombre de usuario
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Tu nickname..."
            maxLength={20}
            className="w-full bg-[#080c14] border border-[#1a2940] rounded-lg px-4 py-3
                       text-white placeholder-[#2a4060] text-sm tracking-wide
                       focus:outline-none focus:border-[#22d3a060] transition-colors"
          />
        </div>

        {/* Contraseña */}
        <div>
          <label className="text-[#3a5878] text-[10px] tracking-widest uppercase block mb-1.5">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={handleKey}
            placeholder="••••••••"
            className="w-full bg-[#080c14] border border-[#1a2940] rounded-lg px-4 py-3
                       text-white placeholder-[#2a4060] text-sm
                       focus:outline-none focus:border-[#22d3a060] transition-colors"
          />
        </div>

        {/* Confirmar contraseña — solo en registro */}
        {tab === 'register' && (
          <div>
            <label className="text-[#3a5878] text-[10px] tracking-widest uppercase block mb-1.5">
              Confirmar contraseña
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={handleKey}
              placeholder="••••••••"
              className="w-full bg-[#080c14] border border-[#1a2940] rounded-lg px-4 py-3
                         text-white placeholder-[#2a4060] text-sm
                         focus:outline-none focus:border-[#22d3a060] transition-colors"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-800/50 rounded-lg px-4 py-2.5
                          text-red-400 text-xs tracking-wide">
            ⚠ {error}
          </div>
        )}

        {/* Botón principal */}
        <button
          onClick={tab === 'login' ? handleLogin : handleRegister}
          className="w-full py-3.5 rounded-lg font-black text-sm tracking-widest uppercase
                     transition-all active:scale-95 hover:brightness-110"
          style={{ background: 'linear-gradient(135deg, #ef4444, #c0392b)', color: '#fff' }}>
          {tab === 'login' ? '→ ENTRAR AL LOBBY' : '→ CREAR CUENTA'}
        </button>

        {/* Switch tab */}
        <p className="text-center text-[#2a4060] text-xs">
          {tab === 'login'
            ? <>¿No tienes cuenta?{' '}
                <button onClick={() => setTab('register')} className="text-[#22d3a0] hover:underline">
                  Regístrate gratis
                </button></>
            : <>¿Ya tienes cuenta?{' '}
                <button onClick={() => setTab('login')} className="text-[#22d3a0] hover:underline">
                  Inicia sesión
                </button></>
          }
        </p>

      </div>
    </div>
  )
}