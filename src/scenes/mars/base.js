import * as THREE from 'three';
import {
  M, shadowed, tagPickable, signPlane, tube, buildLifeSupport, buildLab, buildSolarArray, selectionMarker, signpost,
} from '../moon/base.js';
import {
  makeSignTexture, createReadout, makeTagTexture, makeStatusTexture, canvasTexture, drawIcon,
} from '../moon/textures.js';
import {
  MODULES, SOLAR_ARRAY, READOUT, RADIATION_BOARD, JUNCTION, ROVER, WEATHER_MAST, LANDER, SIGNPOST,
} from './layout.js';

// ---------- Greenhouse (key: greenhouse): clear arched tunnel along z, door at the south end ----------
function buildGreenhouse(mats, signTex, seed = 1) {
  const g = new THREE.Group();
  const { length: L, radius: R } = MODULES.greenhouse;
  // Foundation skirt
  for (const sx of [-1, 1]) {
    const skirt = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, L + 0.2), mats.darkMetal));
    skirt.position.set(sx * (R - 0.05), 0.17, 0);
    g.add(skirt);
  }
  // Clear skin: half cylinder (axis z)
  const skinGeo = new THREE.CylinderGeometry(R, R, L, 32, 1, true, Math.PI / 2, Math.PI);
  skinGeo.rotateX(Math.PI / 2);
  const skin = new THREE.Mesh(skinGeo, mats.glass);
  skin.position.y = 0.3;
  skin.renderOrder = 3;
  g.add(skin);
  // Ribs
  const ribGeo = new THREE.TorusGeometry(R + 0.02, 0.05, 6, 28, Math.PI);
  for (let i = 0; i <= 6; i++) {
    const rib = shadowed(new THREE.Mesh(ribGeo, mats.lightMetal));
    rib.position.set(0, 0.3, -L / 2 + (i / 6) * L);
    g.add(rib);
  }
  // Ridge beam
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, L), mats.lightMetal);
  ridge.position.y = R + 0.3;
  g.add(ridge);
  // End walls: back = clear half disc, front = clear half disc around a door frame
  for (const sz of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.CircleGeometry(R, 32, 0, Math.PI), mats.glass);
    wall.position.set(0, 0.3, sz * L / 2);
    if (sz < 0) wall.rotation.y = Math.PI;
    wall.renderOrder = 3;
    g.add(wall);
  }
  // Small airlock at the south end
  const lockZ = L / 2 + 0.55;
  const lock = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 1.1), mats.hull));
  lock.position.set(0, 1.05, lockZ);
  g.add(lock);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.75), mats.hatch);
  door.position.set(0, 0.95, lockZ + 0.556);
  g.add(door);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.95, 0.05), mats.green);
  frame.position.set(0, 0.97, lockZ + 0.53);
  g.add(frame);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x3cff8a, emissiveIntensity: 1.2 }));
  lamp.position.set(0.6, 1.75, lockZ + 0.58);
  g.add(lamp);
  const sign = signPlane(signTex, 2.2, 0.55);
  sign.position.set(0, 2.45, lockZ + 0.3);
  g.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.63, 0.06), mats.darkMetal);
  signBack.position.set(0, 2.45, lockZ + 0.26);
  g.add(signBack);
  // Steps
  g.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.7), mats.darkMetal))).position.set(0, 0.06, lockZ + 0.9);

  // Inside: two raised beds with soil, rows of plants, pink-violet grow lights
  const bedGeo = new THREE.BoxGeometry(0.85, 0.55, L - 1.0);
  const soilGeo = new THREE.BoxGeometry(0.75, 0.04, L - 1.1);
  const plants = [];
  const rand = (() => { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  for (const sx of [-1, 1]) {
    const bed = shadowed(new THREE.Mesh(bedGeo, mats.bed));
    bed.position.set(sx * 0.72, 0.3 + 0.275, 0);
    g.add(bed);
    const soil = new THREE.Mesh(soilGeo, mats.soil);
    soil.position.set(sx * 0.72, 0.3 + 0.57, 0);
    g.add(soil);
    for (let k = 0; k < 9; k++) {
      for (const dx of [-0.2, 0.2]) {
        plants.push({ x: sx * 0.72 + dx + (rand() - 0.5) * 0.06, z: -L / 2 + 0.85 + k * ((L - 1.7) / 8) + (rand() - 0.5) * 0.08, s: 0.85 + rand() * 0.3 });
      }
    }
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, L - 1.0), mats.growLight);
    light.position.set(sx * 0.72, R - 0.15, 0);
    g.add(light);
  }
  // Plants: a leafy clump (low-poly) per spot, instanced; scaled by growth.
  const leafGeo = new THREE.IcosahedronGeometry(0.16, 0);
  leafGeo.scale(1, 1.25, 1);
  leafGeo.translate(0, 0.16, 0);
  const leaves = new THREE.InstancedMesh(leafGeo, mats.leaf, plants.length);
  const dummy = new THREE.Object3D();
  function setGrowth(stage) {
    // stage 0 = seedlings, 1 = watered once, 2 = ready / harvested -> new sprouts
    const k = [0.45, 0.85, 1.25][stage] ?? 0.45;
    plants.forEach((p, i) => {
      dummy.position.set(p.x, 0.3 + 0.59, p.z);
      dummy.rotation.set(0, i * 1.7, 0);
      dummy.scale.setScalar(p.s * k);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    });
    leaves.instanceMatrix.needsUpdate = true;
  }
  setGrowth(0);
  g.add(leaves);
  // Harvest crate (shown after the first harvest) next to the door
  const crate = new THREE.Group();
  crate.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.5), mats.green))).position.y = 0.2;
  for (const [x, z] of [[-0.18, -0.05], [0.0, 0.08], [0.18, -0.04], [0.08, -0.12]]) {
    const veg = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mats.veg);
    veg.position.set(x, 0.45, z);
    crate.add(veg);
  }
  crate.position.set(1.15, 0, lockZ + 0.7);
  crate.visible = false;
  g.add(crate);
  // Water tank (feeds the beds) on the east side
  const tank = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.3, 16), mats.tank));
  tank.position.set(R + 0.75, 0.65, L / 2 - 1.2);
  g.add(tank);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.18, 16, 1, true), mats.water);
  stripe.position.set(R + 0.75, 0.95, L / 2 - 1.2);
  g.add(stripe);
  g.add(tube([[R + 0.75, 1.3, L / 2 - 1.2], [R + 0.5, 1.5, L / 2 - 1.2], [R - 0.1, 1.3, L / 2 - 1.4]], 0.04, mats.lightMetal, 10));
  return { group: g, lamp, setGrowth, crate, labelY: R + 1.6, ringR: R + 1.9, ringOffsetZ: 0.6 };
}

