import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- мини-шум (value noise + ridged fbm), без зависимостей ---------- */
function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
const smooth = (t: number) => t * t * (3 - 2 * t);

function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = smooth(x - xi), yf = smooth(y - yi), zf = smooth(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), xf),
      l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), xf), yf),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), xf),
      l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), xf), yf),
    zf
  );
}

/** «Хребтовый» fbm: даёт извилины, похожие на борозды коры */
function ridged(x: number, y: number, z: number, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0;
  for (let i = 0; i < octaves; i++) {
    const n = 1 - Math.abs(noise3(x * freq, y * freq, z * freq) * 2 - 1);
    sum += n * n * amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/* ---------- части мозга ---------- */

function cerebrum() {
  const g = new THREE.IcosahedronGeometry(1, 72);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const d = v.clone();

    // базовая форма: вытянут по Z (лоб → затылок), снизу более плоский
    let x = d.x * 0.80;
    let y = d.y * (d.y < 0 ? 0.52 : 0.72);
    let z = d.z * 1.00;

    // продольная щель между полушариями
    const fissure = Math.exp(-Math.pow(d.x / 0.07, 2)) * smoothstep(-0.1, 0.5, d.y);
    y -= fissure * 0.16;

    // височная доля: лёгкий выступ снизу по бокам
    y -= Math.exp(-Math.pow((Math.abs(d.x) - 0.75) / 0.35, 2)) *
         Math.exp(-Math.pow((d.z - 0.1) / 0.45, 2)) * smoothstep(0.1, -0.5, d.y) * 0.06;

    // борозды и извилины
    const r = ridged(x * 3.4 + 7.3, y * 3.4 + 1.7, z * 3.4 + 4.1);
    const k = (r - 0.45) * 0.17;
    x += d.x * k; y += d.y * k; z += d.z * k;

    p.setXYZ(i, x, y, z);
  }
  return g;
}

function cerebellum() {
  const g = new THREE.IcosahedronGeometry(1, 40);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    // мелкие параллельные «ламели»
    const ripple = Math.sin(v.y * 30 + Math.sin(v.x * 4) * 1.5) * 0.03;
    const s = 1 + ripple;
    p.setXYZ(
      i,
      v.x * 0.46 * s,
      v.y * 0.24 * s - 0.34,
      v.z * 0.34 * s - 0.62
    );
  }
  return g;
}

/** Оставляем только position, чтобы mergeGeometries не ругался на разные атрибуты */
function positionOnly(g: THREE.BufferGeometry) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', g.attributes.position.clone());
  return out;
}

/** Центр в (0,0,0), максимальный размер = 2, гладкие нормали (для «освещения» точек) */
function finalize(geo: THREE.BufferGeometry) {
  const g = mergeVertices(positionOnly(geo), 1e-4);
  g.computeVertexNormals();
  g.computeBoundingBox();
  const size = g.boundingBox!.getSize(new THREE.Vector3());
  const center = g.boundingBox!.getCenter(new THREE.Vector3());
  g.translate(-center.x, -center.y, -center.z);
  const s = 2 / Math.max(size.x, size.y, size.z);
  g.scale(s, s, s);
  return g;
}

/**
 * Мозг без ствола, в профиль: лоб слева, длинная ось вдоль X.
 * По глубине (Z) сплющен — чтобы «висел» над экраном ноутбука, а не торчал из него.
 */
export function createBrainGeometry() {
  const merged = mergeGeometries([cerebrum(), cerebellum()].map(positionOnly));
  merged.rotateY(-Math.PI / 2);
  merged.scale(1, 1, 0.42);
  return finalize(merged);
}
