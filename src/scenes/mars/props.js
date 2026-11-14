import * as THREE from 'three';
import { mulberry32 } from '../moon/noise.js';
import { makeRockGeometries } from '../moon/props.js';
import {
  ROUTES, BOULDERS, MODULES, SOLAR_ARRAY, PLAY_AREA, SPAWN, BASE_PAD, FORK, OUTCROPS, ROVER, JUNCTION,
} from './layout.js';
import { distToPolyline } from './terrain.js';

const ROUTE_LIST = Object.values(ROUTES);

function keepClear(x, z, margin) {
  for (const r of ROUTE_LIST) if (distToPolyline(x, z, r) < 1.8 + margin) return false;
  const { crew, lab, greenhouse: gh, shelter: sh } = MODULES;
  if (Math.hypot(x - crew.x, z - crew.z) < crew.radius + 3 + margin) return false;
  if (Math.abs(x - lab.x) < 4 + margin && Math.abs(z - lab.z) < 3.8 + margin) return false;
  if (Math.abs(x - gh.x) < gh.radius + 2.2 + margin && Math.abs(z - gh.z) < gh.length / 2 + 2.4 + margin) return false;
  if (Math.abs(x - sh.x) < sh.length / 2 + 3 + margin && Math.abs(z - sh.z) < sh.radius + 2.4 + margin) return false;
  if (Math.abs(x - SOLAR_ARRAY.x) < 4.4 + margin && Math.abs(z - SOLAR_ARRAY.z) < 4.2 + margin) return false;
  if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 2.5 + margin) return false;
  if (Math.hypot(x - ROVER.x, z - ROVER.z) < ROVER.r + 0.8 + margin) return false;
  if (Math.hypot(x - JUNCTION.x, z - JUNCTION.z) < 1.5 + margin) return false;
  return true;
}

function ribbonGeometry(heightAt, pts, offset, width, step = 0.25) {
  const dense = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i]; const [bx, bz] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
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
    const sx = -dz, sz = dx;
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
  return g;
}

