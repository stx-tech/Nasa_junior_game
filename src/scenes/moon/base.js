import * as THREE from 'three';
import { MODULES, SOLAR_ARRAY, FORK, bearingToDir } from './layout.js';
import { makeSignTexture, createReadout, makeTagTexture, makeSolarCellTexture, makeStatusTexture } from './textures.js';

const M = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts });

function shadowed(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function tagPickable(obj, key) {
  obj.traverse((o) => { if (o.isMesh) o.userData.moduleKey = key; });
  return obj;
}

function signPlane(tex, w, h) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.35 });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

function tube(points, radius, material, segments = 64) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 6, false), material);
}

// ---------- Life Support (key: crew) ----------
function buildLifeSupport(mats, signTex) {
  const g = new THREE.Group();
  const { radius: R } = MODULES.crew;
  g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(R + 0.08, R + 0.15, 0.3, 40), mats.darkMetal))).position.y = 0.15;
  const wall = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.9, 40), mats.hull));
  wall.position.y = 1.25;
  g.add(wall);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, 0.2, 40, 1, true), mats.orange);
  band.position.y = 1.75;
  g.add(band);
  const dome = shadowed(new THREE.Mesh(new THREE.SphereGeometry(R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.hull));
  dome.scale.y = 0.42;
  dome.position.y = 2.2;
  g.add(dome);
  // Roof vent + small radiator fins
  const vent = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.4, 12), mats.lightMetal));
  vent.position.set(0.6, 3.45, -0.4);
  g.add(vent);
  // Windows (round portholes), not on the airlock side
  for (const a of [Math.PI * 0.15, Math.PI * 0.85, Math.PI * 1.35, Math.PI * 1.65]) {
    const win = new THREE.Mesh(new THREE.CircleGeometry(0.32, 20), mats.window);
    win.position.set(Math.sin(a) * (R + 0.01), 1.35, Math.cos(a) * (R + 0.01));
    win.lookAt(win.position.x * 2, 1.35, win.position.z * 2);
    g.add(win);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 6, 20), mats.darkMetal);
    rim.position.copy(win.position);
    rim.quaternion.copy(win.quaternion);
    g.add(rim);
  }
  // Round airlock tube facing south (+z)
  const airlock = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.0, 28), mats.hull));
  airlock.rotation.x = Math.PI / 2;
  airlock.position.set(0, 1.15, R + 0.6);
  g.add(airlock);
  const hatchZ = R + 1.6;
  const hatchRim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.1, 10, 32), mats.orange);
  hatchRim.position.set(0, 1.15, hatchZ + 0.01);
  g.add(hatchRim);
  const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.86, 32), mats.hatch);
  hatch.position.set(0, 1.15, hatchZ + 0.02);
  g.add(hatch);
  const hatchWin = new THREE.Mesh(new THREE.CircleGeometry(0.2, 16), mats.window);
  hatchWin.position.set(0, 1.45, hatchZ + 0.03);
  g.add(hatchWin);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 6, 16), mats.darkMetal);
  wheel.position.set(0, 0.95, hatchZ + 0.05);
  g.add(wheel);
  // Step plate under the hatch
  g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.8), mats.darkMetal))).position.set(0, 0.06, hatchZ + 0.35);
  // Handrail along the east side of the airlock
  for (const z of [R + 0.2, R + 1.5]) {
    const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6), mats.lightMetal));
    post.position.set(1.35, 0.5, z);
    g.add(post);
  }
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), mats.yellow);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(1.35, 1.0, R + 0.85);
  g.add(rail);
  // Indicator next to the hatch (colour follows state; the tag/ring carry meaning)
  const lampBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.12), mats.darkMetal);
  lampBox.position.set(-1.3, 1.35, hatchZ - 0.3);
  g.add(lampBox);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x3cff8a, emissiveIntensity: 1.2 }));
  lamp.position.set(-1.3, 1.42, hatchZ - 0.22);
  g.add(lamp);
  // Two gas tanks on the west side + pipes into the wall
  for (const dz of [0.55, -0.45]) {
    const tank = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 1.1, 6, 14), mats.tank));
    tank.position.set(-R - 0.75, 0.95, dz);
    g.add(tank);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.16, 14, 1, true), mats.green);
    stripe.position.set(-R - 0.75, 1.25, dz);
    g.add(stripe);
    g.add(tube([[-R - 0.75, 1.9, dz], [-R - 0.6, 2.15, dz], [-R + 0.05, 2.1, dz * 0.6]], 0.05, mats.lightMetal, 12));
  }
  // External pipes wrapping the wall
  const pipePts = [];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * 0.55 + (i / 24) * Math.PI * 0.9;
    pipePts.push([Math.sin(a) * (R + 0.1), 0.55, Math.cos(a) * (R + 0.1)]);
  }
  g.add(tube(pipePts, 0.07, mats.lightMetal, 48));
  g.add(tube(pipePts.map(([x, y, z]) => [x, y + 0.2, z]), 0.05, mats.orange, 48));
  // Name sign mounted on the airlock roof, facing the route
  const sign = signPlane(signTex, 2.3, 0.58);
  sign.position.set(0, 2.55, hatchZ - 0.35);
  g.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.66, 0.06), mats.darkMetal);
  signBack.position.set(0, 2.55, hatchZ - 0.39);
  g.add(signBack);
  for (const x of [-0.8, 0.8]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), mats.darkMetal);
    leg.position.set(x, 2.1, hatchZ - 0.4);
    g.add(leg);
  }
  return { group: g, lamp, labelY: 4.3, ringR: R + 2.2, ringOffsetZ: 0.8 };
}

