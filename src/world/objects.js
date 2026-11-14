// Shared in-world objects for every map: the command console, sample rocks with
// the lab tray, and the guide marker (light beam + arrow over the next target).
import * as THREE from 'three';
import { canvasTexture } from '../scenes/moon/textures.js';

const FONT = '"Segoe UI", Arial, sans-serif';
function fitText(ctx, text, weight, size, maxW) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  while (ctx.measureText(text).width > maxW && size > 14) { size -= 2; ctx.font = `${weight} ${size}px ${FONT}`; }
}
const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...opts });

// Distance from (x, z) to an interactable's shape: { circle: [x, z, r] } or { box: [minX, maxX, minZ, maxZ] }.
export function shapeDistance(shape, x, z) {
  if (shape.circle) {
    const [cx, cz, r] = shape.circle;
    return Math.max(0, Math.hypot(x - cx, z - cz) - r);
  }
  const [minX, maxX, minZ, maxZ] = shape.box;
  const dx = Math.max(minX - x, 0, x - maxX);
  const dz = Math.max(minZ - z, 0, z - maxZ);
  return Math.hypot(dx, dz);
}

// ---------- Command console: one place to run the shift ----------
// setScreen({ title, planned, budget, button, ok, over }) — strings already translated.
export function buildConsole(heightAt, { x, z, yaw = 0 }) {
  const g = new THREE.Group();
  const dark = M(0x2c3038, { metalness: 0.4 });
  const light = M(0xb9bec6, { metalness: 0.5 });
  const accent = M(0x5ee1ff, { emissive: 0x2a8fb0, emissiveIntensity: 0.6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.95, 0.8), dark);
  base.position.y = 0.475;
  base.castShadow = base.receiveShadow = true;
  g.add(base);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.08, 0.82), accent);
  stripe.position.y = 0.85;
  g.add(stripe);
  // Slanted screen facing the player (+z)
  const c = document.createElement('canvas');
  c.width = 640; c.height = 400;
  const ctx = c.getContext('2d');
  const tex = canvasTexture(c);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.72), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0.05);
  head.rotation.x = -0.75;
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.84, 0.08), dark);
  bezel.castShadow = true;
  head.add(bezel);
  screen.position.z = 0.045;
  head.add(screen);
  g.add(head);
  // Big round button on the deck in front of the screen
  const btnMat = M(0x3fbf6f, { emissive: 0x1f8f4a, emissiveIntensity: 0.6, roughness: 0.4 });
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.08, 24), btnMat);
  button.position.set(0.45, 0.99, 0.3);
  g.add(button);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), light);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.45, 0.96, 0.3);
  g.add(ring);
  // Mast with a cyan beacon so the console is easy to find
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.6, 6), light);
  mast.position.set(-0.55, 1.75, -0.3);
  g.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10), accent);
  beacon.position.set(-0.55, 2.6, -0.3);
  g.add(beacon);
  // Name board on the mast
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 112;
  const sctx = sc.getContext('2d');
  const stex = canvasTexture(sc);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.27), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false, side: THREE.DoubleSide }));
  sign.position.set(-0.55, 2.25, -0.27);
  g.add(sign);
  function drawSign(text) {
    sctx.fillStyle = '#10151d'; sctx.fillRect(0, 0, 512, 112);
    sctx.fillStyle = '#5ee1ff'; sctx.fillRect(0, 100, 512, 12);
    sctx.fillStyle = '#f4f1e8'; fitText(sctx, text, 800, 54, 470);
    sctx.textAlign = 'center'; sctx.textBaseline = 'middle'; sctx.fillText(text, 256, 52);
    stex.needsUpdate = true;
  }
  drawSign('COMMAND CONSOLE');

  let last = null;
  function setScreen(s) {
    last = s;
    ctx.fillStyle = '#0d131b'; ctx.fillRect(0, 0, 640, 400);
    ctx.strokeStyle = s.ok ? '#5ee1ff' : '#ff8a73'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 630, 390);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#9ee3de'; fitText(ctx, s.title, 700, 40, 590); ctx.fillText(s.title, 26, 46);
    ctx.fillStyle = '#f4f1e8'; fitText(ctx, s.planned, 600, 36, 590); ctx.fillText(s.planned, 26, 112);
    ctx.fillStyle = '#ffe2b8'; fitText(ctx, s.budget, 800, 44, 590); ctx.fillText(s.budget, 26, 182);
    // Button bar
    ctx.fillStyle = s.over ? '#39424e' : (s.ok ? '#2f9e5f' : '#8a2f22');
    ctx.fillRect(26, 250, 588, 118);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center';
    fitText(ctx, s.button, 800, 52, 560); ctx.fillText(s.button, 320, 311);
    tex.needsUpdate = true;
    btnMat.color.setHex(s.over ? 0x5a616b : (s.ok ? 0x3fbf6f : 0xc0402e));
    btnMat.emissive.setHex(s.over ? 0x000000 : (s.ok ? 0x1f8f4a : 0x7a1d12));
  }
  setScreen({ title: '', planned: '', budget: '', button: 'RUN SHIFT', ok: true });

  g.position.set(x, heightAt(x, z), z);
  g.rotation.y = yaw;
  g.traverse((o) => { if (o.isMesh) o.userData.interact = 'console'; });
  const pickables = [];
  g.traverse((o) => { if (o.isMesh) pickables.push(o); });
  let t = 0;
  return {
    group: g,
    pickables,
    shape: { circle: [x, z, 0.75] },
    collider: { x, z, r: 0.85 },
    markerY: 3.1,
    setScreen,
    setLabel: drawSign,
    update(dt) { t += dt; accent.emissiveIntensity = 0.45 + 0.35 * Math.sin(t * 3); },
    get screen() { return last; },
  };
}