// ---------- Shelter (key: shelter): vault under a sandbag berm, door faces west ----------
function buildShelter(mats, signTex) {
  const g = new THREE.Group();
  const { length: L, radius: R } = MODULES.shelter;
  // Berm: a long low mound of red soil over the vault
  const berm = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.berm));
  berm.scale.set(L / 2 + 0.9, R + 0.35, R + 1.2);
  g.add(berm);
  // Rows of sandbags along the crest (instanced capsules)
  const bagGeo = new THREE.CapsuleGeometry(0.18, 0.42, 4, 8);
  bagGeo.rotateZ(Math.PI / 2);
  const bags = [];
  for (let row = -1; row <= 1; row++) {
    for (let i = 0; i < 9; i++) {
      const x = -L / 2 + 0.2 + i * (L / 8.5) + (row % 2 ? 0.25 : 0);
      const zN = row / 2.6;
      const bx = x / (L / 2 + 0.9), bz = zN;
      const y = (R + 0.35) * Math.sqrt(Math.max(0, 1 - bx * bx - bz * bz)) + 0.08;
      bags.push([x, y, zN * (R + 1.2), row * 0.18]);
    }
  }
  const bagMesh = new THREE.InstancedMesh(bagGeo, mats.sandbag, bags.length);
  const d = new THREE.Object3D();
  bags.forEach(([x, y, z, tilt], i) => { d.position.set(x, y - 0.06, z); d.rotation.set(tilt, (i % 3) * 0.08, 0); d.scale.set(1, 0.55, 0.85); d.updateMatrix(); bagMesh.setMatrixAt(i, d.matrix); });
  bagMesh.castShadow = true;
  bagMesh.receiveShadow = true;
  g.add(bagMesh);
  // Entrance portal on the west end
  const px = -L / 2 - 0.5;
  const portal = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.3, 2.0), mats.concrete));
  portal.position.set(px, 1.15, 0);
  g.add(portal);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.0, 1.35), mats.hazard);
  frame.position.set(px - 0.71, 1.0, 0);
  g.add(frame);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.75), mats.hatch);
  door.position.set(px - 0.75, 0.95, 0);
  door.rotation.y = -Math.PI / 2;
  g.add(door);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.03, 6, 16), mats.darkMetal);
  wheel.position.set(px - 0.78, 1.0, 0);
  wheel.rotation.y = Math.PI / 2;
  g.add(wheel);
  const sign = signPlane(signTex, 2.0, 0.5);
  sign.position.set(px - 0.73, 2.55, 0);
  sign.rotation.y = -Math.PI / 2;
  g.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.58, 2.1), mats.darkMetal);
  signBack.position.set(px - 0.69, 2.55, 0);
  g.add(signBack);
  // Ramp down to the door
  const ramp = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 1.6), mats.darkMetal));
  ramp.position.set(px - 1.4, 0.05, 0);
  g.add(ramp);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x3cff8a, emissiveIntensity: 1.2 }));
  lamp.position.set(px - 0.75, 1.95, 0.62);
  g.add(lamp);
  // Warning beacon on the portal roof (flashes during the radiation warning)
  const beaconPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), mats.lightMetal);
  beaconPole.position.set(px + 0.3, 2.75, 0.55);
  g.add(beaconPole);
  const beaconBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.12, 12), mats.darkMetal);
  beaconBase.position.set(px + 0.3, 3.22, 0.55);
  g.add(beaconBase);
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 12), new THREE.MeshStandardMaterial({ color: 0x552211, emissive: 0xff5a2a, emissiveIntensity: 0.05, transparent: true, opacity: 0.9 }));
  beacon.position.set(px + 0.3, 3.45, 0.55);
  g.add(beacon);
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,140,90,1)'); gr.addColorStop(0.25, 'rgba(255,90,40,0.5)'); gr.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  glow.scale.set(2.6, 2.6, 1);
  glow.position.set(px + 0.3, 3.45, 0.55);
  g.add(glow);
  return { group: g, lamp, beacon, glow, labelY: R + 2.3, ringR: L / 2 + 2.2, ringOffsetZ: 0 };
}

