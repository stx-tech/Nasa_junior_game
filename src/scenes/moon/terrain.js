import * as THREE from 'three';
import { createSimplex2D, fbm, smoothstep, mulberry32 } from './noise.js';
import {
  BASE_PAD, TERRAIN_CENTER, RIDGE, CRATERS, ROUTES, SPAWN,
} from './layout.js';

// Distance from point to a polyline (array of [x, z]).
function distToPolyline(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax, dz = bz - az;
    const len2 = dx * dx + dz * dz;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx - x, pz = az + t * dz - z;
    best = Math.min(best, Math.hypot(px, pz));
  }
  return best;
}

const ROUTE_LIST = Object.values(ROUTES);

export function ridgeHeight(x, z) {
  const dx = x - RIDGE.x, dz = z - RIDGE.z;
  const along = dx * RIDGE.dir[0] + dz * RIDGE.dir[1];
  const across = dx * RIDGE.dir[1] - dz * RIDGE.dir[0];
  const taper = 1 - smoothstep(RIDGE.halfLength - 3, RIDGE.halfLength + 2, Math.abs(along));
  // Slightly asymmetric: steeper face toward the base (negative 'across').
  const sigma = across < 0 ? RIDGE.sigma : RIDGE.sigma * 1.5;
  // Uneven crest: height and width vary along the ridge (deterministic, seed-free).
  const crest = 1 + 0.12 * Math.sin(along * 0.45 + 1.3) + 0.05 * Math.sin(along * 1.3 + 0.4);
  const width = sigma * (1 + 0.15 * Math.sin(along * 0.8 + 2.1));
  return RIDGE.height * crest * taper * Math.exp(-(across * across) / (width * width));
}

export function createTerrainField(seed) {
  const n1 = createSimplex2D(seed);
  const n2 = createSimplex2D(seed + 1);
  const n3 = createSimplex2D(seed + 2);

  // Scatter of small distant craters (outside the play area).
  const rand = mulberry32(seed + 7);
  const farCraters = [];
  for (let i = 0; i < 40; i++) {
    const ang = rand() * Math.PI * 2;
    const r = 40 + rand() * 230;
    farCraters.push({
      x: TERRAIN_CENTER.x + Math.cos(ang) * r,
      z: TERRAIN_CENTER.z + Math.sin(ang) * r,
      r: 3 + rand() * 14,
      depth: 0.6 + rand() * 2.2,
      rim: 0.3 + rand() * 0.8,
    });
  }
  const craters = [...CRATERS, ...farCraters];

  function craterProfile(x, z, c) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r;
    if (d > 1.8) return 0;
    let h = 0;
    if (d < 1) h -= c.depth * (1 - d * d);
    const rimD = (d - 1) / 0.28;
    h += c.rim * Math.exp(-rimD * rimD);
    return h;
  }

  function heightAt(x, z) {
    const rc = Math.hypot(x - TERRAIN_CENTER.x, z - TERRAIN_CENTER.z);

    // Gentle rolling ground + fine regolith bumps.
    let h = 0.55 * fbm(n1, x / 22, z / 22, 3) + 0.12 * fbm(n2, x / 4.5, z / 4.5, 2);

    // Flatten under the base and along routes, and at spawn.
    const dPad = Math.hypot(x - BASE_PAD.x, z - BASE_PAD.z);
    const padW = 1 - smoothstep(BASE_PAD.radius, BASE_PAD.radius + BASE_PAD.blend, dPad);
    let routeD = Infinity;
    for (const r of ROUTE_LIST) routeD = Math.min(routeD, distToPolyline(x, z, r));
    const routeW = 1 - smoothstep(1.2, 3.2, routeD);
    const spawnW = 1 - smoothstep(2, 5, Math.hypot(x - SPAWN.x, z - SPAWN.z));
    const flat = Math.max(padW, routeW * 0.8, spawnW * 0.8);
    h *= 1 - flat * 0.85;

    for (const c of craters) h += craterProfile(x, z, c);
    const rh = ridgeHeight(x, z);
    h += rh;
    // Rough, rocky texture on the ridge flanks (not on the walkable ground).
    if (rh > 0.3) h += Math.min(1, rh / 3) * 0.3 * fbm(n2, x / 2.5, z / 2.5, 3); // old, rounded lunar relief

    // Larger forms outside the play area, rising to a mountainous rim
    // (the visible horizon) so the mesh edge is never seen.
    const mid = smoothstep(32, 90, rc);
    h += mid * (3 + 7 * fbm(n3, x / 60, z / 60, 4));
    const rim = smoothstep(260, 560, rc);
    h += rim * (16 + 14 * fbm(n3, x / 140 + 11, z / 140 - 5, 3));
    return h;
  }

  return { heightAt, craters };
}

