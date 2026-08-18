import { useEffect, useRef } from 'react'

// A real-time 3D runway scene for the suite hero: a glowing perspective grid
// receding to a golden horizon, centerline lights streaming toward the
// viewer, edge lights, and drifting gold particles. It reacts to the pointer
// with gentle parallax and follows the site palette (brass / glacier).
// Everything degrades gracefully: reduced motion renders a single static
// frame, WebGL failure keeps the CSS background, and the scene pauses when
// off-screen or the tab is hidden.

const GROUND_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vView;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorld = worldPos.xyz;
    vec4 viewPos = viewMatrix * worldPos;
    vView = viewPos.xyz;
    gl_Position = projectionMatrix * viewPos;
  }
`

const GROUND_FRAGMENT = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  varying vec3 vView;
  uniform vec3 uAccent;
  uniform vec3 uAccentBright;
  uniform vec3 uDeep;
  uniform float uTime;

  float lineMask(vec2 p, float spacing, float width) {
    vec2 g = abs(fract(p / spacing - 0.5) - 0.5) / (width * 0.5);
    float l = min(g.x, g.y);
    return 1.0 - clamp(l, 0.0, 1.0);
  }

  void main() {
    float dist = -vView.z;
    float depth = clamp(dist / 170.0, 0.0, 1.0);
    float fadeIn = smoothstep(0.04, 0.24, depth);
    float fadeOut = 1.0 - smoothstep(0.52, 0.96, depth);

    float grid = lineMask(vWorld.xz, 3.0, 0.055) * 0.85 + lineMask(vWorld.xz, 9.0, 0.032) * 0.55;

    float cx = vWorld.x;
    float inStrip = 1.0 - smoothstep(0.0, 0.75, abs(cx));
    float dash = step(0.45, fract((vWorld.z + uTime * 30.0) / 9.0));
    float center = inStrip * dash * smoothstep(0.08, 0.32, depth);

    float edge = smoothstep(0.34, 0.0, abs(abs(cx) - 8.2));
    float glow = smoothstep(0.5, 0.98, depth) * exp(-abs(cx) * 0.16);

    vec3 color = uDeep;
    color += uAccent * grid * fadeIn * fadeOut * 0.55;
    color += uAccentBright * center * fadeOut * 1.15;
    color += uAccent * edge * fadeOut * 0.85;
    color += uAccentBright * glow * 0.6;

    float alpha = clamp(grid * 0.5 + center * 1.0 + edge * 0.75 + glow * 0.55, 0.0, 1.0) * fadeOut * 0.85;
    gl_FragColor = vec4(color, alpha);
  }
`