// ---------- Science Lab (key: lab) ----------
function buildLab(mats, signTex) {
  const g = new THREE.Group();
  const { width: W, depth: D, height: H, legHeight: L } = MODULES.lab;
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), mats.labHull));
  body.position.y = L + H / 2;
  g.add(body);
  // Panel ribs
  for (let i = -2; i <= 2; i++) {
    const rib = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, H + 0.04, D + 0.06), mats.lightMetal));
    rib.position.set(i * (W / 5), L + H / 2, 0);
    g.add(rib);
  }
  // Hazard stripe band at the base of the box
  const stripeTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 32;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f2c230'; ctx.fillRect(0, 0, 256, 32);
    ctx.fillStyle = '#1b1b1b';
    for (let x = -32; x < 256; x += 32) { ctx.beginPath(); ctx.moveTo(x, 32); ctx.lineTo(x + 16, 0); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 16, 32); ctx.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.18, D + 0.04), new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.7 }));
  band.position.y = L + 0.12;
  g.add(band);
  // Legs with foot pads
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, L + 0.1, 8), mats.darkMetal));
    leg.position.set(sx * (W / 2 - 0.35), (L + 0.1) / 2, sz * (D / 2 - 0.3));
    g.add(leg);
    const pad = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 12), mats.darkMetal));
    pad.position.set(sx * (W / 2 - 0.35), 0.04, sz * (D / 2 - 0.3));
    g.add(pad);
  }
  // South face: window (left) + door (right) + steps
  const face = D / 2 + 0.011;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.75), mats.window);
  win.position.set(-1.1, L + 1.45, face);
  g.add(win);
  const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.9, 0.06), mats.darkMetal);
  winFrame.position.set(-1.1, L + 1.45, face - 0.025);
  g.add(winFrame);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), mats.hatch);
  door.position.set(1.2, L + 0.98, face + 0.005);
  g.add(door);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.05, 0.06), mats.orange);
  doorFrame.position.set(1.2, L + 1.0, face - 0.02);
  g.add(doorFrame);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), mats.lightMetal);
  handle.position.set(1.55, L + 1.0, face + 0.04);
  g.add(handle);
  for (let s = 0; s < 3; s++) {
    const step = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.3 * (s + 1), 0.42), mats.darkMetal));
    step.position.set(1.2, 0.15 * (s + 1), D / 2 + 1.25 - s * 0.42);
    g.add(step);
  }
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x3cff8a, emissiveIntensity: 1.2 }));
  lamp.position.set(1.95, L + 1.75, face + 0.06);
  g.add(lamp);
  // Name sign above window+door
  const sign = signPlane(signTex, 2.6, 0.62);
  sign.position.set(0, L + H + 0.48, face - 0.1);
  g.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.7, 0.06), mats.darkMetal);
  signBack.position.set(0, L + H + 0.48, face - 0.14);
  g.add(signBack);
  // Antenna mast + dish on the roof
  const mast = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.8, 8), mats.lightMetal));
  mast.position.set(-1.6, L + H + 0.9, -0.8);
  g.add(mast);
  const dish = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), mats.hull));
  dish.position.set(-1.6, L + H + 1.75, -0.8);
  dish.rotation.x = -Math.PI * 0.6;
  dish.rotation.z = 0.5;
  g.add(dish);
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 4), mats.lightMetal);
  whip.position.set(1.9, L + H + 0.7, -1.1);
  g.add(whip);
  // Roof instrument box
  g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.8), mats.lightMetal))).position.set(0.6, L + H + 0.2, -0.5);
  // Sample box next to the steps (lid open, rocks inside)
  const crate = new THREE.Group();
  crate.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), mats.orange))).position.y = 0.25;
  const lidGeo = new THREE.BoxGeometry(0.9, 0.05, 0.6);
  lidGeo.translate(0, 0, 0.3); // hinge on the back edge
  const lid = shadowed(new THREE.Mesh(lidGeo, mats.orange));
  lid.position.set(0, 0.52, -0.3);
  lid.rotation.x = -2.0; // open, leaning back
  crate.add(lid);
  for (const [x, z, s] of [[-0.2, 0.05, 0.13], [0.15, -0.05, 0.1], [0.05, 0.12, 0.08]]) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mats.sampleRock);
    r.position.set(x, 0.52, z);
    crate.add(r);
  }
  crate.position.set(-0.6, 0, D / 2 + 0.9);
  crate.rotation.y = 0.2;
  g.add(crate);
  return { group: g, lamp, labelY: L + H + 1.7, ringR: 4.1, ringOffsetZ: 0.7 };
}

