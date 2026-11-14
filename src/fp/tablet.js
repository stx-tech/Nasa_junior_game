// Rugged field tablet — procedural Three.js model (no external assets).
//
// Units: metres. Local axes of `tabletRoot`: +x right, +y up, +z toward the
// viewer (the screen normal). Origin = centre of the device.
// Named nodes:
//   tabletRoot   — the whole device; move/rotate this.
//   device       — body + screen; rotated 90° in portrait mode.
//   screenAnchor — centre of the screen surface; userData.size = { width, height }
//                  in metres for the CURRENT orientation (HTML overlay goes here).
//   gripLeft / gripRight — middle of the left/right edges where gloves hold it;
//                  +x of the anchor points away from the device (outward).
import * as THREE from 'three';

export const TABLET_SIZE = { width: 0.30, height: 0.205, depth: 0.03 };
export const SCREEN_SIZE = { width: 0.252, height: 0.158 }; // ~16:10, recessed 3 mm
const CORNER = 0.026;

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function roundedPath(w, h, r) {
  const p = new THREE.Path();
  const x = -w / 2, y = -h / 2;
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y);
  p.quadraticCurveTo(x + w, y, x + w, y + r);
  p.lineTo(x + w, y + h - r);
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  p.lineTo(x + r, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - r);
  p.lineTo(x, y + r);
  p.quadraticCurveTo(x, y, x + r, y);
  return p;
}

function slab(shape, depth, bevel = 0.003) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.0005, depth - 2 * bevel), bevelEnabled: true,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10,
  });
  g.translate(0, 0, -(depth - 2 * bevel) / 2);
  return g;
}

function screenIdleTexture() {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 400;
  const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.setText = (title, status) => { draw(title, status); t.needsUpdate = true; };
  draw('MISSION TABLET', 'Base link ready');
  return t;
  function draw(title, status) {
  ctx.clearRect(0, 0, 640, 400);
  const g = ctx.createLinearGradient(0, 0, 0, 400);
  g.addColorStop(0, '#0f2a33');
  g.addColorStop(1, '#081820');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 640, 400);
  ctx.strokeStyle = 'rgba(120, 220, 210, 0.08)';
  ctx.lineWidth = 1;
  for (let x = 0; x < 640; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 400); ctx.stroke(); }
  for (let y = 0; y < 400; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(640, y); ctx.stroke(); }
  ctx.fillStyle = '#9ee3de';
  ctx.font = '700 34px system-ui, Arial, sans-serif';
  ctx.fillText(title, 40, 70);
  ctx.fillStyle = 'rgba(158, 227, 222, 0.55)';
  ctx.font = '500 22px system-ui, Arial, sans-serif';
  ctx.fillText(status, 40, 110);
  ctx.fillStyle = '#58c27d';
  ctx.beginPath(); ctx.arc(600, 58, 10, 0, Math.PI * 2); ctx.fill();
  }
}

function labelTexture(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 64;
  const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.userData.setText = (s) => { draw(s); t.needsUpdate = true; };
  draw(text);
  return t;
  function draw(text) {
  ctx.fillStyle = '#d9d6cf';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#3a3f47';
  ctx.font = '700 34px system-ui, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 34;
  while (ctx.measureText(text).width > 480 && size > 18) { size -= 2; ctx.font = `700 ${size}px system-ui, Arial, sans-serif`; }
  ctx.fillText(text, 256, 34);
  }
}

