import * as THREE from 'three';
import { mulberry32, createSimplex2D } from './noise.js';
import {
  ROUTES, BOULDERS, MODULES, SOLAR_ARRAY, PLAY_AREA, SPAWN, BASE_PAD, FORK,
} from './layout.js';
import { ridgeHeight } from './terrain.js';

// Four rock shapes from a jittered icosahedron (seeded).
export function makeRockGeometries(seed) {
  const geos = [];
  const shapes = [
    { detail: 0, squash: 0.65, jitter: 0.22 }, // flat slab
    { detail: 1, squash: 0.8, jitter: 0.18 }, // rounded
    { detail: 0, squash: 1.0, jitter: 0.3 }, // angular chunk
    { detail: 1, squash: 0.55, jitter: 0.25 }, // low, wide
  ];
  shapes.forEach((sh, i) => {
    const rand = mulberry32(seed + 50 + i);
    const n = createSimplex2D(seed + 60 + i);
    const g = new THREE.IcosahedronGeometry(1, sh.detail);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    // Merge duplicate vertices consistently by hashing positions.
    const cache = new Map();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
      let s = cache.get(key);
      if (s === undefined) {
        s = 1 + (rand() - 0.5) * 2 * sh.jitter + 0.15 * n(v.x * 2, v.z * 2 + v.y);
        cache.set(key, s);
      }
      v.multiplyScalar(s);
      v.y *= sh.squash;
      p.setXYZ(k, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    geos.push(g);
  });
  return geos;
}

function distToPolyline(x, z, pts) {
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

function keepClear(x, z, margin) {
  for (const r of ROUTE_LIST) if (distToPolyline(x, z, r) < 1.8 + margin) return false;
  if (Math.hypot(x - MODULES.crew.x, z - MODULES.crew.z) < MODULES.crew.radius + 3 + margin) return false;
  if (Math.abs(x - MODULES.lab.x) < 4 + margin && Math.abs(z - MODULES.lab.z) < 3.8 + margin) return false;
  if (Math.abs(x - SOLAR_ARRAY.x) < 5 + margin && Math.abs(z - SOLAR_ARRAY.z) < 4.6 + margin) return false;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 2.5 + margin) return false;
  if (Math.hypot(x - 0.4, z + 5.6) < 1.5 + margin) return false; // junction
  return true;
}

export function buildProps(heightAt, seed) {
  const root = new THREE.Group();
  root.name = 'moon-props';
  const rand = mulberry32(seed + 11);
  const rockGeos = makeRockGeometries(seed);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8c, roughness: 1, flatShading: true });
  const rockMatDark = new THREE.MeshStandardMaterial({ color: 0x6c6c70, roughness: 1, flatShading: true });
  const colliders = [];

  // --- Boulders (colliders) ---
  for (const b of BOULDERS) {
    const m = new THREE.Mesh(rockGeos[b.type], b.type % 2 ? rockMat : rockMatDark);
    const s = b.r * 0.9;
    m.scale.set(s * (1 + rand() * 0.3), s * (0.8 + rand() * 0.4), s * (1 + rand() * 0.2));
    m.rotation.y = rand() * Math.PI * 2;
    m.position.set(b.x, heightAt(b.x, b.z) + s * 0.25, b.z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    colliders.push({ x: b.x, z: b.z, r: b.r });
  }

  // --- Instanced rocks: medium (cast shadows) + pebbles ---
  const place = (count, minS, maxS, near, far, margin) => {
    const out = [];
    let tries = 0;
    while (out.length < count && tries < count * 40) {
      tries++;
      const ang = rand() * Math.PI * 2;
      const rr = near + Math.sqrt(rand()) * (far - near);
      const x = BASE_PAD.x + Math.cos(ang) * rr;
      const z = BASE_PAD.z + Math.sin(ang) * rr;
      if (!keepClear(x, z, margin)) continue;
      if (ridgeHeight(x, z) > 5) continue;
      out.push({ x, z, s: minS + rand() * (maxS - minS) });
    }
    return out;
  };
  const dummy = new THREE.Object3D();
  const instRocks = (items, geoIdx, mat, cast) => {
    const mesh = new THREE.InstancedMesh(rockGeos[geoIdx], mat, items.length);
    items.forEach((it, i) => {
      dummy.position.set(it.x, heightAt(it.x, it.z) + it.s * 0.15, it.z);
      dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      dummy.scale.set(it.s * (0.8 + rand() * 0.5), it.s * (0.6 + rand() * 0.5), it.s * (0.8 + rand() * 0.5));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    return mesh;
  };
  const medium = place(90, 0.18, 0.5, 4, 40, 0.3);
  for (let t = 0; t < 4; t++) root.add(instRocks(medium.filter((_, i) => i % 4 === t), t, t % 2 ? rockMat : rockMatDark, true));
  const pebbles = place(520, 0.04, 0.14, 1, 34, -1.2);
  for (let t = 0; t < 4; t++) root.add(instRocks(pebbles.filter((_, i) => i % 4 === t), t % 2 ? 2 : 0, rockMatDark, false)); // 20-tri shapes for pebbles
  const farRocks = place(160, 0.6, 2.2, 36, 90, 0);
  root.add(instRocks(farRocks, 2, rockMatDark, false));

  // --- Rover tracks along routes (two treads) ---
  const treadTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#fff';
    for (let y = 0; y < 64; y += 16) { ctx.beginPath(); ctx.moveTo(4, y + 12); ctx.lineTo(32, y + 2); ctx.lineTo(60, y + 12); ctx.lineTo(60, y + 16); ctx.lineTo(32, y + 7); ctx.lineTo(4, y + 16); ctx.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x2c2c2e, transparent: true, opacity: 0.55, alphaMap: treadTex, roughness: 1,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const ribbon = (pts, offset, width) => {
    // resample polyline every 0.25 m
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(len / 0.25));
      for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
    }
    dense.push(pts[pts.length - 1]);
    const pos = []; const uv = []; const idx = [];
    let along = 0;
    for (let i = 0; i < dense.length; i++) {
      const [x, z] = dense[i];
      const [nx, nz] = dense[Math.min(i + 1, dense.length - 1)];
      const [px, pz] = dense[Math.max(i - 1, 0)];
      let dx = nx - px, dz = nz - pz; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      const sx = -dz, sz = dx; // side vector
      if (i > 0) along += Math.hypot(x - dense[i - 1][0], z - dense[i - 1][1]);
      for (const side of [-1, 1]) {
        const vx = x + sx * (offset + side * width / 2), vz = z + sz * (offset + side * width / 2);
        pos.push(vx, heightAt(vx, vz) + 0.02, vz);
        uv.push(side < 0 ? 0 : 1, along / 0.5);
      }
      if (i < dense.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, trackMat);
    m.receiveShadow = true;
    m.renderOrder = 1;
    return m;
  };
  for (const r of ROUTE_LIST) { root.add(ribbon(r, -0.65, 0.34)); root.add(ribbon(r, 0.65, 0.34)); }

  // --- Boot prints: spawn -> Life Support, and a loop near the lab ---
  const printGeo = new THREE.CircleGeometry(0.5, 10);
  printGeo.rotateX(-Math.PI / 2);
  const printMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const trails = [
    [[1.2, 12], [1.4, 9], [-0.8, 6.5], [-3.2, 4.4], [-4.6, 2.9]],
    [[3.4, 1.6], [6.5, 1.0], [8.4, -0.8], [9.6, -2.6]],
  ];
  const prints = [];
  for (const tr of trails) {
    for (let i = 0; i < tr.length - 1; i++) {
      const [ax, az] = tr[i]; const [bx, bz] = tr[i + 1];
      const len = Math.hypot(bx - ax, bz - az); const n = Math.floor(len / 0.38);
      const yaw = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k < n; k++) {
        const t = k / n; const side = (prints.length % 2 ? 1 : -1) * 0.13;
        const x = ax + (bx - ax) * t + Math.cos(yaw) * side;
        const z = az + (bz - az) * t - Math.sin(yaw) * side;
        prints.push({ x, z, yaw });
      }
    }
  }
  const printMesh = new THREE.InstancedMesh(printGeo, printMat, prints.length);
  prints.forEach((p, i) => {
    dummy.position.set(p.x, heightAt(p.x, p.z) + 0.015, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.set(0.11, 1, 0.26);
    dummy.updateMatrix();
    printMesh.setMatrixAt(i, dummy.matrix);
  });
  printMesh.receiveShadow = true;
  printMesh.renderOrder = 1;
  root.add(printMesh);

  // --- Guide posts along routes (white with orange reflector) ---
  const postGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.9, 6);
  postGeo.translate(0, 0.45, 0);
  const capGeo = new THREE.BoxGeometry(0.1, 0.16, 0.1);
  capGeo.translate(0, 0.95, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xf1f1ec, roughness: 0.5 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xe9832b, emissive: 0xe9832b, emissiveIntensity: 0.6 });
  const guide = [];
  for (const r of ROUTE_LIST) {
    for (let i = 0; i < r.length - 1; i++) {
      const [ax, az] = r[i]; const [bx, bz] = r[i + 1];
      const len = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.round(len / 3.2));
      const dx = (bx - ax) / len, dz = (bz - az) / len;
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        for (const side of [-1, 1]) {
          const x = ax + (bx - ax) * t - dz * side * 1.6;
          const z = az + (bz - az) * t + dx * side * 1.6;
          if (Math.hypot(x - FORK.x, z - FORK.z) < 1.6) continue;
          if (Math.hypot(x - MODULES.crew.x, z - MODULES.crew.z) < MODULES.crew.radius + 2.2) continue;
          if (Math.abs(x - MODULES.lab.x) < 3.2 && Math.abs(z - MODULES.lab.z) < 3.6) continue;
          guide.push([x, z]);
        }
      }
    }
  }
  const postMesh = new THREE.InstancedMesh(postGeo, postMat, guide.length);
  const capMesh = new THREE.InstancedMesh(capGeo, capMat, guide.length);
  guide.forEach(([x, z], i) => {
    dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    postMesh.setMatrixAt(i, dummy.matrix); capMesh.setMatrixAt(i, dummy.matrix);
  });
  postMesh.castShadow = true;
  root.add(postMesh, capMesh);

  // --- Perimeter markers (red/white), where the edge is not the ridge ---
  const markerGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6);
  markerGeo.translate(0, 0.65, 0);
  const stripeTex = (() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 64;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 64; y += 16) { ctx.fillStyle = '#d8402f'; ctx.fillRect(0, y, 8, 8); ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, y + 8, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const markerMat = new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 });
  const markers = [];
  const { minX, maxX, minZ, maxZ } = PLAY_AREA;
  for (let x = minX; x <= maxX; x += 4) { markers.push([x, minZ - 0.6]); markers.push([x, maxZ + 0.6]); }
  for (let z = minZ + 4; z < maxZ; z += 4) { markers.push([minX - 0.6, z]); markers.push([maxX + 0.6, z]); }
  const keptMarkers = markers.filter(([x, z]) => ridgeHeight(x, z) < 0.6);
  const markerMesh = new THREE.InstancedMesh(markerGeo, markerMat, keptMarkers.length);
  keptMarkers.forEach(([x, z], i) => {
    dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    markerMesh.setMatrixAt(i, dummy.matrix);
  });
  markerMesh.castShadow = true;
  root.add(markerMesh);

  return { root, colliders };
}