// ---------- Solar array ----------
function buildSolarArray(mats, heightAt) {
  const g = new THREE.Group();
  const cellTex = makeSolarCellTexture();
  const cellMat = new THREE.MeshStandardMaterial({ map: cellTex, roughness: 0.35, metalness: 0.3, emissive: 0x23417a, emissiveIntensity: 0.4 });
  const panels = [];
  const { x: cx, z: cz, rows, perRow, rowSpacing, panelSpacing, panelW, panelH, mastH } = SOLAR_ARRAY;
  for (let r = 0; r < rows; r++) {
    for (let p = 0; p < perRow; p++) {
      const x = cx + (p - (perRow - 1) / 2) * panelSpacing;
      const z = cz + (r - (rows - 1) / 2) * rowSpacing;
      const y0 = heightAt(x, z);
      const mast = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, mastH, 6), mats.lightMetal));
      mast.position.set(x, y0 + mastH / 2, z);
      g.add(mast);
      const foot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.4), mats.darkMetal));
      foot.position.set(x, y0 + 0.05, z);
      g.add(foot);
      const head = new THREE.Group(); // yaw
      head.position.set(x, y0 + mastH, z);
      const tilt = new THREE.Group(); // pitch
      head.add(tilt);
      const frame = shadowed(new THREE.Mesh(new THREE.BoxGeometry(panelW, panelH, 0.05), mats.darkMetal));
      tilt.add(frame);
      const cells = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.08, panelH - 0.08), cellMat);
      cells.position.z = 0.03;
      tilt.add(cells);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(panelW - 0.1, panelH - 0.1), mats.panelBack);
      back.position.z = -0.03;
      back.rotation.y = Math.PI;
      tilt.add(back);
      g.add(head);
      panels.push({ head, tilt });
    }
  }
  // Rails between masts per row (frame)
  for (let r = 0; r < rows; r++) {
    const z = cz + (r - (rows - 1) / 2) * rowSpacing;
    const x0 = cx - ((perRow - 1) / 2) * panelSpacing, x1 = cx + ((perRow - 1) / 2) * panelSpacing;
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const x = x0 + (i / 12) * (x1 - x0);
      pts.push([x, heightAt(x, z) + 0.35, z]);
    }
    g.add(tube(pts, 0.03, mats.lightMetal, 24));
  }
  function aimAt(sun) {
    const yaw = Math.atan2(sun[0], sun[2]); // face toward the sun's azimuth
    const elev = Math.asin(sun[1]);
    for (const { head, tilt } of panels) {
      head.rotation.y = yaw;
      tilt.rotation.x = -Math.max(elev, 0.05) - 0.12; // nearly vertical for a low Sun, cells tilted slightly up
    }
  }
  return { group: g, aimAt, cellMat };
}