export function createTabletModel() {
  const { width: W, height: H, depth: D } = TABLET_SIZE;
  const { width: SW, height: SH } = SCREEN_SIZE;

  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: 0xdedbd3, roughness: 0.7, metalness: 0.05 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.95 }),
    bezel: new THREE.MeshStandardMaterial({ color: 0x1b2026, roughness: 0.6 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe9832b, roughness: 0.55 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x9aa1aa, roughness: 0.4, metalness: 0.7 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: screenIdleTexture(), emissiveIntensity: 0.9, roughness: 0.25, metalness: 0 }),
  };

  const tabletRoot = new THREE.Group();
  tabletRoot.name = 'tabletRoot';
  const device = new THREE.Group();
  device.name = 'device';
  tabletRoot.add(device);

  // Body: light hull, slightly thinner than the rubber corners.
  const body = new THREE.Mesh(slab(roundedRect(W - 0.004, H - 0.004, CORNER), D - 0.004, 0.004), mats.hull);
  device.add(body);
  // Dark front bezel plate with the screen hole (recess).
  const bezelShape = roundedRect(SW + 0.012, SH + 0.012, 0.01);
  bezelShape.holes.push(roundedPath(SW + 0.002, SH + 0.002, 0.006));
  const bezel = new THREE.Mesh(slab(bezelShape, 0.004, 0.0012), mats.bezel);
  bezel.position.z = D / 2 + 0.0005;
  device.add(bezel);
  // Screen, recessed below the bezel surface.
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), mats.screen);
  screen.name = 'screen';
  screen.position.z = D / 2 - 0.0015;
  device.add(screen);
  const screenAnchor = new THREE.Object3D();
  screenAnchor.name = 'screenAnchor';
  screenAnchor.position.z = D / 2 - 0.0015;
  device.add(screenAnchor);

  // Rubber corner bumpers (thicker than the body).
  const cornerGeo = slab(roundedRect(0.058, 0.058, 0.026), D + 0.006, 0.004);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const c = new THREE.Mesh(cornerGeo, mats.rubber);
    // 6 mm beyond the hull outline; front face 3 mm behind the hull face, so from the
    // front it reads as a rubber rim around each corner and never covers the screen.
    c.position.set(sx * (W / 2 - 0.023), sy * (H / 2 - 0.023), (D / 2 - 0.005) - (D + 0.006) / 2);
    device.add(c);
  }
  // Ribbed rubber grips on the left/right edges (where the gloves hold).
  const ribGeo = new THREE.BoxGeometry(0.006, 0.008, D - 0.01);
  for (const sx of [-1, 1]) {
    for (let i = -3; i <= 3; i++) {
      const rib = new THREE.Mesh(ribGeo, mats.rubber);
      rib.position.set(sx * (W / 2 - 0.0005), i * 0.013, -0.003);
      device.add(rib);
    }
  }
  // Physical controls sized for gloves: big orange power key + ribbed dial on top edge.
  const power = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 20), mats.orange);
  power.position.set(W / 2 - 0.07, H / 2 + 0.004, 0.002);
  device.add(power);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 16), mats.metal);
  dial.position.set(-W / 2 + 0.075, H / 2 + 0.005, 0);
  device.add(dial);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.012, 0.004), mats.rubber);
    k.position.set(dial.position.x + Math.cos(a) * 0.014, dial.position.y + 0.001, Math.sin(a) * 0.014);
    k.rotation.y = -a;
    device.add(k);
  }
  // Small label on the top bezel.
  const labelTex = labelTexture('FIELD UNIT 01');
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.0094), new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false }));
  label.position.set(0, SH / 2 + (H - SH) / 4 + 0.001, D / 2 + 0.0004);
  device.add(label);
  // Back plate with a strap.
  const strap = new THREE.Mesh(new THREE.BoxGeometry(W * 0.62, 0.035, 0.006), mats.rubber);
  strap.position.set(0, 0, -D / 2 - 0.003);
  device.add(strap);

  // Grip anchors live on tabletRoot so they stay on the left/right in both orientations.
  const gripLeft = new THREE.Object3D();
  gripLeft.name = 'gripLeft';
  gripLeft.scale.x = -1; // mirrored: +x local points outward (to the left)
  const gripRight = new THREE.Object3D();
  gripRight.name = 'gripRight';
  tabletRoot.add(gripLeft, gripRight);

  let orientation = 'landscape';
  function setOrientation(next) {
    orientation = next;
    const portrait = next === 'portrait';
    device.rotation.z = portrait ? Math.PI / 2 : 0;
    const halfW = (portrait ? H : W) / 2;
    gripLeft.position.set(-halfW, portrait ? -0.03 : -0.01, 0);
    gripRight.position.set(halfW, portrait ? -0.03 : -0.01, 0);
    screenAnchor.userData.size = portrait ? { width: SH, height: SW } : { width: SW, height: SH };
  }
  setOrientation('landscape');

  function dispose() {
    tabletRoot.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) { o.material.map?.dispose(); o.material.emissiveMap?.dispose(); o.material.dispose(); }
    });
  }

  return {
    tabletRoot, device, screenAnchor, gripLeft, gripRight, screenMaterial: mats.screen,
    setOrientation,
    // Language switch: t(key) from src/i18n.js
    setTexts(t) {
      labelTex.userData.setText(t('tablet.unit'));
      mats.screen.emissiveMap.userData.setText(t('tablet.idleTitle'), t('tablet.idleStatus'));
    },
    get orientation() { return orientation; },
    get size() { return orientation === 'portrait' ? { width: H, height: W, depth: D } : { width: W, height: H, depth: D }; },
    dispose,
  };
}
