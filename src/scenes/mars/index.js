// Mars · Dust on the Horizon — environment module (same interface as the Moon).
//   const env = createMarsEnvironment();
//   scene.add(env.root, env.sky.group); scene.fog = env.fog; scene.background = env.background;
//   env.setShift(i, { solarOutput, radiation })   // dust, light, panels, readout, radiation board
//   env.setSelected(keys); env.setStatus({...}); env.update(dt, camera)
//   movement: env.resolveMove(x0, z0, x1, z1); y = env.heightAt(x, z) + env.eyeHeight
import * as THREE from 'three';
import {
  MARS_SEED, PLAY_AREA, SPAWN, MODULES, PLAYER_RADIUS, EYE_HEIGHT, SKY_BY_SHIFT, SOLAR_ARRAY, READOUT,
  RADIATION_BOARD, JUNCTION, ROVER, WEATHER_MAST, SIGNPOST, bearingToDir,
} from './layout.js';
import { createTerrainField, buildTerrainMesh } from './terrain.js';
import { buildBase } from './base.js';
import { buildProps } from './props.js';
import { buildSky, buildDust } from './sky.js';

export const MARS_ENV_ID = 'mars';
// Mars gravity is ~2.3x the Moon's: a shorter, lower hop (game tuning, not physics).
export const MARS_JUMP = { height: 0.7, airtime: 0.95, takeoffBoost: 1.05, airSpeed: 1.0, airControl: 4, airDrag: 0.8 };

let cached = null;

