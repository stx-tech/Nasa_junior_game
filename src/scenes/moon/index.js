// Moon · The Long Shadow — environment module.
// Usage (see docs/moon-map.md):
//   const env = createMoonEnvironment();           // build once, reuse across shifts
//   scene.add(env.root); scene.add(env.sky.group);
//   env.setShift(shiftIndex, { solarOutput });     // 0-based shift, number from the simulation
//   env.setSelected(['crew']);                      // keys from the game state
//   each frame: env.update(dt, camera)
//   movement: pos = env.resolveMove(prevX, prevZ, nextX, nextZ); y = env.heightAt(x, z) + EYE_HEIGHT

import * as THREE from 'three';
import {
  MOON_SEED, PLAY_AREA, SPAWN, MODULES, PLAYER_RADIUS, EYE_HEIGHT, SUN_BY_SHIFT, SOLAR_ARRAY, bearingToDir,
} from './layout.js';
import { createTerrainField, buildTerrainMesh, ridgeHeight } from './terrain.js';
import { buildBase } from './base.js';
import { buildProps } from './props.js';
import { buildSky } from './sky.js';

export { EYE_HEIGHT };
export const MOON_ENV_ID = 'moon';

let cached = null; // geometry/materials are built once per page (same seed -> same map)

export function createMoonEnvironment({ seed = MOON_SEED } = {}) {
  if (cached && cached.seed === seed && !cached.disposed) return cached.api;

  const field = createTerrainField(seed);
  const heightAt = field.heightAt;

  const root = new THREE.Group();
  root.name = 'moon-environment';
  const terrain = buildTerrainMesh(field, seed);
  root.add(terrain);
  const base = buildBase(heightAt);
  root.add(base.root);
  const props = buildProps(heightAt, seed);
  root.add(props.root);
  const sky = buildSky(seed);

  // ---- Lights ----
  const sunLight = new THREE.DirectionalLight(0xfff3dc, 3.4);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -40; sc.right = 40; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 420;
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.05;
  const shadowCenter = new THREE.Vector3(3, 0, -3);
  sunLight.target.position.copy(shadowCenter);
  root.add(sunLight, sunLight.target);
  // Moderate fill so shadowed modules and the route stay readable
  // (stands in for earthshine + light bounced off bright regolith).
  const fill = new THREE.HemisphereLight(0x9fb4d6, 0x5a5550, 0.55);
  root.add(fill);
  const ambient = new THREE.AmbientLight(0xffffff, 0.08);
  root.add(ambient);
  // Earthshine: sunlight reflected by Earth. Real and faint; boosted so a child
  // can still read the base while the ridge shadow covers it (shift 2).
  const earthshine = new THREE.DirectionalLight(0x9cc4ff, 0.0);
  earthshine.position.copy(sky.earthDir).multiplyScalar(100);
  root.add(earthshine);

  // ---- Colliders (circles + lab box) ----
  const circles = [
    { x: MODULES.crew.x, z: MODULES.crew.z, r: MODULES.crew.radius + 0.25 },
    { x: MODULES.crew.x, z: MODULES.crew.z + MODULES.crew.radius + 0.7, r: 1.15 }, // airlock tube
    { x: MODULES.crew.x - MODULES.crew.radius - 0.75, z: MODULES.crew.z + 0.05, r: 0.95 }, // tanks
    { x: 0.4, z: -5.6, r: 0.75 }, // power junction
    { x: 0.45, z: 4.2, r: 0.25 }, // fork signpost
    { x: 10.2, z: -3.2, r: 0.4 }, // solar readout post
    ...props.colliders,
  ];
  const lab = MODULES.lab;
  const boxes = [
    { minX: lab.x - lab.width / 2 - 0.15, maxX: lab.x + lab.width / 2 + 0.15, minZ: lab.z - lab.depth / 2 - 0.15, maxZ: lab.z + lab.depth / 2 + 0.15 },
    { minX: lab.x + 0.45, maxX: lab.x + 1.95, minZ: lab.z + lab.depth / 2, maxZ: lab.z + lab.depth / 2 + 1.5 }, // steps
    { minX: lab.x - 1.15, maxX: lab.x - 0.05, minZ: lab.z + lab.depth / 2 + 0.5, maxZ: lab.z + lab.depth / 2 + 1.35 }, // sample box
    // Solar array field (walk around it, not through the masts)
    {
      minX: SOLAR_ARRAY.x - ((SOLAR_ARRAY.perRow - 1) / 2) * SOLAR_ARRAY.panelSpacing - 1.1,
      maxX: SOLAR_ARRAY.x + ((SOLAR_ARRAY.perRow - 1) / 2) * SOLAR_ARRAY.panelSpacing + 1.1,
      minZ: SOLAR_ARRAY.z - SOLAR_ARRAY.rowSpacing - 0.8,
      maxZ: SOLAR_ARRAY.z + SOLAR_ARRAY.rowSpacing + 0.8,
    },
  ];

  function blocked(x, z) {
    const r = PLAYER_RADIUS;
    if (x < PLAY_AREA.minX || x > PLAY_AREA.maxX || z < PLAY_AREA.minZ || z > PLAY_AREA.maxZ) return true;
    if (ridgeHeight(x, z) > 0.9) return true; // the ridge slope is the eastern edge
    for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    for (const b of boxes) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    return false;
  }

  // Slide along obstacles: try full move, then each axis.
  function resolveMove(x0, z0, x1, z1) {
    if (!blocked(x1, z1)) return { x: x1, z: z1 };
    if (!blocked(x1, z0)) return { x: x1, z: z0 };
    if (!blocked(x0, z1)) return { x: x0, z: z1 };
    return { x: x0, z: z0 };
  }

  // ---- Shift lighting ----
  const sunVec = new THREE.Vector3();
  let currentShift = -1;
  function setShift(shiftIndex, { solarOutput } = {}) {
    const i = Math.max(0, Math.min(SUN_BY_SHIFT.length - 1, shiftIndex));
    const s = SUN_BY_SHIFT[i];
    const d = bearingToDir(s.bearing, s.elevation);
    sunVec.set(...d);
    sunLight.position.copy(shadowCenter).addScaledVector(sunVec, 200);
    sunLight.target.position.copy(shadowCenter);
    sunLight.target.updateMatrixWorld();
    sky.setSun(d);
    const shadowShift = (solarOutput ?? (i === 1 ? 0 : 7)) === 0;
    fill.intensity = shadowShift ? 0.85 : 0.55;
    earthshine.intensity = shadowShift ? 0.6 : 0.15;
    const output = solarOutput ?? (i === 1 ? 0 : 7);
    base.setSolar(d, output, output > 0);
    currentShift = i;
  }

  function setSelected(keys) { base.setSelected(keys); }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(camera, ndcX, ndcY) {
    ndc.set(ndcX, ndcY);
    raycaster.setFromCamera(ndc, camera);
    raycaster.far = 40;
    const hits = raycaster.intersectObjects([terrain.userData.near, ...base.pickables], false);
    // First hit wins: terrain/ridge in front of a module blocks the click.
    const h = hits[0];
    return h && h.object.userData.moduleKey ? h.object.userData.moduleKey : null;
  }

  let time = 0;
  function update(dt, camera) {
    time += dt;
    sky.follow(camera);
    base.update(time);
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) m[k].dispose();
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose();
        m.dispose();
      }
    });
    sky.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        if (o.material.uniforms?.map) o.material.uniforms.map.value.dispose();
        o.material.dispose();
      }
    });
    sunLight.shadow.map?.dispose();
    cached.disposed = true;
    cached = null;
  }

  const yaw = -(SPAWN.bearing * Math.PI) / 180; // camera yaw: 0 looks north (-z)
  const api = {
    id: MOON_ENV_ID,
    root,
    sky,
    background: new THREE.Color(0x000000),
    eyeHeight: EYE_HEIGHT,
    spawn: { x: SPAWN.x, z: SPAWN.z, yaw, pitch: SPAWN.pitch },
    heightAt,
    resolveMove,
    isBlocked: blocked,
    pickables: base.pickables,
    pick,
    setShift,
    setSelected,
    setHovered: base.setHovered,
    update,
    dispose,
    get shift() { return currentShift; },
  };
  cached = { seed, api, disposed: false };
  setShift(0);
  return api;
}