// Procedural regolith grain texture (tileable-ish noise speckle).
function makeRegolithTexture(seed) {
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
      // Sample on a torus so the texture tiles seamlessly.
      const a = (x / size) * TAU, b = (y / size) * TAU;
      const v = 0.5 * n(Math.cos(a) * 3 + Math.cos(b) * 2.1, Math.sin(a) * 3 + Math.sin(b) * 2.1)
        + 0.5 * n(Math.cos(a) * 9 + 40, Math.sin(b) * 9 + Math.sin(a) * 4);
      let g = 200 + v * 28 + (rand() - 0.5) * 34;
      if (rand() < 0.012) g -= 60; // tiny dark pebbles
      if (rand() < 0.008) g += 35; // bright grains
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, g));
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

// Polar mesh: dense rings in the play area, geometric growth to the horizon.
export function buildTerrainMesh(field, seed) {
  const radii = [0];
  let r = 0;
  while (r < 46) { r += 0.5; radii.push(r); }
  const nearRings = radii.length; // rings [0, nearRings) belong to the near mesh
  while (r < 600) { r *= 1.07; radii.push(Math.min(r, 600)); }
  const seg = 180;
  const ringCount = radii.length;
  const vCount = 1 + (ringCount - 1) * seg;
  const pos = new Float32Array(vCount * 3);
  const col = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const n = createSimplex2D(seed + 5);
  const cx = TERRAIN_CENTER.x, cz = TERRAIN_CENTER.z;

  const setV = (i, x, z) => {
    const h = field.heightAt(x, z);
    pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z;
    uv[i * 2] = x / 3.2; uv[i * 2 + 1] = z / 3.2;
    // Albedo: mid grey, darker crater floors, slightly brighter rims & ridge.
    let g = 0.56 + 0.05 * n(x / 9, z / 9) + 0.03 * n(x / 2.5, z / 2.5);
    for (const c of field.craters) {
      const d = Math.hypot(x - c.x, z - c.z) / c.r;
      if (d < 1) g -= 0.07 * (1 - d);
      else if (d < 1.6) g += 0.05 * (1 - (d - 1) / 0.6); // ejecta halo
    }
    g += 0.04 * Math.min(1, ridgeHeight(x, z) / 4);
    const far = Math.hypot(x - cx, z - cz);
    g -= 0.06 * smoothstep(80, 400, far);
    col[i * 3] = g * 0.98; col[i * 3 + 1] = g * 0.98; col[i * 3 + 2] = g * 1.02;
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
  // One shared vertex buffer -> normals are continuous across the seam.
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
  const geoNear = makeGeo(nearIdx);
  const geoFar = makeGeo(farIdx);

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: makeRegolithTexture(seed),
    roughness: 1,
    metalness: 0,
  });
  const near = new THREE.Mesh(geoNear, mat);
  near.receiveShadow = true;
  near.castShadow = true; // ridge, crater rims and bumps near the base cast shadows
  near.name = 'moon-terrain-near';
  const far = new THREE.Mesh(geoFar, mat);
  far.receiveShadow = false;
  far.castShadow = false; // outside the shadow camera anyway; skip it in the shadow pass
  far.name = 'moon-terrain-far';
  const group = new THREE.Group();
  group.name = 'moon-terrain';
  group.add(near, far);
  group.userData.near = near;
  return group;
}