export function createMarsEnvironment({ seed = MARS_SEED } = {}) {
  if (cached && cached.seed === seed && !cached.disposed) return cached.api;

  const field = createTerrainField(seed);
  const heightAt = field.heightAt;
  const root = new THREE.Group();
  root.name = 'mars-environment';
  const terrain = buildTerrainMesh(field, seed);
  root.add(terrain);
  const base = buildBase(heightAt);
  root.add(base.root);
  const props = buildProps(heightAt, seed);
  root.add(props.root);
  const sky = buildSky(seed);
  const dust = buildDust(seed);
  root.add(dust.points);
  // Labels and status plates stay readable through the haze.
  root.traverse((o) => { if (o.isSprite) o.material.fog = false; });

  // ---- Lights ----
  const sunLight = new THREE.DirectionalLight(0xffe9d2, 3);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  const sc = sunLight.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 420;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.05;
  const shadowCenter = new THREE.Vector3(1, 0, -2);
  root.add(sunLight, sunLight.target);
  // Sky light is warm and strong on Mars: dust scatters sunlight everywhere.
  const fill = new THREE.HemisphereLight(0xc49a74, 0x6a3a26, 0.7);
  root.add(fill);
  const ambient = new THREE.AmbientLight(0xffe0c8, 0.1);
  root.add(ambient);
  const fog = new THREE.FogExp2(0xd8b48e, 0.006);

  // ---- Colliders ----
  const { crew, lab, greenhouse: gh, shelter: sh } = MODULES;
  const circles = [
    { x: crew.x, z: crew.z, r: crew.radius + 0.25 },
    { x: crew.x, z: crew.z + crew.radius + 0.7, r: 1.15 }, // airlock
    { x: crew.x - crew.radius - 0.75, z: crew.z + 0.05, r: 0.95 }, // tanks
    { x: gh.x + gh.radius + 0.75, z: gh.z + gh.length / 2 - 1.2, r: 0.55 }, // water tank
    { x: JUNCTION.x, z: JUNCTION.z, r: 0.75 },
    { x: READOUT.x, z: READOUT.z, r: 0.3 },
    { x: RADIATION_BOARD.x, z: RADIATION_BOARD.z, r: 0.3 },
    { x: SIGNPOST.x, z: SIGNPOST.z, r: 0.25 },
    { x: ROVER.x, z: ROVER.z, r: ROVER.r },
    { x: WEATHER_MAST.x, z: WEATHER_MAST.z, r: 0.35 },
    ...props.colliders,
  ];
  const boxes = [
    { minX: lab.x - lab.width / 2 - 0.15, maxX: lab.x + lab.width / 2 + 0.15, minZ: lab.z - lab.depth / 2 - 0.15, maxZ: lab.z + lab.depth / 2 + 0.15 },
    { minX: lab.x + 0.45, maxX: lab.x + 1.95, minZ: lab.z + lab.depth / 2, maxZ: lab.z + lab.depth / 2 + 1.5 },
    { minX: lab.x - 1.15, maxX: lab.x - 0.05, minZ: lab.z + lab.depth / 2 + 0.5, maxZ: lab.z + lab.depth / 2 + 1.35 },
    { minX: gh.x - gh.radius - 0.15, maxX: gh.x + gh.radius + 0.15, minZ: gh.z - gh.length / 2 - 0.15, maxZ: gh.z + gh.length / 2 + 1.15 },
    { minX: sh.x - sh.length / 2 - 1.25, maxX: sh.x + sh.length / 2 + 0.9, minZ: sh.z - sh.radius - 0.9, maxZ: sh.z + sh.radius + 0.9 },
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
    for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
    for (const b of boxes) if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
    return false;
  }
  function resolveMove(x0, z0, x1, z1) {
    if (!blocked(x1, z1)) return { x: x1, z: z1 };
    if (!blocked(x1, z0)) return { x: x1, z: z0 };
    if (!blocked(x0, z1)) return { x: x0, z: z1 };
    return { x: x0, z: z0 };
  }

  // ---- Shift: dust, light, panels, radiation ----
  const sunVec = new THREE.Vector3();
  const tmp = new THREE.Color();
  let currentShift = -1;
  let currentDust = 0;
  function setShift(shiftIndex, { solarOutput, radiation = false } = {}) {
    const i = Math.max(0, Math.min(SKY_BY_SHIFT.length - 1, shiftIndex));
    const cfg = SKY_BY_SHIFT[i];
    const d = bearingToDir(cfg.bearing, cfg.elevation);
    sunVec.set(...d);
    sunLight.position.copy(shadowCenter).addScaledVector(sunVec, 200);
    sunLight.target.position.copy(shadowCenter);
    sunLight.target.updateMatrixWorld();
    sunLight.intensity = cfg.sun;
    if ('intensity' in sunLight.shadow) sunLight.shadow.intensity = 1 - 0.6 * cfg.dust; // soft shadows in a storm
    sky.setSky(cfg, d);
    fog.color.setHex(cfg.horizon);
    fog.density = cfg.fog;
    api.background.setHex(cfg.horizon);
    fill.color.setHex(cfg.zenith).lerp(tmp.setHex(0xffffff), 0.35);
    // A storm is darker overall, and the light comes from the whole sky (soft, few shadows).
    fill.intensity = 0.75 - 0.25 * cfg.dust;
    ambient.intensity = 0.1 + 0.08 * cfg.dust;
    dust.setDust(cfg.dust);
    const output = solarOutput ?? Math.round(10 * (1 - 0.8 * cfg.dust));
    base.setSolar(d, output, output >= 5, cfg.dust);
    base.setWind(cfg.dust);
    base.setRadiation(radiation);
    currentShift = i;
    currentDust = cfg.dust;
  }

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(camera, ndcX, ndcY) {
    ndc.set(ndcX, ndcY);
    raycaster.setFromCamera(ndc, camera);
    raycaster.far = 40;
    const hits = raycaster.intersectObjects([terrain.userData.near, ...base.pickables], false);
    const h = hits[0];
    return h && h.object.userData.moduleKey ? h.object.userData.moduleKey : null;
  }

  let time = 0;
  function update(dt, camera) {
    time += dt;
    sky.follow(camera);
    dust.update(dt, camera);
    base.update(time, dt);
  }

  function dispose() {
    for (const group of [root, sky.group]) {
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
        for (const m of mats) {
          for (const k of Object.keys(m)) if (m[k] && m[k].isTexture) m[k].dispose();
          m.dispose();
        }
      });
    }
    sunLight.shadow.map?.dispose();
    cached.disposed = true;
    cached = null;
  }

  const yaw = -(SPAWN.bearing * Math.PI) / 180;
  const api = {
    id: MARS_ENV_ID,
    root,
    sky,
    fog,
    background: new THREE.Color(0xd8b48e),
    eyeHeight: EYE_HEIGHT,
    jump: MARS_JUMP,
    spawn: { x: SPAWN.x, z: SPAWN.z, yaw, pitch: SPAWN.pitch },
    heightAt,
    resolveMove,
    isBlocked: blocked,
    pickables: base.pickables,
    pick,
    setShift,
    setSelected: base.setSelected,
    setHovered: base.setHovered,
    setTexts: base.setTexts,
    setStatus: base.setStatus,
    update,
    dispose,
    get shift() { return currentShift; },
    get dust() { return currentDust; },
  };
  cached = { seed, api, disposed: false };
  setShift(0);
  return api;
}
