import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

/* ======================================================================
 * Атлас символов 4x4 (ячейка 64px).
 * 0 и 1 рисуем линиями — одинаково на любой ОС, остальные — шрифтом.
 * ====================================================================== */
export function makeGlyphAtlas() {
  const S = 64;
  const c = document.createElement('canvas');
  c.width = c.height = S * 4;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const cell = (i: number) => ({ cx: (i % 4) * S + S / 2, cy: Math.floor(i / 4) * S + S / 2 });

  // 0
  {
    const { cx, cy } = cell(0);
    g.lineWidth = 7;
    g.beginPath();
    g.ellipse(cx, cy, 14, 22, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // 1
  {
    const { cx, cy } = cell(1);
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(cx - 9, cy - 12);
    g.lineTo(cx + 2, cy - 23);
    g.lineTo(cx + 2, cy + 23);
    g.stroke();
  }
  // программистские символы
  const chars = ['{', '}', '<', '>', '/', '=', ';', '#', '+', '$', '*', '&', 'A', 'F'];
  g.font = 'bold 44px Menlo, Consolas, "DejaVu Sans Mono", "Courier New", monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  chars.forEach((ch, i) => {
    const { cx, cy } = cell(i + 2);
    g.fillText(ch, cx, cy + 2);
  });

  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

/* ======================================================================
 * Шейдеры.
 * Положение каждой частицы — аналитическая функция фазы t ∈ [0,1]:
 *   0 … 0.56   разлёт (ease-out, дуга в сторону)
 *   0.56 … 0.72 парение в облаке (дрейф)
 *   0.60 … 1.0 возврат (ease-in-out, дуга в другую сторону)
 * У каждой частицы своя задержка (aDelay), поэтому всё течёт волной.
 * Шлейфы — те же частицы, посчитанные в момент t - lag.
 * ====================================================================== */
const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aDelay;
  attribute float aDist;
  attribute vec3 aNormal;
  attribute vec3 aDir;
  attribute vec3 aAxis;

  uniform float uTime, uPhase, uPR, uLag, uMode, uSize;

  varying float vCell, vY, vLight, vS, vTrail, vSeed;

  const float PI = 3.14159265;

  float easeOut(float x) { return 1.0 - pow(1.0 - x, 3.0); }
  float easeInOut(float x) { return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }

  vec3 pathPos(float t, out float sAmt) {
    float d = aDelay;
    float e = easeOut(clamp((t - d * 0.14) / 0.42, 0.0, 1.0));
    float r = easeInOut(clamp((t - 0.60 - (1.0 - d) * 0.12) / 0.28, 0.0, 1.0));
    float s = e * (1.0 - r);
    sAmt = s;

    vec3 p = position + aDir * aDist * s;

    // дуга: на разлёте уходит в одну сторону, на возврате — в другую
    vec3 side = normalize(cross(aDir, aAxis) + vec3(1e-5));
    float swirl = sin(PI * e) * (1.0 - r) - sin(PI * r) * e;
    p += side * aDist * 0.28 * swirl;

    // парение в облаке
    float hold = e * (1.0 - r);
    p += vec3(
      sin(uTime * 0.8 + aSeed * 40.0),
      cos(uTime * 0.65 + aSeed * 31.0),
      sin(uTime * 0.55 + aSeed * 17.0)
    ) * 0.10 * hold;

    // лёгкая «гравитация»
    p.y -= 0.10 * aDist * s * s;
    return p;
  }

  void main() {
    float sNow, sLag;
    vec3 pNow = pathPos(uPhase, sNow);
    vec3 pLag = pathPos(max(uPhase - uLag, 0.0), sLag);

    bool trail = uMode > 0.5;
    vec3 pos = trail ? pLag : pNow;
    float s = trail ? sLag : sNow;

    // «дыхание» собранного мозга
    pos += aNormal * sin(uTime * 1.4 + aSeed * 6.2831) * 0.008 * (1.0 - s);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.7 + aSeed * 0.6) * (1.0 + s * 0.2) * (trail ? 0.75 : 1.0);
    gl_PointSize = min(size * uPR * (6.5 / -mv.z), 16.0 * uPR);

    // символ периодически меняется: ~64% нули и единицы, остальное — программистские знаки
    float tick = floor(uTime * (0.25 + aSeed * 0.6) + aSeed * 100.0);
    float h = fract(sin(tick * 12.9898 + aSeed * 78.233) * 43758.5453);
    float h2 = fract(h * 7.13 + aSeed * 3.7);
    vCell = h < 0.64 ? floor(h2 * 2.0) : 2.0 + floor(h2 * 14.0);

    // «освещение»: точки, обращённые к камере, ярче; в полёте — равномерно ярко
    float facing = normalize(normalMatrix * aNormal).z;
    float lit = 0.20 + 0.80 * smoothstep(-0.3, 0.9, facing);
    vLight = mix(lit, 1.0, clamp(s * 1.5, 0.0, 1.0));

    vY = position.y;
    vS = s;
    vSeed = aSeed;
    vTrail = trail ? smoothstep(0.0, 0.18, length(pNow - pLag)) : 1.0;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uTop, uBottom;
  uniform float uGain, uMode;

  varying float vCell, vY, vLight, vS, vTrail, vSeed;

  void main() {
    float col = mod(vCell, 4.0);
    float row = floor(vCell / 4.0);
    // gl_PointCoord.y растёт сверху вниз, а у CanvasTexture v растёт снизу вверх
    vec2 uv = vec2((col + gl_PointCoord.x) / 4.0, 1.0 - (row + gl_PointCoord.y) / 4.0);
    float a = texture2D(uMap, uv).a;
    if (a < 0.08) discard;

    vec3 neon = vec3(0.125, 0.72, 0.48);
    vec3 base = mix(uBottom, uTop, smoothstep(-0.45, 0.55, vY));
    vec3 c = mix(base, neon, vS * 0.85);
    // core (low |y|, centre) warmer ivory, outer shell emerald/mint; kept below clipping
    float bright = (0.42 + 0.4 * vLight) * (1.0 + vS * 0.25);
    float alpha = a * vLight * (0.65 + 0.35 * vSeed);

    if (uMode > 0.5) {
      c = neon;
      bright = 0.8;
      alpha = a * vTrail * uGain;
    }
    gl_FragColor = vec4(c * bright, alpha);
  }
`;

export interface ParticleMaterialOptions { lag?: number; mode?: number; gain?: number; size?: number; pixelRatio?: number }
export function createParticleMaterial(atlas: THREE.Texture, { lag = 0, mode = 0, gain = 0.4, size = 5.5, pixelRatio = 1 }: ParticleMaterialOptions = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: mode > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uMap: { value: atlas },
      uTime: { value: 0 },
      uPhase: { value: 1 },
      uPR: { value: pixelRatio },
      uLag: { value: lag },
      uMode: { value: mode },
      uGain: { value: gain },
      uSize: { value: size },
      uTop: { value: new THREE.Vector3(0.72, 0.92, 0.83) },
      uBottom: { value: new THREE.Vector3(0.13, 0.62, 0.42) },
    },
  });
}

/** Геометрия частиц: точки на поверхности мозга + параметры траекторий */
export function createParticleGeometry(brainGeometry: THREE.BufferGeometry, count: number) {
  const sampler = new MeshSurfaceSampler(new THREE.Mesh(brainGeometry)).build();

  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const dir = new Float32Array(count * 3);
  const axis = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const delay = new Float32Array(count);
  const dist = new Float32Array(count);

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const rnd = new THREE.Vector3();
  const d = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    sampler.sample(v, n);
    pos.set([v.x, v.y, v.z], i * 3);
    nor.set([n.x, n.y, n.z], i * 3);

    // направление разлёта: наружу от центра + случайность, чтобы получился объёмный «взрыв»
    rnd.randomDirection();
    d.copy(v).normalize().multiplyScalar(0.55).addScaledVector(rnd, 0.9);
    d.z *= 0.35; // разлёт в основном в плоскости экрана: частицы не летят в камеру
    d.y *= 0.8;  // чуть шире, чем выше — облако остаётся вокруг ноутбука
    d.normalize();
    dir.set([d.x, d.y, d.z], i * 3);

    rnd.randomDirection();
    axis.set([rnd.x, rnd.y, rnd.z], i * 3);

    const r = Math.random();
    seed[i] = Math.random();
    dist[i] = 0.8 + Math.pow(r, 0.9) * 1.7;
    // волна: частицы слева стартуют чуть раньше, плюс случайность
    delay[i] = Math.min(Math.max(0.5 + v.x * 0.25 + (Math.random() - 0.5) * 0.55, 0), 1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aNormal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  g.setAttribute('aAxis', new THREE.BufferAttribute(axis, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aDelay', new THREE.BufferAttribute(delay, 1));
  g.setAttribute('aDist', new THREE.BufferAttribute(dist, 1));
  return g;
}