// Ground ring + floating tag for selection (shape + word, not just colour).
function selectionMarker(radius, labelY, tagTex) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.18, radius, 64),
    new THREE.MeshBasicMaterial({ color: 0x5ee1ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  ring.renderOrder = 2;
  g.add(ring);
  // dashed outer ticks
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const tick = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.1), ring.material);
    tick.position.set(Math.cos(a) * (radius + 0.35), 0.07, Math.sin(a) * (radius + 0.35));
    tick.rotation.y = -a;
    g.add(tick);
  }
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, transparent: true }));
  tag.scale.set(2.0, 0.62, 1);
  tag.position.y = labelY;
  tag.renderOrder = 10;
  g.add(tag);
  g.visible = false;
  return { group: g, tag, ring };
}

const textTargets = []; // { tex, key } — redrawn on language change (setTexts)

function signpost(mats, heightAt, x, z, boards) {
  const g = new THREE.Group();
  const y0 = heightAt(x, z);
  const top = 0.6 + boards.length * 0.42;
  const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, top + 0.1, 8), mats.lightMetal));
  post.position.set(0, (top + 0.1) / 2, 0);
  g.add(post);
  boards.forEach((b, i) => {
    const tex = makeSignTexture({ text: b.text, icon: b.icon, w: 768, h: 160 });
    if (b.key) textTargets.push({ tex, key: b.key });
    const p = signPlane(tex, 1.5, 0.31);
    p.position.set(b.offset ?? 0, top - 0.05 - i * 0.42, 0.06);
    g.add(p);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.36, 0.05), mats.darkMetal);
    back.position.set(b.offset ?? 0, top - 0.05 - i * 0.42, 0.02);
    g.add(back);
  });
  g.position.set(x, y0, z);
  return g;
}