export default function Hero3DBackground() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return undefined
    const hero = mount.closest('.hero')
    let disposed = false
    const cleanups = []

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    const start = async () => {
      let THREE
      try {
        THREE = await import('three')
      } catch {
        return
      }
      if (disposed) return

      let renderer
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
      } catch {
        return
      }
      if (disposed) return

      const isMobile = window.innerWidth < 720
      const maxDpr = reduced ? 1 : (isMobile ? 1.3 : 1.6)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr))
      renderer.setSize(mount.clientWidth, mount.clientHeight)
      renderer.domElement.className = 'hero-3d-canvas'
      renderer.domElement.setAttribute('aria-hidden', 'true')
      mount.appendChild(renderer.domElement)
      hero?.classList.add('has-3d-bg')
      cleanups.push(() => {
        hero?.classList.remove('has-3d-bg')
        renderer.domElement.remove()
      })

      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / Math.max(mount.clientHeight, 1), 0.1, 300)
      camera.position.set(0, 1.55, 9)

      const readPalette = () => {
        const styles = getComputedStyle(document.documentElement)
        const color = (value, fallback) => new THREE.Color(value.trim() || fallback)
        return {
          accent: color(styles.getPropertyValue('--accent'), '#c9a227'),
          bright: color(styles.getPropertyValue('--accent-bright'), '#e7c468'),
          deep: new THREE.Color('#07080b'),
        }
      }
      let palette = readPalette()
      const paletteObserver = new MutationObserver(() => {
        palette = readPalette()
        groundUniforms.uAccent.value.copy(palette.accent)
        groundUniforms.uAccentBright.value.copy(palette.bright)
      })
      paletteObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette'] })
      cleanups.push(() => paletteObserver.disconnect())

      // Ground: the runway grid.
      const groundUniforms = {
        uTime: { value: 0 },
        uAccent: { value: palette.accent.clone() },
        uAccentBright: { value: palette.bright.clone() },
        uDeep: { value: palette.deep.clone() },
      }
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(460, 460),
        new THREE.ShaderMaterial({
          vertexShader: GROUND_VERTEX,
          fragmentShader: GROUND_FRAGMENT,
          uniforms: groundUniforms,
          transparent: true,
          depthWrite: false,
        }),
      )
      ground.rotation.x = -Math.PI / 2
      ground.position.set(0, 0, -150)
      scene.add(ground)
      cleanups.push(() => {
        ground.geometry.dispose()
        ground.material.dispose()
      })

      // Drifting gold particles.
      const particleCount = isMobile ? 90 : 220
      const particlePositions = new Float32Array(particleCount * 3)
      for (let index = 0; index < particleCount; index += 1) {
        particlePositions[index * 3] = (Math.random() - 0.5) * 40
        particlePositions[index * 3 + 1] = Math.random() * 9
        particlePositions[index * 3 + 2] = -Math.random() * 60
      }
      const particleGeometry = new THREE.BufferGeometry()
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
      const particles = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
          color: palette.bright,
          size: 0.055,
          transparent: true,
          opacity: 0.75,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      )
      scene.add(particles)
      cleanups.push(() => {
        particleGeometry.dispose()
        particles.material.dispose()
      })

      // Pointer parallax.
      const pointer = { x: 0, y: 0 }
      const onPointerMove = (event) => {
        pointer.x = (event.clientX / window.innerWidth) * 2 - 1
        pointer.y = (event.clientY / window.innerHeight) * 2 - 1
      }
      if (finePointer) window.addEventListener('pointermove', onPointerMove, { passive: true })
      cleanups.push(() => window.removeEventListener('pointermove', onPointerMove))

      const onResize = () => {
        const width = mount.clientWidth
        const height = mount.clientHeight
        renderer.setSize(width, height)
        camera.aspect = width / Math.max(height, 1)
        camera.updateProjectionMatrix()
      }
      const resizeObserver = new ResizeObserver(onResize)
      resizeObserver.observe(mount)
      cleanups.push(() => resizeObserver.disconnect())

      const clock = new THREE.Clock()
      let animationFrame = 0
      let running = true
      cleanups.push(() => cancelAnimationFrame(animationFrame))

      const renderFrame = () => {
        const elapsed = clock.getElapsedTime()
        groundUniforms.uTime.value = elapsed

        if (!reduced) {
          // Camera sway + pointer parallax.
          camera.position.x = Math.sin(elapsed * 0.09) * 0.55 + pointer.x * 0.9
          camera.position.y = 1.55 + Math.cos(elapsed * 0.06) * 0.12 - pointer.y * 0.3
          camera.lookAt(0, 1.35, -30)

          const positions = particleGeometry.attributes.position.array
          for (let index = 0; index < particleCount; index += 1) {
            positions[index * 3 + 1] += 0.0065
            if (positions[index * 3 + 1] > 9) {
              positions[index * 3 + 1] = 0
              positions[index * 3] = (Math.random() - 0.5) * 40
              positions[index * 3 + 2] = -Math.random() * 60
            }
          }
          particleGeometry.attributes.position.needsUpdate = true
        }

        renderer.render(scene, camera)
        if (running) animationFrame = window.requestAnimationFrame(renderFrame)
      }

      // Pause when the hero leaves the viewport or the tab is hidden.
      const visibilityObserver = new IntersectionObserver(([entry]) => {
        running = entry.isIntersecting && !document.hidden
        if (running) {
          cancelAnimationFrame(animationFrame)
          animationFrame = window.requestAnimationFrame(renderFrame)
        }
      }, { threshold: 0 })
      visibilityObserver.observe(mount)
      cleanups.push(() => visibilityObserver.disconnect())

      const onVisibility = () => {
        running = !document.hidden
        if (running) {
          cancelAnimationFrame(animationFrame)
          animationFrame = window.requestAnimationFrame(renderFrame)
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility))

      if (reduced) {
        running = false
        renderFrame()
      } else {
        animationFrame = window.requestAnimationFrame(renderFrame)
      }
    }

    start()

    return () => {
      disposed = true
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  return <div className="hero-3d-mount" ref={mountRef} aria-hidden="true" />
}
