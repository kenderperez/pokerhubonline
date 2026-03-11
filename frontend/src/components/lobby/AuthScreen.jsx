import { useState } from 'react'
import { useGameStore } from '../../store/gameStore.js'

const USERS_KEY = 'pokerhub_users'
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}') } catch { return {} }
}
function saveUsers(u) { localStorage.setItem(USERS_KEY, JSON.stringify(u)) }

export default function AuthScreen() {
  const setPlayerName = useGameStore(s => s.setPlayerName)
  const [tab,      setTab]      = useState('login')
  const [name,     setName]     = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [busy,     setBusy]     = useState(false)

  const switchTab = (t) => { setTab(t); setError(''); setName(''); setPassword(''); setConfirm('') }

  const submit = () => {
    setError('')
    const u = name.trim()
    if (!u) return setError('Ingresa tu usuario.')
    if (!password) return setError('Ingresa tu contraseña.')
    const users = getUsers()

    if (tab === 'login') {
      if (!users[u])                      return setError('Usuario no encontrado.')
      if (users[u].password !== password) return setError('Contraseña incorrecta.')
    } else {
      if (u.length < 3)                   return setError('Mínimo 3 caracteres.')
      if (password.length < 4)            return setError('Contraseña mínimo 4 caracteres.')
      if (password !== confirm)           return setError('Las contraseñas no coinciden.')
      if (users[u])                       return setError('Ese usuario ya existe.')
      users[u] = { password, createdAt: Date.now() }
      saveUsers(users)
    }

    setBusy(true)
    setTimeout(() => setPlayerName(u), 500)
  }

  const onKey = (e) => e.key === 'Enter' && submit()

  const input = (type, value, onChange, placeholder) => (
    <input
      type={type} value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={onKey}
      placeholder={placeholder}
      style={{
        width: '100%', boxSizing: 'border-box',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 4, padding: '10px 12px',
        color: '#fff', fontSize: 13, fontFamily: 'inherit',
        outline: 'none',
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(255,100,80,0.5)'}
      onBlur={e =>  e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
    />
  )

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '36px 40px 28px',
      fontFamily: "'Rajdhani', sans-serif",
    }}>

      {/* Ícono */}
      <img
        src="/assets/pokerhubSSSSS.png"
        alt="PokerHub"
        style={{ height: 120, objectFit: 'contain', marginBottom: 10 }}
      />

      {/* LOGIN / REGISTRO */}
      <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 5,
                    color: '#e8a020', marginBottom: 28 }}>
        {tab === 'login' ? 'LOGIN' : 'REGISTRO'}
      </div>

      {/* Campos */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>

        <div>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: 2,
                          color: '#888', marginBottom: 5, fontWeight: 700 }}>
            Usuario
          </label>
          {input('text', name, setName, 'Tu usuario')}
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 10, letterSpacing: 2,
                          color: '#888', marginBottom: 5, fontWeight: 700 }}>
            Contraseña
          </label>
          {input('password', password, setPassword, 'Tu contraseña')}
        </div>

        {tab === 'register' && (
          <div>
            <label style={{ display: 'block', fontSize: 10, letterSpacing: 2,
                            color: '#888', marginBottom: 5, fontWeight: 700 }}>
              Confirmar contraseña
            </label>
            {input('password', confirm, setConfirm, 'Repite tu contraseña')}
          </div>
        )}

        {error && (
          <div style={{ color: '#f87171', fontSize: 11, letterSpacing: 0.5,
                        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
                        borderRadius: 4, padding: '8px 12px' }}>
            ⚠ {error}
          </div>
        )}

        {/* Botón */}
        <button onClick={submit} disabled={busy}
          style={{
            width: '100%', padding: '12px 0', marginTop: 4,
            background: busy ? '#7f1d1d' : 'linear-gradient(135deg, #e53e3e 0%, #c0392b 100%)',
            border: 'none', borderRadius: 4,
            color: '#fff', fontSize: 13, fontWeight: 900, letterSpacing: 4,
            cursor: busy ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 2px 16px rgba(220,38,38,0.4)',
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { if (!busy) e.target.style.opacity = '0.85' }}
          onMouseLeave={e => { e.target.style.opacity = '1' }}
        >
          {busy ? '...' : tab === 'login' ? 'ENTRAR' : 'REGISTRARSE'}
        </button>

        {/* Switch */}
        <p style={{ textAlign: 'center', color: '#666', fontSize: 12, margin: '4px 0 0' }}>
          {tab === 'login'
            ? <>¿No tienes cuenta?{' '}
                <button onClick={() => switchTab('register')}
                  style={{ background: 'none', border: 'none', color: '#e8a020',
                           cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                           textDecoration: 'underline', padding: 0 }}>
                  Crear Perfil
                </button></>
            : <>¿Ya tienes cuenta?{' '}
                <button onClick={() => switchTab('login')}
                  style={{ background: 'none', border: 'none', color: '#e8a020',
                           cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                           textDecoration: 'underline', padding: 0 }}>
                  Inicia sesión
                </button></>
          }
        </p>

      </div>
    </div>
  )
}