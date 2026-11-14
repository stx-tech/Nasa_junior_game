import * as THREE from 'three';
import { createSimplex2D, fbm, smoothstep, mulberry32 } from '../moon/noise.js';
import {
  BASE_PAD, TERRAIN_CENTER, CRATERS, BIG_CRATER, BUTTES, ROUTES, SPAWN, OUTCROPS,
} from './layout.js';

export function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(ax + t * dx - x, az + t * dz - z));
  }
  return best;
}
const ROUTE_LIST = Object.values(ROUTES);

function craterProfile(x, z, c) {
  const d = Math.hypot(x - c.x, z - c.z) / c.r;
  if (d > 2) return 0;
  let h = 0;
  if (d < 1) h -= c.depth * (1 - d * d);
  const rimD = (d - 1) / 0.3;
  h += c.rim * Math.exp(-rimD * rimD);
  return h;
}

// Wind-shaped sand ripples (crests run NNW–SSE, ~2.6 m apart). Kept off the base pad.
function rippleAt(n, x, z) {
  const along = x * 0.93 + z * 0.37;
  const wobble = 1.2 * n(x / 9, z / 9);
  const s = Math.sin((along + wobble) * (Math.PI * 2 / 2.6));
  return Math.pow(0.5 + 0.5 * s, 2.2); // sharp crests, flat troughs
}

export function createTerrainField(seed) {
  const n1 = createSimplex2D(seed);
  const n2 = createSimplex2D(seed + 1);
  const n3 = createSimplex2D(seed + 2);
  const rand = mulberry32(seed + 7);
  const farCraters = [];
  for (let i = 0; i < 26; i++) {
    const ang = rand() * Math.PI * 2;
    const r = 45 + rand() * 260;
    farCraters.push({ x: TERRAIN_CENTER.x + Math.cos(ang) * r, z: TERRAIN_CENTER.z + Math.sin(ang) * r, r: 4 + rand() * 12, depth: 0.5 + rand() * 1.6, rim: 0.25 + rand() * 0.6 });
  }
  const craters = [...CRATERS, ...farCraters];

  // 0..1: how much the walkable base area flattens the ground here.
  function flatness(x, z) {
    const dPad = Math.hypot(x - BASE_PAD.x, z - BASE_PAD.z);
    const padW = 1 - smoothstep(BASE_PAD.radius, BASE_PAD.radius + BASE_PAD.blend, dPad);
    let routeD = Infinity;
    for (const r of ROUTE_LIST) routeD = Math.min(routeD, distToPolyline(x, z, r));
    const routeW = 1 - smoothstep(1.2, 3.2, routeD);
    const spawnW = 1 - smoothstep(2, 5, Math.hypot(x - SPAWN.x, z - SPAWN.z));
    return Math.max(padW, routeW * 0.85, spawnW * 0.85);
  }

  function heightAt(x, z) {
    const rc = Math.hypot(x - TERRAIN_CENTER.x, z - TERRAIN_CENTER.z);
    const flat = flatness(x, z);
    // Smooth plain + gentle swells; ripples on loose sand away from the base.
    let h = 0.45 * fbm(n1, x / 26, z / 26, 3) + 0.08 * fbm(n2, x / 5, z / 5, 2);
    h *= 1 - flat * 0.85;
    h += 0.11 * rippleAt(n2, x, z) * (1 - flat) * (1 - smoothstep(60, 140, rc));
    // Bedrock slabs sit a few cm proud of the sand.
    for (const o of OUTCROPS) {
      const dx = x - o.x, dz = z - o.z;
      const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
      const u = (dx * c - dz * s) / (o.w / 2), v = (dx * s + dz * c) / (o.d / 2);
      h += 0.08 * (1 - smoothstep(0.8, 1.15, Math.max(Math.abs(u), Math.abs(v))));
    }
    for (const c of craters) h += craterProfile(x, z, c);
    h += craterProfile(x, z, BIG_CRATER);
    for (const b of BUTTES) {
      const d = Math.hypot(x - b.x, z - b.z) / b.r;
      // Flat top, steep layered sides, apron of debris.
      h += b.height * (1 - smoothstep(0.82, 1.0, d)) + b.height * 0.18 * (1 - smoothstep(1.0, 1.7, d));
    }
    // Rolling land outside the base, rising to low hills at the horizon.
    const mid = smoothstep(35, 100, rc);
    h += mid * (2 + 4 * fbm(n3, x / 70, z / 70, 4));
    const rim = smoothstep(280, 580, rc);
    h += rim * (10 + 10 * fbm(n3, x / 150 + 7, z / 150 - 3, 3));
    return h;
  }

  return { heightAt, craters, flatness, rippleAt: (x, z) => rippleAt(n2, x, z) };
}

