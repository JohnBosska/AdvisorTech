/* eslint-disable react-hooks/purity, react-hooks/immutability -- imperative three.js scene: objects are mutated by design inside useFrame/effects */
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { createBrainGeometry } from './brain'
import { createLaptop } from './laptop'
import { createParticleGeometry, createParticleMaterial, makeGlyphAtlas } from './particles'

// Port of the supplied brain-laptop prototype. The animation phase t∈[0,1] drives everything:
// 0 = brain assembled, 0…0.56 scatter, 0.56…0.72 hover, 0.60…1 reassemble (per-particle delay).
const EXPLOSION_SECONDS = 8.5
const INTRO_SECONDS = 3.6
const BLOOM_BASE = 0.34
const BLOOM_PEAK = 0.5
const SCREEN_LIGHT_MAX = 7

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1)
const scatterAmount = (t: number) => easeOut(clamp01((t - 0.07) / 0.42)) * (1 - easeInOut(clamp01((t - 0.66) / 0.28)))

interface SceneProps { reducedMotion: boolean; points: number; trigger: React.RefObject<(() => void) | null> }

function Scene({ reducedMotion, points, trigger }: SceneProps) {
  const { gl, scene, camera, size } = useThree()
  const pr = Math.min(gl.getPixelRatio(), 2)
  const phase = useRef({ value: reducedMotion ? 0 : 0.6, from: 0.6, to: 1, start: performance.now(), duration: INTRO_SECONDS * 1000, running: !reducedMotion })
  const mouse = useRef({ x: 0, y: 0, sx: 0, sy: 0 })

  const parts = useMemo(() => {
    const laptop = createLaptop()
    const atlas = makeGlyphAtlas()
    const brainGeo = createBrainGeometry()
    const particleGeo = createParticleGeometry(brainGeo, points)
    const mainMat = createParticleMaterial(atlas, { lag: 0, mode: 0, size: 7.4, pixelRatio: pr })
    const trailMats = [0.014, 0.028, 0.044].map((lag, i) => createParticleMaterial(atlas, { lag, mode: 1, gain: 0.22 - i * 0.06, size: 6.4, pixelRatio: pr }))
    const brain = new THREE.Group()
    brain.scale.setScalar(1.3)
    ;[...trailMats, mainMat].forEach((mat, idx) => {
      const pts = new THREE.Points(particleGeo, mat)
      pts.frustumCulled = false
      pts.renderOrder = idx
      brain.add(pts)
    })
    laptop.brainAnchor.add(brain)
    const screenLight = new THREE.PointLight(0x39ff85, SCREEN_LIGHT_MAX, 6, 1.6)
    screenLight.position.set(0, 0, 0.9)
    laptop.brainAnchor.add(screenLight)
    return { laptop, brain, screenLight, materials: [mainMat, ...trailMats], geometries: [brainGeo, particleGeo], atlas }
  }, [points, pr])

  const composer = useMemo(() => {
    const c = new EffectComposer(gl, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }))
    c.addPass(new RenderPass(scene, camera))
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM_BASE, 0.5, 0.55))
    c.addPass(new OutputPass())
    return c
  }, [gl, scene, camera])

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1
    scene.background = null
    const ambient = new THREE.AmbientLight(0x0c1210, 1)
    const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6)
    rim.position.set(-3.5, 4.5, -2.5)
    const fill = new THREE.DirectionalLight(0x5cffa0, 0.25)
    fill.position.set(3.5, 2, 3)
    scene.add(ambient, rim, fill, parts.laptop.group)
    return () => {
      scene.remove(ambient, rim, fill, parts.laptop.group)
      parts.materials.forEach((m) => m.dispose())
      parts.geometries.forEach((g) => g.dispose())
      parts.atlas.dispose()
      composer.dispose()
    }
  }, [gl, scene, parts, composer])

  useEffect(() => {
    composer.setPixelRatio(pr)
    composer.setSize(size.width, size.height)
    const cam = camera as THREE.PerspectiveCamera
    cam.fov = 35
    cam.updateProjectionMatrix()
  }, [composer, size, pr, camera])

  useEffect(() => {
    trigger.current = () => {
      const p = phase.current
      if (p.running || reducedMotion) return
      Object.assign(p, { from: 0, to: 1, start: performance.now(), duration: EXPLOSION_SECONDS * 1000, value: 0, running: true })
    }
    const onMove = (e: PointerEvent) => { mouse.current.x = e.clientX / window.innerWidth - 0.5; mouse.current.y = e.clientY / window.innerHeight - 0.5 }
    window.addEventListener('pointermove', onMove)
    return () => { trigger.current = null; window.removeEventListener('pointermove', onMove) }
  }, [trigger, reducedMotion])

  const elapsed = useRef(0)
  useFrame((state, delta) => {
    elapsed.current += delta
    const p = phase.current
    if (p.running) {
      const k = clamp01((performance.now() - p.start) / p.duration)
      p.value = p.from + (p.to - p.from) * k
      if (k >= 1) { p.running = false; p.value = p.to }
    }
    const sg = scatterAmount(p.value)
    for (const m of parts.materials) { m.uniforms.uTime.value = elapsed.current; m.uniforms.uPhase.value = p.value }
    const bloom = composer.passes[1] as UnrealBloomPass
    bloom.strength = BLOOM_BASE + (BLOOM_PEAK - BLOOM_BASE) * sg
    parts.screenLight.intensity = SCREEN_LIGHT_MAX * (1 - 0.8 * sg)
    parts.laptop.screenMaterial.color.setScalar(1 - 0.85 * sg)

    const m = mouse.current
    m.sx += (m.x - m.sx) * 0.05
    m.sy += (m.y - m.sy) * 0.05
    const idle = reducedMotion ? 0 : 1
    const t = elapsed.current
    parts.laptop.group.rotation.y = Math.sin(t * 0.3) * 0.04 * idle + m.sx * 0.28 * idle
    parts.laptop.group.rotation.x = m.sy * 0.06 * idle
    parts.laptop.group.position.y = Math.sin(t * 0.7) * 0.025 * idle
    parts.brain.rotation.y = Math.sin(t * 0.45) * 0.16 * idle

    const aspect = size.width / size.height
    const baseZ = aspect < 1.4 ? 6.6 * (1.4 / Math.max(aspect, 0.5)) * 0.92 : 6.6
    state.camera.position.set(0, 2.5, baseZ * (1 - 0.03 * sg))
    state.camera.lookAt(0, 1, 0)
    composer.render(delta)
  }, 1)

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.object instanceof THREE.Mesh) { e.stopPropagation(); trigger.current?.() }
  }
  return <primitive object={parts.laptop.group} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')} />
}

export default function BrainLaptopScene({ reducedMotion, points, active, trigger }: { reducedMotion: boolean; points: number; active: boolean; trigger: React.RefObject<(() => void) | null> }) {
  return (
    <Canvas
      frameloop={active ? 'always' : 'never'}
      dpr={[1, 2]}
      camera={{ position: [0, 2.5, 6.6], fov: 35 }}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
    >
      <Scene reducedMotion={reducedMotion} points={points} trigger={trigger} />
    </Canvas>
  )
}
