import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Тёмное зелёное свечение экрана (картинка для материала экрана) */
function makeScreenTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 640;
  const g = c.getContext('2d')!;
  g.fillStyle = '#020507';
  g.fillRect(0, 0, c.width, c.height);
  const grad = g.createRadialGradient(512, 330, 20, 512, 330, 520);
  grad.addColorStop(0, 'rgba(18,90,52,0.55)');
  grad.addColorStop(0.55, 'rgba(8,38,24,0.30)');
  grad.addColorStop(1, 'rgba(2,6,8,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Открытый ноутбук, собранный из примитивов. Вид спереди.
 * Возвращает: group, lid (крышка с экраном), screenMaterial, brainAnchor (куда ставить мозг).
 */
export function createLaptop() {
  const group = new THREE.Group();

  const W = 3.4;      // ширина
  const D = 2.3;      // глубина основания
  const BH = 0.09;    // толщина основания
  const LH = 2.2;     // высота крышки

  const aluminium = new THREE.MeshStandardMaterial({ color: 0x1c1f26, metalness: 0.92, roughness: 0.36 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0b0d11, metalness: 0.7, roughness: 0.5 });

  /* ---------- основание ---------- */
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, BH, D, 4, 0.04), aluminium);
  base.position.y = BH / 2;
  group.add(base);

  const deck = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, D - 0.22), darkMetal);
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, BH + 0.0008, 0.0);
  group.add(deck);

  /* ---------- клавиатура: инстансы клавиш ---------- */
  const keys: { x: number; z: number; w: number }[] = [];
  const pitch = 0.215;
  const rowZ = (i: number) => -0.92 + i * 0.205;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 14; col++) {
      keys.push({ x: (col - 6.5) * pitch, z: rowZ(row), w: 0.2 });
    }
  }
  // нижний ряд: 4 клавиши, пробел, 3 клавиши
  for (let i = 0; i < 4; i++) keys.push({ x: -1.5 + i * pitch, z: rowZ(4), w: 0.2 });
  keys.push({ x: 0.0, z: rowZ(4), w: 1.28 });
  for (let i = 0; i < 3; i++) keys.push({ x: 1.0 + i * pitch, z: rowZ(4), w: 0.2 });

  const keyMat = new THREE.MeshStandardMaterial({
    color: 0x0f1217, metalness: 0.5, roughness: 0.42,
    emissive: 0x03140a, emissiveIntensity: 1.0,
  });
  const keyMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.03, 0.17), keyMat, keys.length);
  const m = new THREE.Matrix4();
  keys.forEach((k, i: number) => {
    m.compose(
      new THREE.Vector3(k.x, BH + 0.015, k.z),
      new THREE.Quaternion(),
      new THREE.Vector3(k.w / 0.2, 1, 1)
    );
    keyMesh.setMatrixAt(i, m);
  });
  group.add(keyMesh);

  /* ---------- тачпад ---------- */
  const pad = new THREE.Mesh(
    new RoundedBoxGeometry(1.2, 0.008, 0.72, 2, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x1f232b, metalness: 0.8, roughness: 0.3 })
  );
  pad.position.set(0, BH + 0.003, 0.7);
  group.add(pad);

  /* ---------- петля ---------- */
  const hinge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, W - 0.5, 20),
    darkMetal
  );
  hinge.rotation.z = Math.PI / 2;
  hinge.position.set(0, BH + 0.03, -D / 2 + 0.04);
  group.add(hinge);

  /* ---------- крышка ---------- */
  const lid = new THREE.Group();
  lid.position.set(0, BH + 0.035, -D / 2 + 0.05);
  lid.rotation.x = -0.28; // откинута назад
  group.add(lid);

  const shell = new THREE.Mesh(new RoundedBoxGeometry(W, LH, 0.06, 4, 0.03), aluminium);
  shell.position.y = LH / 2 + 0.02;
  lid.add(shell);

  const bezel = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.1, LH - 0.1),
    new THREE.MeshBasicMaterial({ color: 0x010203 })
  );
  bezel.position.set(0, LH / 2 + 0.02, 0.0312);
  lid.add(bezel);

  const screenMaterial = new THREE.MeshBasicMaterial({
    map: makeScreenTexture(),
    toneMapped: false,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.16, 1.98), screenMaterial);
  screen.position.set(0, LH / 2 + 0.05, 0.0318);
  lid.add(screen);

  // точка, куда ставится мозг (над центром экрана)
  const brainAnchor = new THREE.Group();
  brainAnchor.position.set(0, LH / 2 + 0.06, 0.36);
  lid.add(brainAnchor);

  return { group, lid, screen, screenMaterial, brainAnchor };
}