// ---------- Rover: a generic six-wheeled science rover, parked (scenery) ----------
function buildRover(mats) {
  const g = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.42, 1.5), mats.roverBody));
  body.position.y = 0.72;
  g.add(body);
  // Solar deck with wings (dusty)
  const deck = shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 1.7), mats.dustyCells));
  deck.position.y = 0.97;
  g.add(deck);
  for (const sx of [-1, 1]) {
    const wing = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 1.0), mats.dustyCells));
    wing.position.set(sx * 1.2, 0.97, 0.25);
    wing.rotation.z = sx * 0.08;
    g.add(wing);
  }
  // Rocker-bogie: bars + six wheels
  for (const sx of [-1, 1]) {
    const bar = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.6), mats.lightMetal));
    bar.position.set(sx * 0.72, 0.5, 0);
    bar.rotation.x = 0.06;
    g.add(bar);
    for (const z of [-0.68, 0, 0.68]) {
      const wheel = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.17, 16), mats.wheel));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx * 0.82, 0.2, z);
      g.add(wheel);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.32, 0.05), mats.lightMetal);
      leg.position.set(sx * 0.74, 0.36, z);
      g.add(leg);
    }
  }
  // Camera mast + head
  const mast = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.9, 8), mats.lightMetal));
  mast.position.set(0.25, 1.45, 0.55);
  g.add(mast);
  const head = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.14), mats.hull));
  head.position.set(0.25, 1.95, 0.58);
  g.add(head);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), mats.lens);
    eye.position.set(0.25 + sx * 0.09, 1.95, 0.652);
    g.add(eye);
  }
  // High-gain dish + low-gain whip
  const dish = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 16), mats.hull));
  dish.position.set(-0.35, 1.18, -0.3);
  dish.rotation.x = 0.7;
  g.add(dish);
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), mats.lightMetal);
  whip.position.set(-0.4, 1.3, 0.45);
  g.add(whip);
  // Arm folded at the front
  g.add(tube([[0.3, 0.6, 0.78], [0.1, 0.45, 0.95], [-0.3, 0.5, 0.92]], 0.035, mats.lightMetal, 8));
  return g;
}