export function buildBase(heightAt) {
  const mats = {
    hull: M(0xe9e6df, { roughness: 0.55 }),
    labHull: M(0xc7d2dc, { roughness: 0.5, metalness: 0.15 }),
    darkMetal: M(0x3a3f47, { roughness: 0.6, metalness: 0.4 }),
    lightMetal: M(0xa9aeb5, { roughness: 0.45, metalness: 0.6 }),
    orange: M(0xe9832b, { roughness: 0.6 }),
    yellow: M(0xf2c230, { roughness: 0.6 }),
    green: M(0x3fa86b, { roughness: 0.6 }),
    tank: M(0xf2f2ee, { roughness: 0.35, metalness: 0.2 }),
    hatch: M(0x9ba3ad, { roughness: 0.5, metalness: 0.5 }),
    window: new THREE.MeshStandardMaterial({ color: 0x0d1b2a, emissive: 0xffc77a, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1 }),
    sampleRock: M(0x6b6560, { roughness: 1, flatShading: true }),
    panelBack: M(0xb8bcc2, { roughness: 0.6, metalness: 0.2 }),
  };

  const root = new THREE.Group();
  root.name = 'moon-base';
  const tagTex = makeTagTexture('Selected');
  textTargets.length = 0;
  textTargets.push({ tex: tagTex, key: 'map.selected' });
  const sign = (key, opts) => { const tex = makeSignTexture(opts); textTargets.push({ tex, key }); return tex; };

  // Life Support
  const ls = buildLifeSupport(mats, sign('map.lifeSupport', { text: 'LIFE SUPPORT', icon: 'air', accent: '#7cc8ff' }));
  ls.group.position.set(MODULES.crew.x, heightAt(MODULES.crew.x, MODULES.crew.z), MODULES.crew.z);
  tagPickable(ls.group, 'crew');
  root.add(ls.group);
  const lsSel = selectionMarker(ls.ringR, ls.labelY, tagTex);
  lsSel.group.position.set(MODULES.crew.x, ls.group.position.y, MODULES.crew.z + ls.ringOffsetZ);
  root.add(lsSel.group);

  // Science Lab
  const lab = buildLab(mats, sign('map.scienceLab', { text: 'SCIENCE LAB', icon: 'sample', accent: '#f2c230' }));
  lab.group.position.set(MODULES.lab.x, heightAt(MODULES.lab.x, MODULES.lab.z), MODULES.lab.z);
  tagPickable(lab.group, 'lab');
  root.add(lab.group);
  const labSel = selectionMarker(lab.ringR, lab.labelY, tagTex);
  labSel.group.position.set(MODULES.lab.x, lab.group.position.y, MODULES.lab.z + lab.ringOffsetZ);
  root.add(labSel.group);

  // Solar array + readout
  const array = buildSolarArray(mats, heightAt);
  root.add(array.group);
  const readout = createReadout();
  const ro = new THREE.Group();
  const roX = 10.2, roZ = -3.2;
  const roPost = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 8), mats.lightMetal));
  roPost.position.y = 1.1;
  ro.add(roPost);
  const roScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: readout.texture, toneMapped: false }));
  roScreen.position.set(0, 1.55, 0.06);
  ro.add(roScreen);
  const roBack = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.68, 0.06), mats.darkMetal);
  roBack.position.set(0, 1.55, 0.01);
  ro.add(roBack);
  const roSign = signPlane(sign('map.solarArray', { text: 'SOLAR ARRAY', icon: 'sun', accent: '#ffd166', w: 768, h: 160 }), 1.4, 0.29);
  roSign.position.set(0, 2.1, 0.06);
  ro.add(roSign);
  ro.position.set(roX, heightAt(roX, roZ), roZ);
  ro.rotation.y = -0.7; // faces the route coming from the lab (SW)
  root.add(ro);

  // Power junction between the modules + cables lying on the ground
  const jx = 0.4, jz = -5.6;
  const junction = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.6), mats.darkMetal));
  junction.position.set(jx, heightAt(jx, jz) + 0.35, jz);
  root.add(junction);
  const jLamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffd166, emissiveIntensity: 0.8 }));
  jLamp.position.set(jx, heightAt(jx, jz) + 0.55, jz + 0.31);
  root.add(jLamp);
  const cableMat = M(0x1d1d1f, { roughness: 0.8 });
  const cableAccent = M(0xe9832b, { roughness: 0.7 });
  const groundPath = (pts, lift = 0.06) => pts.map(([x, z]) => [x, heightAt(x, z) + lift, z]);
  const cables = [
    [[9.6, -7], [8.6, -6.6], [6, -6.4], [3, -6.2], [jx + 0.45, jz]], // array -> junction
    [[jx - 0.45, jz], [-1.5, -4.8], [-2.6, -3.6]], // junction -> Life Support
    [[jx + 0.2, jz - 0.3], [1.6, -5.4], [2.45, -4.6]], // junction -> Lab
  ];
  for (const c of cables) {
    const dense = [];
    for (let i = 0; i < c.length - 1; i++) {
      for (let t = 0; t < 1; t += 0.2) dense.push([c[i][0] + (c[i + 1][0] - c[i][0]) * t, c[i][1] + (c[i + 1][1] - c[i][1]) * t]);
    }
    dense.push(c[c.length - 1]);
    root.add(shadowed(tube(groundPath(dense), 0.06, cableMat, dense.length * 3)));
    root.add(tube(groundPath(dense, 0.12), 0.025, cableAccent, dense.length * 3));
  }

  // Signpost at the fork
  root.add(signpost(mats, heightAt, 0.45, 4.2, [
    { text: 'LIFE SUPPORT', icon: 'arrowL', key: 'map.lifeSupport' },
    { text: 'SCIENCE LAB', icon: 'arrowR', key: 'map.scienceLab' },
    { text: 'SOLAR ARRAY', icon: 'arrowUR', key: 'map.solarArray' },
  ]));

  // Small lander behind spawn (context: "you arrived here"), outside the walk box.
  const lander = new THREE.Group();
  const lbody = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 1.3, 8), M(0xd9a441, { roughness: 0.35, metalness: 0.6 })));
  lbody.position.y = 1.6;
  lander.add(lbody);
  const ltop = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 1.3), mats.hull));
  ltop.position.y = 2.75;
  lander.add(ltop);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6), mats.lightMetal));
    leg.position.set(Math.cos(a) * 1.35, 0.85, Math.sin(a) * 1.35);
    leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
    lander.add(leg);
    const pad = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 0.06, 10), mats.lightMetal));
    pad.position.set(Math.cos(a) * 1.75, 0.03, Math.sin(a) * 1.75);
    lander.add(pad);
  }
  lander.position.set(3.2, heightAt(3.2, 16.5), 16.5);
  root.add(lander);

  const pickables = [];
  root.traverse((o) => { if (o.isMesh && o.userData.moduleKey) pickables.push(o); });

  const lampColors = { idle: 0x3cff8a, selected: 0x5ee1ff };
  function setSelected(keys) {
    const sel = new Set(keys || []);
    lsSel.group.visible = sel.has('crew');
    labSel.group.visible = sel.has('lab');
    ls.lamp.material.emissive.setHex(sel.has('crew') ? lampColors.selected : lampColors.idle);
    lab.lamp.material.emissive.setHex(sel.has('lab') ? lampColors.selected : lampColors.idle);
  }

  function setSolar(sunDir, output, lit) {
    array.aimAt(sunDir);
    readout.draw(output, lit);
    array.cellMat.emissiveIntensity = lit ? 0.45 : 0.04;
  }

  // Hover: brighten the module's name sign so the child sees what will be picked.
  const signMats = { crew: null, lab: null };
  ls.group.traverse((o) => { if (o.isMesh && o.material.emissiveMap) signMats.crew = o.material; });
  lab.group.traverse((o) => { if (o.isMesh && o.material.emissiveMap) signMats.lab = o.material; });
  function setHovered(key) {
    for (const k of ['crew', 'lab']) if (signMats[k]) signMats[k].emissiveIntensity = k === key ? 0.9 : 0.35;
  }

  function update(t) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 4);
    lsSel.ring.material.opacity = 0.65 + 0.3 * pulse;
    lsSel.tag.position.y = ls.labelY + 0.08 * Math.sin(t * 2);
    labSel.tag.position.y = lab.labelY + 0.08 * Math.sin(t * 2 + 1);
  }

  // Mission state shown in the world: { crew: {text, warn}, lab: {text, done} } (null hides a plate).
  const statusPlates = {};
  for (const [key, group, y] of [['crew', ls.group, 3.75], ['lab', lab.group, MODULES.lab.legHeight + MODULES.lab.height + 1.9]]) {
    const tex = makeStatusTexture();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(2.8, 0.7, 1);
    sprite.position.set(group.position.x, group.position.y + y, group.position.z + (key === 'crew' ? 0.6 : 0.4));
    sprite.visible = false;
    sprite.renderOrder = 9;
    root.add(sprite);
    statusPlates[key] = { sprite, tex };
  }
  function setStatus(status = {}) {
    for (const [key, plate] of Object.entries(statusPlates)) {
      const s = status[key];
      plate.sprite.visible = !!s;
      if (s) plate.tex.userData.set(s.text, s.warn ? 'warn' : (s.done ? 'done' : 'normal'));
    }
  }

  // Language switch: redraw every sign/readout/tag texture with t(key).
  function setTexts(t) {
    for (const { tex, key } of textTargets) tex.userData.setText(t(key));
    readout.setLabels({ output: t('map.solarOutput'), sunlight: t('map.inSunlight'), shadow: t('map.inShadow') });
  }

  return { root, pickables, setSelected, setSolar, setHovered, setTexts, setStatus, update, mats };
}

export { bearingToDir };
