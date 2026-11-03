import * as THREE from 'three'

function radialTexture(stops: [number, string][]) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
  stops.forEach(([o, col]) => grad.addColorStop(o, col))
  g.fillStyle = grad
  g.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Soft contact shadow + faint emerald floor bounce under the laptop (planes, no extra lights). */
export function createFloor() {
  const group = new THREE.Group()
  const shadowTex = radialTexture([[0, 'rgba(0,0,0,0.95)'], [0.55, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']])
  const glowTex = radialTexture([[0, 'rgba(32,183,123,0.5)'], [0.5, 'rgba(8,122,80,0.18)'], [1, 'rgba(8,122,80,0)']])
  const amberTex = radialTexture([[0, 'rgba(197,138,80,0.35)'], [1, 'rgba(197,138,80,0)']])
  const make = (tex: THREE.Texture, w: number, d: number, y: number, x = 0, z = 0.1, blending: THREE.Blending = THREE.NormalBlending) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending, toneMapped: false }),
    )
    m.rotation.x = -Math.PI / 2
    m.position.set(x, y, z)
    return m
  }
  group.add(make(glowTex, 5.6, 4.2, -0.012, 0, 0.2, THREE.AdditiveBlending))
  group.add(make(amberTex, 2.8, 2.0, -0.01, 1.3, 0.5, THREE.AdditiveBlending))
  group.add(make(shadowTex, 4.8, 3.3, -0.006, 0.05, 0.15))
  return { group, dispose: () => group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); const mat = m.material as THREE.MeshBasicMaterial; mat.map?.dispose(); mat.dispose() } }) }
}

/** Fine neural pathways: each sampled surface point links to a couple of near neighbours. */
export function createNeuralLines(geometry: THREE.BufferGeometry, samples = 520, maxDist = 0.34) {
  const src = geometry.getAttribute('position')
  const step = Math.max(1, Math.floor(src.count / samples))
  const pts: THREE.Vector3[] = []
  for (let i = 0; i < src.count; i += step) pts.push(new THREE.Vector3().fromBufferAttribute(src, i))
  const verts: number[] = []
  const used = new Set<string>()
  pts.forEach((a, i) => {
    const near = pts
      .map((b, j) => ({ j, d: i === j ? Infinity : a.distanceTo(b) }))
      .filter((o) => o.d < maxDist)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2)
    for (const { j } of near) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`
      if (used.has(key)) continue
      used.add(key)
      verts.push(a.x, a.y, a.z, pts[j].x, pts[j].y, pts[j].z)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  const mat = new THREE.LineBasicMaterial({ color: 0x20b77b, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
  const lines = new THREE.LineSegments(g, mat)
  lines.frustumCulled = false
  return lines
}

/** Dim warm-ivory core so the centre reads brighter than the emerald shell. */
export function createCore() {
  const tex = radialTexture([[0, 'rgba(243,242,233,0.38)'], [0.25, 'rgba(184,235,211,0.22)'], [1, 'rgba(32,183,123,0)']])
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }))
  sprite.scale.set(1.5, 1.2, 1)
  return sprite
}