// ---------- Weather mast with spinning anemometer cups ----------
function buildWeatherMast(mats) {
  const g = new THREE.Group();
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3.2, 8), mats.lightMetal));
  pole.position.y = 1.6;
  g.add(pole);
  const spinner = new THREE.Group();
  spinner.position.y = 3.25;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 4), mats.lightMetal);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = a;
    arm.position.set(Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18);
    spinner.add(arm);
    const cup = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI), mats.orange);
    cup.position.set(Math.cos(a) * 0.36, 0, -Math.sin(a) * 0.36);
    cup.rotation.y = a;
    spinner.add(cup);
  }
  g.add(spinner);
  const box = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.2), mats.hull));
  box.position.set(0, 1.2, 0.12);
  g.add(box);
  const vane = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.4), mats.orange);
  vane.position.set(0, 2.9, -0.15);
  g.add(vane);
  return { group: g, spinner };
}

// ---------- Lander behind spawn (where the crew arrived) ----------
function buildLander(mats) {
  const g = new THREE.Group();
  const capsule = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 2.2, 16), mats.hull));
  capsule.position.y = 2.4;
  g.add(capsule);
  const nose = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.0, 16), mats.hull));
  nose.position.y = 4.0;
  g.add(nose);
  const shield = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1.65, 1.75, 0.3, 20), mats.heatShield));
  shield.position.y = 1.2;
  g.add(shield);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), mats.lightMetal));
    leg.position.set(Math.cos(a) * 1.7, 0.7, Math.sin(a) * 1.7);
    leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
    g.add(leg);
    const pad = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.07, 10), mats.lightMetal));
    pad.position.set(Math.cos(a) * 2.0, 0.04, Math.sin(a) * 2.0);
    g.add(pad);
  }
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.36, 0.18, 16, 1, true), mats.orange);
  stripe.position.y = 2.0;
  g.add(stripe);
  return g;
}