// Fine sand + grit texture (tileable): reddish-ochre, dark grains, a few bright flecks.
function makeSandTexture(seed) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const n = createSimplex2D(seed + 99);
  const rand = mulberry32(seed + 98);
  const TAU = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = (x / size) * TAU, b = (y / size) * TAU;
      const v = 0.5 * n(Math.cos(a) * 3 + Math.cos(b) * 2.1, Math.sin(a) * 3 + Math.sin(b) * 2.1)
        + 0.5 * n(Math.cos(a) * 9 + 40, Math.sin(b) * 9 + Math.sin(a) * 4);
      let g = 205 + v * 24 + (rand() - 0.5) * 30;
      let r = g, gg = g, bb = g;
      if (rand() < 0.02) { r -= 70; gg -= 70; bb -= 62; } // dark basalt grains / spherules
      if (rand() < 0.006) { r += 30; gg += 26; bb += 22; } // bright flecks
      const i = (y * size + x) * 4;
      img.data[i] = Math.max(0, Math.min(255, r));
      img.data[i + 1] = Math.max(0, Math.min(255, gg));
      img.data[i + 2] = Math.max(0, Math.min(255, bb));
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Polar mesh (same structure as the Moon: dense near rings, sparse to the horizon).
export function buildTerrainMesh(field, seed) {
  const radii = [0];
  let r = 0;
  while (r < 46) { r += 0.5; radii.push(r); }
  const nearRings = radii.length;
  while (r < 600) { r *= 1.07; radii.push(Math.min(r, 600)); }
  const seg = 180;
  const ringCount = radii.length;
  const vCount = 1 + (ringCount - 1) * seg;
  const pos = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const n = createSimplex2D(seed + 5);
  const cx = TERRAIN_CENTER.x, cz = TERRAIN_CENTER.z;
  // Base palette (linear-ish multipliers on the sand texture).
  const sand = [0.74, 0.42, 0.25];
  const dark = [0.46, 0.27, 0.18];
  const bright = [0.86, 0.62, 0.43];

  const setV = (i, x, z) => {
    const h = field.heightAt(x, z);
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
    uv[i * 2] = x / 3; uv[i * 2 + 1] = z / 3;
    // Darker basaltic sand in the ripple troughs and patches; brighter dust on crests and slabs.
    let tDark = 0.35 + 0.35 * n(x / 14, z / 14);
    const rip = field.rippleAt(x, z) * (1 - field.flatness(x, z));
    tDark -= 0.25 * rip;
    let tBright = 0.08 + 0.18 * rip;
    for (const c of field.craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1) tDark += 0.15 * (1 - d);
      else if (d < 1.6) tBright += 0.1 * (1 - (d - 1) / 0.6);
    }
    // Packed, dusty ground under the base and on the routes.
    tBright += 0.15 * field.flatness(x, z);
    tDark = Math.max(0, Math.min(1, tDark));
    tBright = Math.max(0, Math.min(1, tBright));
    for (let k = 0; k < 3; k++) {
      let v = sand[k] * (1 - tDark) + dark[k] * tDark;
      v = v * (1 - tBright) + bright[k] * tBright;
      v *= 1 + 0.04 * n(x / 2.5, z / 2.5);
      col[i * 3 + k] = v;
    }
    const far = Math.hypot(x - cx, z - cz);
    const fade = 0.08 * smoothstep(80, 400, far);
    for (let k = 0; k < 3; k++) col[i * 3 + k] *= 1 - fade;
  };

  setV(0, cx, cz);
  for (let k = 1; k < ringCount; k++) {
    for (let s = 0; s < seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      setV(1 + (k - 1) * seg + s, cx + Math.cos(a) * radii[k], cz + Math.sin(a) * radii[k]);
    }
  }
  const nearIdx = [];
  const farIdx = [];
  for (let s = 0; s < seg; s++) nearIdx.push(0, 1 + ((s + 1) % seg), 1 + s);
  for (let k = 1; k < ringCount - 1; k++) {
    const a0 = 1 + (k - 1) * seg, b0 = 1 + k * seg;
    const target = k < nearRings - 1 ? nearIdx : farIdx;
    for (let s = 0; s < seg; s++) {
      const s1 = (s + 1) % seg;
      target.push(a0 + s, a0 + s1, b0 + s);
      target.push(a0 + s1, b0 + s1, b0 + s);
    }
  }
  const all = new THREE.BufferGeometry();
  all.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  all.setIndex([...nearIdx, ...farIdx]);
  all.computeVertexNormals();
  const normals = all.getAttribute('normal');
  const makeGeo = (index) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', all.getAttribute('position'));
    g.setAttribute('normal', normals);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(index);
    g.computeBoundingSphere();
    return g;
  };
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, map: makeSandTexture(seed), roughness: 0.97, metalness: 0 });
  const near = new THREE.Mesh(makeGeo(nearIdx), mat);
  near.receiveShadow = true;
  near.castShadow = true;
  near.name = 'mars-terrain-near';
  const far = new THREE.Mesh(makeGeo(farIdx), mat);
  far.name = 'mars-terrain-far';
  const group = new THREE.Group();
  group.name = 'mars-terrain';
  group.add(near, far);
  group.userData.near = near;
  return group;
}