// ---------- Sample rocks + lab tray ----------
// rocks: [{ id, x, z }]; tray: { x, z, yaw } (a small table next to the lab door).
export function buildSamples(heightAt, rocks, tray, { color = 0x8d8a86, seed = 7 } = {}) {
  const root = new THREE.Group();
  root.name = 'samples';
  let a = seed;
  const rand = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const rockGeo = (() => {
    const geo = new THREE.DodecahedronGeometry(0.17, 1);
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    const cache = new Map();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      if (!cache.has(key)) cache.set(key, 1 + (rand() - 0.5) * 0.35);
      v.multiplyScalar(cache.get(key));
      v.y *= 0.75;
      p.setXYZ(k, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  })();
  const rockMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, emissive: 0xffa040, emissiveIntensity: 0.12 });
  const studiedMat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, emissive: 0x3cff8a, emissiveIntensity: 0.35 });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const flagMat = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff7a1a, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });

  // Tray: table with two marked zones, "IN" (waiting) and "DONE" (studied)
  const table = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.6), M(0xd7dbe0));
  top.position.y = 0.8;
  top.castShadow = top.receiveShadow = true;
  table.add(top);
  for (const sx of [-0.52, 0.52]) for (const sz of [-0.24, 0.24]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 6), M(0x5a6068));
    leg.position.set(sx, 0.4, sz);
    table.add(leg);
  }
  const zoneIn = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.02, 0.5), M(0xf2a23a, { emissive: 0x6a3a0a, emissiveIntensity: 0.4 }));
  zoneIn.position.set(-0.29, 0.84, 0);
  const zoneDone = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.02, 0.5), M(0x3fa86b, { emissive: 0x1a5a32, emissiveIntensity: 0.4 }));
  zoneDone.position.set(0.29, 0.84, 0);
  table.add(zoneIn, zoneDone);
  // Small label board behind the zones
  const lc = document.createElement('canvas'); lc.width = 512; lc.height = 96;
  const lctx = lc.getContext('2d');
  const ltex = canvasTexture(lc);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.22), new THREE.MeshBasicMaterial({ map: ltex, toneMapped: false }));
  label.position.set(0, 1.08, -0.28);
  table.add(label);
  const labelPost = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.24, 0.03), M(0x2c3038));
  labelPost.position.set(0, 1.08, -0.3);
  table.add(labelPost);
  for (const sx of [-0.55, 0.55]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.26, 0.03), M(0x5a6068));
    p.position.set(sx, 0.94, -0.3);
    table.add(p);
  }
  function drawTrayLabel(inText, doneText) {
    lctx.fillStyle = '#10151d'; lctx.fillRect(0, 0, 512, 96);
    lctx.textAlign = 'center'; lctx.textBaseline = 'middle';
    lctx.fillStyle = '#f2a23a'; fitText(lctx, inText, 800, 40, 230); lctx.fillText(inText, 128, 50);
    lctx.fillStyle = '#7ee2a0'; fitText(lctx, `✓ ${doneText}`, 800, 40, 230); lctx.fillText(`✓ ${doneText}`, 384, 50);
    ltex.needsUpdate = true;
  }
  drawTrayLabel('WAITING', 'STUDIED');
  // Generous hit area above the tray (invisible material, still pickable)
  const trayHit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.9), new THREE.MeshBasicMaterial({ visible: false }));
  trayHit.position.y = 1.15;
  table.add(trayHit);
  table.position.set(tray.x, heightAt(tray.x, tray.z), tray.z);
  table.rotation.y = tray.yaw ?? 0;
  table.traverse((o) => { if (o.isMesh) { o.userData.moduleKey = 'lab'; o.castShadow = true; } });
  root.add(table);
  const slotWorld = (zone, i) => {
    const local = new THREE.Vector3((zone === 'in' ? -0.29 : 0.29) + (i - 0.5) * 0.22, 0.92, 0);
    return local.applyAxisAngle(new THREE.Vector3(0, 1, 0), tray.yaw ?? 0).add(new THREE.Vector3(tray.x, heightAt(tray.x, tray.z), tray.z));
  };

  const items = rocks.map((r, i) => {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(rockGeo, rockMat);
    mesh.position.y = 0.11;
    mesh.rotation.y = i * 1.3;
    mesh.castShadow = true;
    g.add(mesh);
    const ringGeo = new THREE.RingGeometry(0.42, 0.5, 40);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.04;
    ringMesh.renderOrder = 2;
    g.add(ringMesh);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 5), poleMat);
    pole.position.set(0.3, 0.37, 0);
    g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), flagMat);
    flag.position.set(0.41, 0.66, 0);
    g.add(flag);
    // Big invisible hit area so a child can click the rock easily
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 12), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 0.3;
    g.add(hit);
    g.traverse((o) => { if (o.isMesh) o.userData.interact = `rock:${r.id}`; });
    g.position.set(r.x, heightAt(r.x, r.z), r.z);
    root.add(g);
    // The same rock shown in the tray (waiting) or on the "done" side (studied)
    const inTray = new THREE.Mesh(rockGeo, rockMat);
    inTray.scale.setScalar(0.75);
    inTray.position.copy(slotWorld('in', i));
    inTray.userData.moduleKey = 'lab';
    const done = new THREE.Mesh(rockGeo, studiedMat);
    done.scale.setScalar(0.75);
    done.position.copy(slotWorld('done', i));
    done.userData.moduleKey = 'lab';
    root.add(inTray, done);
    return { id: r.id, g, ring: ringMesh, flag, inTray, done, hit, shape: { circle: [r.x, r.z, 0.3] } };
  });

  function setStates(states = {}) {
    for (const it of items) {
      const s = states[it.id] ?? 'ground';
      it.g.visible = s === 'ground';
      it.inTray.visible = s === 'tray';
      it.done.visible = s === 'studied';
    }
  }
  setStates();
  let t = 0;
  function update(dt) {
    t += dt;
    const k = 0.5 + 0.5 * Math.sin(t * 3);
    ringMat.opacity = 0.5 + 0.45 * k;
    for (const it of items) { it.ring.scale.setScalar(0.92 + 0.12 * k); it.flag.rotation.y = 0.3 * Math.sin(t * 2 + it.g.position.x); }
  }
  const pickables = [];
  root.traverse((o) => { if (o.isMesh) pickables.push(o); });
  return {
    root, pickables, items, setStates, update, setLabels: drawTrayLabel,
    trayShape: { circle: [tray.x, tray.z, 0.6] },
    trayCollider: { x: tray.x, z: tray.z, r: 0.65 },
    rockColliders: [],
  };
}

// ---------- Guide marker: a soft light beam and a bouncing arrow ----------
export function buildGuideMarker() {
  const g = new THREE.Group();
  g.name = 'guide-marker';
  const beamTex = (() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 256;
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, 'rgba(120,230,255,0)');
    gr.addColorStop(0.6, 'rgba(120,230,255,0.25)');
    gr.addColorStop(1, 'rgba(160,240,255,0.5)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 32, 256);
    return new THREE.CanvasTexture(c);
  })();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 6, 16, 1, true),
    new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  beam.position.y = 3;
  g.add(beam);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 4),
    new THREE.MeshBasicMaterial({ color: 0x7fe8ff, fog: false }));
  arrow.rotation.x = Math.PI; // points down
  g.add(arrow);
  g.visible = false;
  let t = 0;
  let baseY = 2;
  return {
    group: g,
    show(x, y, z, markerY = 2) { g.visible = true; g.position.set(x, y, z); baseY = markerY; },
    hide() { g.visible = false; },
    update(dt) {
      t += dt;
      arrow.position.y = baseY + 0.18 * Math.sin(t * 4);
      arrow.rotation.y = t * 1.5;
      beam.material.opacity = 0.35 + 0.15 * Math.sin(t * 2.5);
    },
  };
}