// ---------- Radiation board (space weather): separate from the dust/solar readout ----------
function createRadiationBoard() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  const tex = canvasTexture(c);
  let labels = { title: 'Radiation', normal: 'Normal', warning: 'WARNING: go to the Shelter' };
  let alert = false;
  const fit = (text, weight, size, maxW) => {
    ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`;
    while (ctx.measureText(text).width > maxW && size > 16) { size -= 2; ctx.font = `${weight} ${size}px "Segoe UI", Arial, sans-serif`; }
  };
  function draw() {
    ctx.fillStyle = alert ? '#2a0f0b' : '#10151d';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = alert ? '#ff5a3c' : '#58c27d';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, 496, 240);
    // yellow disc with a black trefoil = the standard radiation sign
    ctx.fillStyle = alert ? '#ffd23f' : '#5b6170';
    ctx.beginPath(); ctx.arc(96, 128, 68, 0, Math.PI * 2); ctx.fill();
    drawIcon(ctx, 'radiation', 96, 128, 120, '#151515');
    ctx.fillStyle = '#f4f1e8';
    ctx.textBaseline = 'middle';
    fit(labels.title, 600, 52, 300);
    ctx.fillText(labels.title, 186, 80);
    const state = alert ? labels.warning : labels.normal;
    ctx.fillStyle = alert ? '#ff8a73' : '#7ee2a0';
    ctx.font = `800 ${alert ? 44 : 72}px "Segoe UI", Arial, sans-serif`;
    // Wrap the warning onto two lines if it does not fit at a readable size
    const words = state.split(' ');
    const wrap = ctx.measureText(state).width > 300 && words.length > 1;
    if (!wrap) fit(state, 800, alert ? 44 : 72, 300);
    if (wrap) {
      const mid = Math.ceil(words.length / 2);
      const a = words.slice(0, mid).join(' '), b = words.slice(mid).join(' ');
      fit(a.length > b.length ? a : b, 800, 44, 300);
      ctx.fillText(a, 186, 150); ctx.fillText(b, 186, 200);
    } else ctx.fillText(state, 186, 170);
    tex.needsUpdate = true;
  }
  draw();
  return {
    texture: tex,
    setAlert(a) { alert = a; draw(); },
    setLabels(l) { labels = l; draw(); },
  };
}

export function buildBase(heightAt) {
  const mats = {
    hull: M(0xe6ddd2, { roughness: 0.6 }),
    labHull: M(0xcbd0d4, { roughness: 0.55, metalness: 0.15 }),
    darkMetal: M(0x3a3836, { roughness: 0.6, metalness: 0.4 }),
    lightMetal: M(0xa9a5a0, { roughness: 0.5, metalness: 0.55 }),
    orange: M(0xe9832b, { roughness: 0.6 }),
    yellow: M(0xf2c230, { roughness: 0.6 }),
    green: M(0x3fa86b, { roughness: 0.6 }),
    tank: M(0xf0ece6, { roughness: 0.35, metalness: 0.2 }),
    water: M(0x3a8fd6, { roughness: 0.5 }),
    hatch: M(0x9ba3ad, { roughness: 0.5, metalness: 0.5 }),
    window: new THREE.MeshStandardMaterial({ color: 0x0d1b2a, emissive: 0xffc77a, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1 }),
    sampleRock: M(0x8a5a40, { roughness: 1, flatShading: true }),
    panelBack: M(0xb8b2aa, { roughness: 0.6, metalness: 0.2 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.22, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    bed: M(0x6f6a64, { roughness: 0.8 }),
    soil: M(0x3b2a20, { roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4fae4a, roughness: 0.8, flatShading: true, emissive: 0x2a5a20, emissiveIntensity: 0.35 }),
    veg: M(0xd9572e, { roughness: 0.6 }),
    growLight: new THREE.MeshStandardMaterial({ color: 0x331133, emissive: 0xff5ad8, emissiveIntensity: 1.6 }),
    berm: M(0x9a5a3a, { roughness: 1 }),
    sandbag: M(0xa8744e, { roughness: 1 }),
    concrete: M(0x9c938a, { roughness: 0.9 }),
    hazard: M(0xf2c230, { roughness: 0.6 }),
    roverBody: M(0xd8d2c8, { roughness: 0.55, metalness: 0.2 }),
    dustyCells: M(0x5b4a46, { roughness: 0.7, metalness: 0.2 }),
    wheel: M(0x7d7a76, { roughness: 0.6, metalness: 0.5 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.1, metalness: 0.5 }),
    heatShield: M(0x5a3a28, { roughness: 0.9 }),
  };

  const root = new THREE.Group();
  root.name = 'mars-base';
  const textTargets = [];
  const tagTex = makeTagTexture('Selected');
  textTargets.push({ tex: tagTex, key: 'map.selected' });
  const sign = (key, opts) => { const tex = makeSignTexture(opts); textTargets.push({ tex, key }); return tex; };
  const place = (group, key, cfg) => {
    group.position.set(cfg.x, heightAt(cfg.x, cfg.z), cfg.z);
    tagPickable(group, key);
    root.add(group);
  };

  const ls = buildLifeSupport(mats, sign('map.lifeSupport', { text: 'LIFE SUPPORT', icon: 'air', accent: '#7cc8ff' }));
  place(ls.group, 'crew', MODULES.crew);
  const lab = buildLab(mats, sign('map.scienceLab', { text: 'SCIENCE LAB', icon: 'sample', accent: '#f2c230' }));
  place(lab.group, 'lab', MODULES.lab);
  const gh = buildGreenhouse(mats, sign('map.greenhouse', { text: 'GREENHOUSE', icon: 'plant', accent: '#7ee2a0' }));
  place(gh.group, 'greenhouse', MODULES.greenhouse);
  const sh = buildShelter(mats, sign('map.shelter', { text: 'SHELTER', icon: 'shield', accent: '#ff8a5c' }));
  place(sh.group, 'shelter', MODULES.shelter);

  const parts = { crew: ls, lab, greenhouse: gh, shelter: sh };
  const markers = {};
  for (const [key, part] of Object.entries(parts)) {
    const m = selectionMarker(part.ringR, part.labelY, tagTex);
    m.group.position.set(part.group.position.x, part.group.position.y, part.group.position.z + part.ringOffsetZ);
    root.add(m.group);
    markers[key] = m;
  }

  // Solar array + readout (output and dust)
  const array = buildSolarArray(mats, heightAt, SOLAR_ARRAY);
  root.add(array.group);
  const readout = createReadout();
  const board = (tex, cfg, signKey, signOpts) => {
    const grp = new THREE.Group();
    const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 8), mats.lightMetal));
    post.position.y = 1.1;
    grp.add(post);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.position.set(0, 1.55, 0.06);
    grp.add(screen);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.68, 0.06), mats.darkMetal);
    back.position.set(0, 1.55, 0.01);
    grp.add(back);
    if (signKey) {
      const s = signPlane(sign(signKey, { w: 768, h: 160, ...signOpts }), 1.4, 0.29);
      s.position.set(0, 2.1, 0.06);
      grp.add(s);
    }
    grp.position.set(cfg.x, heightAt(cfg.x, cfg.z), cfg.z);
    grp.rotation.y = cfg.yaw;
    root.add(grp);
    return grp;
  };
  board(readout.texture, READOUT, 'map.solarArray', { text: 'SOLAR ARRAY', icon: 'sun', accent: '#ffd166' });
  const radiation = createRadiationBoard();
  board(radiation.texture, RADIATION_BOARD, null);

  // Power junction + cables to every module
  const jx = JUNCTION.x, jz = JUNCTION.z;
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
    [[10.4, -9.6], [8, -9.4], [5, -9], [jx + 0.45, jz]], // array -> junction
    [[jx - 0.45, jz], [0.8, -7.2], [0.6, -6.5]], // junction -> greenhouse (east side)
    [[jx - 0.3, jz + 0.3], [-1, -6], [-3.6, -4.2], [-4.4, -3.6]], // -> Life Support
    [[jx + 0.45, jz + 0.2], [3.2, -7.6], [3.6, -6.2]], // -> Lab
    [[10.4, -8.4], [11.6, -3], [12.4, 1.5], [12.2, 3.2]], // array -> Shelter (east, behind the berm)
  ];
  for (const c of cables) {
    const dense = [];
    for (let i = 0; i < c.length - 1; i++) for (let t = 0; t < 1; t += 0.2) dense.push([c[i][0] + (c[i + 1][0] - c[i][0]) * t, c[i][1] + (c[i + 1][1] - c[i][1]) * t]);
    dense.push(c[c.length - 1]);
    root.add(shadowed(tube(groundPath(dense), 0.06, cableMat, dense.length * 3)));
    root.add(tube(groundPath(dense, 0.12), 0.025, cableAccent, dense.length * 3));
  }

  // Signpost at the fork
  const post = signpost(mats, heightAt, SIGNPOST.x, SIGNPOST.z, [
    { text: 'LIFE SUPPORT', icon: 'arrowL', key: 'map.lifeSupport' },
    { text: 'GREENHOUSE', icon: 'arrowUp', key: 'map.greenhouse' },
    { text: 'SCIENCE LAB', icon: 'arrowUR', key: 'map.scienceLab' },
    { text: 'SHELTER', icon: 'arrowR', key: 'map.shelter' },
  ], textTargets);
  post.rotation.y = SIGNPOST.yaw;
  post.scale.setScalar(0.85);
  root.add(post);

  // Rover, weather mast, lander
  const rover = buildRover(mats);
  rover.position.set(ROVER.x, heightAt(ROVER.x, ROVER.z), ROVER.z);
  rover.rotation.y = ROVER.yaw;
  root.add(rover);
  const wm = buildWeatherMast(mats);
  wm.group.position.set(WEATHER_MAST.x, heightAt(WEATHER_MAST.x, WEATHER_MAST.z), WEATHER_MAST.z);
  root.add(wm.group);
  const lander = buildLander(mats);
  lander.position.set(LANDER.x, heightAt(LANDER.x, LANDER.z), LANDER.z);
  root.add(lander);

  const pickables = [];
  root.traverse((o) => { if (o.isMesh && o.userData.moduleKey) pickables.push(o); });

  const lampColors = { idle: 0x3cff8a, selected: 0x5ee1ff };
  function setSelected(keys) {
    const sel = new Set(keys || []);
    for (const [key, m] of Object.entries(markers)) m.group.visible = sel.has(key);
    for (const [key, part] of Object.entries(parts)) part.lamp.material.emissive.setHex(sel.has(key) ? lampColors.selected : lampColors.idle);
  }

  // Dust on the panels lowers their output: cells look dusty in a storm.
  const clean = new THREE.Color(0xffffff), dusty = new THREE.Color(0xc89c78);
  function setSolar(sunDir, output, lit, dust) {
    array.aimAt(sunDir);
    readout.draw(output, lit);
    array.cellMat.color.copy(clean).lerp(dusty, dust * 0.8);
    array.cellMat.emissiveIntensity = lit ? 0.4 : 0.08;
  }

  let radiationAlert = false;
  function setRadiation(alert) {
    radiationAlert = alert;
    radiation.setAlert(alert);
    if (!alert) { sh.beacon.material.emissiveIntensity = 0.05; sh.glow.material.opacity = 0; }
  }

  let windSpeed = 1;
  function setWind(dust) { windSpeed = 1.5 + 9 * dust; }

  const signMats = {};
  for (const [key, part] of Object.entries(parts)) part.group.traverse((o) => { if (o.isMesh && o.material.emissiveMap) signMats[key] = o.material; });
  function setHovered(key) {
    for (const [k, m] of Object.entries(signMats)) m.emissiveIntensity = k === key ? 0.9 : 0.35;
  }

  function update(t, dt) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 4);
    for (const [key, m] of Object.entries(markers)) {
      m.ring.material.opacity = 0.65 + 0.3 * pulse;
      m.tag.position.y = parts[key].labelY + 0.08 * Math.sin(t * 2 + key.length);
    }
    wm.spinner.rotation.y += windSpeed * dt;
    if (radiationAlert) {
      const on = (Math.sin(t * 7) + 1) / 2;
      sh.beacon.material.emissiveIntensity = 0.3 + 2.4 * on;
      sh.glow.material.opacity = 0.25 + 0.75 * on;
    }
  }

  // Mission state over modules: { crew, lab, greenhouse, shelter } -> {text, warn|done} or null.
  const plateY = { crew: 3.75, lab: MODULES.lab.legHeight + MODULES.lab.height + 1.9, greenhouse: MODULES.greenhouse.radius + 2.6, shelter: 4.4 };
  const plateDZ = { crew: 0.6, lab: 0.4, greenhouse: MODULES.greenhouse.length / 2, shelter: 0 };
  const plateDX = { shelter: -MODULES.shelter.length / 2 - 0.5 };
  const statusPlates = {};
  for (const key of Object.keys(plateY)) {
    const tex = makeStatusTexture();
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(2.8, 0.7, 1);
    const p = parts[key].group.position;
    sprite.position.set(p.x + (plateDX[key] ?? 0), p.y + plateY[key], p.z + plateDZ[key]);
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
    // The greenhouse shows its stage: growth 0/1, and food crates after a harvest.
    if (status.greenhouse?.stage !== undefined) gh.setGrowth(status.greenhouse.stage);
    if (status.greenhouse) gh.crate.visible = !!status.greenhouse.harvested;
  }

  function setTexts(t) {
    for (const { tex, key } of textTargets) tex.userData.setText(t(key));
    readout.setLabels({ output: t('map.solarOutput'), sunlight: t('map.clearSky'), shadow: t('map.dustStorm'), dimIcon: 'dust' });
    radiation.setLabels({ title: t('map.radiation'), normal: t('map.radNormal'), warning: t('map.radWarning') });
  }
  readout.setLabels({ output: 'Solar output', sunlight: 'Clear sky', shadow: 'Dust storm', dimIcon: 'dust' });

  return { root, pickables, setSelected, setSolar, setRadiation, setWind, setHovered, setTexts, setStatus, update, mats };
}
