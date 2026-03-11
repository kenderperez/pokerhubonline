import { useEffect, useRef } from 'react'

export default function LoadingScreen({ message = 'CARGANDO...' }) {
  const mountRef = useRef(null)

  useEffect(() => {
    const container = mountRef.current
    if (!container) return

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
    script.onload = () => initScene(container)
    document.head.appendChild(script)

    let animId = null
    let renderer = null

    function initScene(container) {
      const THREE = window.THREE

      const scene  = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000)
      camera.position.z = 45

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setSize(container.clientWidth, container.clientHeight)
      renderer.setPixelRatio(window.devicePixelRatio)
      renderer.shadowMap.enabled = true
      container.appendChild(renderer.domElement)

      // ── Textura cara ──────────────────────────────────────────
      function createFaceTexture() {
        const c = document.createElement('canvas')
        c.width = c.height = 1024
        const ctx = c.getContext('2d')
        const cx  = 512

        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, 1024, 1024)

        ctx.fillStyle = '#000'
        ctx.beginPath(); ctx.arc(cx, cx, 500, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = '#fff'
        for (let i = 0; i < 6; i++) {
          ctx.save(); ctx.translate(cx, cx); ctx.rotate(i * (Math.PI / 3))
          ctx.fillRect(-120, -512, 240, 300)
          ctx.restore()
        }
        ctx.beginPath(); ctx.arc(cx, cx, 360, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = '#D30000'
        ctx.beginPath(); ctx.arc(cx, cx, 290, 0, Math.PI * 2); ctx.fill()

        ctx.fillStyle = '#fff'
        ctx.font = 'bold 400px Arial'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('♠', cx, cx + 30)

        const tex = new THREE.CanvasTexture(c)
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
        return tex
      }

      // ── Textura borde ─────────────────────────────────────────
      function createEdgeTexture() {
        const c = document.createElement('canvas')
        c.width = 1024; c.height = 64
        const ctx = c.getContext('2d')
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1024, 64)
        ctx.fillStyle = '#fff'
        for (let i = 0; i < 6; i++) ctx.fillRect(i * (1024/6) + 30, 0, 100, 64)
        const tex = new THREE.CanvasTexture(c)
        tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping
        return tex
      }

      // ── Geometría ─────────────────────────────────────────────
      const geometry = new THREE.CylinderGeometry(4, 4, 0.5, 64)
      const props = { roughness: 0.3, metalness: 0.1, clearcoat: 0.5, clearcoatRoughness: 0.2 }

      const chip = new THREE.Mesh(geometry, [
        new THREE.MeshPhysicalMaterial({ ...props, map: createEdgeTexture() }),
        new THREE.MeshPhysicalMaterial({ ...props, map: createFaceTexture() }),
        new THREE.MeshPhysicalMaterial({ ...props, map: createFaceTexture() }),
      ])
      chip.rotation.x = Math.PI / 2.5
      chip.rotation.z = Math.PI / 8
      chip.castShadow = true
      scene.add(chip)

      // ── Luces ─────────────────────────────────────────────────
      scene.add(new THREE.AmbientLight(0xffffff, 0.6))
      const spot = new THREE.SpotLight(0xffffff, 1.5)
      spot.position.set(10, 20, 10); spot.angle = Math.PI / 6; spot.penumbra = 0.5
      scene.add(spot)
      const pt = new THREE.PointLight(0x88ccff, 1, 50)
      pt.position.set(-10, -10, 10); scene.add(pt)

      // ── Animación ─────────────────────────────────────────────
      const clock = new THREE.Clock()
      function animate() {
        animId = requestAnimationFrame(animate)
        chip.rotation.y -= 0.03
        chip.position.y = Math.sin(clock.getElapsedTime() * 2) * 0.3
        renderer.render(scene, camera)
      }
      animate()

      // ── Resize ────────────────────────────────────────────────
      const onResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight
        camera.updateProjectionMatrix()
        renderer.setSize(container.clientWidth, container.clientHeight)
      }
      window.addEventListener('resize', onResize)
    }

    return () => {
      if (animId) cancelAnimationFrame(animId)
      if (renderer) renderer.dispose()
      // Limpiar canvas del DOM
      const canvas = container.querySelector('canvas')
      if (canvas) canvas.remove()
      script.remove()
    }
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#121212',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>

      {/* Canvas Three.js */}
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Viñeta */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        boxShadow: '0 0 200px rgba(0,0,0,0.9) inset',
      }} />

      {/* Texto pulsante */}
      <div style={{
        position: 'absolute', bottom: '15%', left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2, textAlign: 'center',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{
          color: '#fff', fontSize: 20, letterSpacing: 6,
          fontWeight: 800, fontFamily: "'Rajdhani', sans-serif",
          textTransform: 'uppercase',
          animation: 'loadpulse 1.5s infinite',
        }}>
          {message}
        </div>
      </div>

      <style>{`
        @keyframes loadpulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>
    </div>
  )
}