export function buildProps(heightAt, seed) {
  const root = new THREE.Group();
  root.name = 'mars-props';
  const rand = mulberry32(seed + 11);
  const rockGeos = makeRockGeometries(seed);
  // Reddish basalt: darker than the dust, some lighter weathered rocks
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a4a36, roughness: 1, flatShading: true });
  const rockMatDark = new THREE.MeshStandardMaterial({ color: 0x4e3328, roughness: 1, flatShading: true });
  const colliders = [];
  const dummy = new THREE.Object3D();

  // --- Boulders (colliders) ---
  for (const b of BOULDERS) {
    const m = new THREE.Mesh(rockGeos[b.type], b.type % 2 ? rockMat : rockMatDark);
    const s = b.r * 0.9;
    m.scale.set(s * (1 + rand() * 0.3), s * (0.7 + rand() * 0.4), s * (1 + rand() * 0.2));
    m.rotation.y = rand() * Math.PI * 2;
    m.position.set(b.x, heightAt(b.x, b.z) + s * 0.2, b.z);
    m.castShadow = m.receiveShadow = true;
    root.add(m);
    colliders.push({ x: b.x, z: b.z, r: b.r });
  }

  // --- Light-toned layered bedrock slabs (outcrops) with "blueberries" around them ---
  const slabMat = new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.95, flatShading: true });
  const slabMat2 = new THREE.MeshStandardMaterial({ color: 0xb48862, roughness: 0.95, flatShading: true });
  const berries = [];
  for (const o of OUTCROPS) {
    const grp = new THREE.Group();
    const pieces = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < pieces; i++) {
      const w = o.w * (0.35 + rand() * 0.35), d = o.d * (0.35 + rand() * 0.35);
      const geo = new THREE.BoxGeometry(w, 0.06 + rand() * 0.08, d, 2, 1, 2);
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) + (rand() - 0.5) * 0.03);
      geo.computeVertexNormals();
      // stacked thin layers
      for (let layer = 0; layer < 2; layer++) {
        const slab = new THREE.Mesh(geo, layer ? slabMat2 : slabMat);
        const lx = (rand() - 0.5) * (o.w - w) * 0.9, lz = (rand() - 0.5) * (o.d - d) * 0.9;
        slab.position.set(lx + layer * 0.05, 0.03 + layer * 0.07, lz - layer * 0.04);
        slab.scale.set(1 - layer * 0.25, 1, 1 - layer * 0.25);
        slab.rotation.y = (rand() - 0.5) * 0.3;
        slab.castShadow = slab.receiveShadow = true;
        grp.add(slab);
      }
    }
    grp.position.set(o.x, heightAt(o.x, o.z), o.z);
    grp.rotation.y = o.yaw;
    root.add(grp);
    for (let i = 0; i < 55; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * (Math.max(o.w, o.d) * 0.9 + 0.6);
      berries.push([o.x + Math.cos(a) * r, o.z + Math.sin(a) * r]);
    }
  }
  const berryMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.014, 6, 4), new THREE.MeshStandardMaterial({ color: 0x77727a, roughness: 0.45, metalness: 0.3 }), berries.length);
  berries.forEach(([x, z], i) => {
    dummy.position.set(x, heightAt(x, z) + 0.1, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(0.7 + rand() * 0.6);
    dummy.updateMatrix();
    berryMesh.setMatrixAt(i, dummy.matrix);
  });
  root.add(berryMesh);

  // --- Instanced rocks: medium (cast shadows), pebbles, far ---
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
      out.push({ x, z, s: minS + rand() * (maxS - minS) });
    }
    return out;
  };
  const instRocks = (items, geoIdx, mat, cast) => {
    const mesh = new THREE.InstancedMesh(rockGeos[geoIdx], mat, items.length);
    items.forEach((it, i) => {
      dummy.position.set(it.x, heightAt(it.x, it.z) + it.s * 0.12, it.z);
      dummy.rotation.set(rand() * 0.4, rand() * Math.PI * 2, rand() * 0.4);
      dummy.scale.set(it.s * (0.8 + rand() * 0.5), it.s * (0.55 + rand() * 0.5), it.s * (0.8 + rand() * 0.5));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    return mesh;
  };
  const medium = place(70, 0.16, 0.45, 4, 40, 0.3);
  for (let t = 0; t < 4; t++) root.add(instRocks(medium.filter((_, i) => i % 4 === t), t, t % 2 ? rockMat : rockMatDark, true));
  const pebbles = place(600, 0.03, 0.12, 1, 34, -1.2);
  for (let t = 0; t < 4; t++) root.add(instRocks(pebbles.filter((_, i) => i % 4 === t), t % 2 ? 2 : 0, rockMatDark, false));
  const farRocks = place(180, 0.5, 2.4, 36, 110, 0);
  root.add(instRocks(farRocks, 2, rockMatDark, false));

  // --- Wheel tracks: base routes + the parked rover's own trail out into the plain ---
  const treadTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#fff';
    for (let y = 0; y < 64; y += 16) { ctx.fillRect(6, y + 2, 52, 7); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  })();
  const trackMat = new THREE.MeshStandardMaterial({
    color: 0x5a3322, transparent: true, opacity: 0.55, alphaMap: treadTex, roughness: 1,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const addRibbon = (pts, offset, width, mat = trackMat) => {
    const m = new THREE.Mesh(ribbonGeometry(heightAt, pts, offset, width), mat);
    m.receiveShadow = true;
    m.renderOrder = 1;
    root.add(m);
  };
  for (const r of ROUTE_LIST) { addRibbon(r, -0.65, 0.34); addRibbon(r, 0.65, 0.34); }
  // Rover trail: three wheel tracks per side, curving away to the south-west
  const trail = [[ROVER.x + 0.6, ROVER.z - 0.5], [ROVER.x - 2, ROVER.z + 2.4], [-11, 12.5], [-16, 15], [-28, 20], [-45, 23]];
  const roverTrackMat = trackMat.clone();
  roverTrackMat.opacity = 0.4;
  for (const off of [-0.82, 0.82]) addRibbon(trail, off, 0.17, roverTrackMat);

  // --- Boot prints: spawn -> Life Support and -> greenhouse ---
  const printGeo = new THREE.CircleGeometry(0.5, 10);
  printGeo.rotateX(-Math.PI / 2);
  const printMat = new THREE.MeshStandardMaterial({ color: 0x5c3624, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const trails = [
    [[1.2, 12], [1.3, 9], [-1, 6.5], [-3.8, 4.2], [-5.6, 2.8]],
    [[-0.2, 3.6], [-0.9, 0], [-1.6, -4.8]],
    [[4.6, 4.3], [7.4, 4.6]],
  ];
  const prints = [];
  for (const tr of trails) {
    for (let i = 0; i < tr.length - 1; i++) {
      const [ax, az] = tr[i]; const [bx, bz] = tr[i + 1];
      const len = Math.hypot(bx - ax, bz - az); const n = Math.floor(len / 0.38);
      const yaw = Math.atan2(bx - ax, bz - az);
      for (let k = 0; k < n; k++) {
        const t = k / n; const side = (prints.length % 2 ? 1 : -1) * 0.13;
        prints.push({ x: ax + (bx - ax) * t + Math.cos(yaw) * side, z: az + (bz - az) * t - Math.sin(yaw) * side, yaw });
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
  printMesh.renderOrder = 1;
  root.add(printMesh);

  // --- Guide posts along routes (white, orange reflector) ---
  const postGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.9, 6);
  postGeo.translate(0, 0.45, 0);
  const capGeo = new THREE.BoxGeometry(0.1, 0.16, 0.1);
  capGeo.translate(0, 0.95, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xece6dc, roughness: 0.5 });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xe9832b, emissive: 0xe9832b, emissiveIntensity: 0.7 });
  const guide = [];
  const nearModule = (x, z) => {
    const { crew, lab, greenhouse: gh, shelter: sh } = MODULES;
    return Math.hypot(x - crew.x, z - crew.z) < crew.radius + 2.2
      || (Math.abs(x - lab.x) < 3.2 && Math.abs(z - lab.z) < 3.6)
      || (Math.abs(x - gh.x) < gh.radius + 1.2 && Math.abs(z - gh.z) < gh.length / 2 + 1.8)
      || (Math.abs(x - sh.x) < sh.length / 2 + 2.2 && Math.abs(z - sh.z) < sh.radius + 1.6);
  };
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
          if (Math.hypot(x - FORK.x, z - FORK.z) < 2.2) continue;
          if (nearModule(x, z)) continue;
          if (ROUTE_LIST.some((o) => o !== r && distToPolyline(x, z, o) < 1.2)) continue;
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

  // --- Perimeter markers (red/white) ---
  const markerGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.3, 6);
  markerGeo.translate(0, 0.65, 0);
  const stripeTex = (() => {
    const c = document.createElement('canvas'); c.width = 8; c.height = 64;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 64; y += 16) { ctx.fillStyle = '#d8402f'; ctx.fillRect(0, y, 8, 8); ctx.fillStyle = '#f2f2ee'; ctx.fillRect(0, y + 8, 8, 8); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const markers = [];
  const { minX, maxX, minZ, maxZ } = PLAY_AREA;
  for (let x = minX; x <= maxX; x += 4) { markers.push([x, minZ - 0.6]); markers.push([x, maxZ + 0.6]); }
  for (let z = minZ + 4; z < maxZ; z += 4) { markers.push([minX - 0.6, z]); markers.push([maxX + 0.6, z]); }
  const markerMesh = new THREE.InstancedMesh(markerGeo, new THREE.MeshStandardMaterial({ map: stripeTex, roughness: 0.6 }), markers.length);
  markers.forEach(([x, z], i) => {
    dummy.position.set(x, heightAt(x, z), z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
    markerMesh.setMatrixAt(i, dummy.matrix);
  });
  markerMesh.castShadow = true;
  root.add(markerMesh);

  return { root, colliders };
}
