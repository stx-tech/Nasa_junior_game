// Earth · Keep the Pump Ready — first-person field station (same interface as the Moon and Mars).
import * as THREE from 'three';
import { createSimplex2D, fbm, mulberry32, smoothstep } from '../moon/noise.js';
import { makeSignTexture, makeStatusTexture, makeTagTexture, canvasTexture } from '../moon/textures.js';
import { M, shadowed, tagPickable, signPlane, tube, selectionMarker } from '../moon/base.js';
import { buildGreenhouse } from '../mars/base.js';
import { createWorldLayer, firstVisibleHit } from '../../world/layer.js';
import {
  EARTH_SEED, PLAY_AREA, EYE_HEIGHT, PLAYER_RADIUS, SPAWN, GREENHOUSE, BATTERY, BENCH, PUMP, SHED, CONSOLE, PIPE, TREES,
  SKY_BY_SHIFT, bearingToDir,
} from './layout.js';

export const EARTH_JUMP = { height: 0.35, airtime: 0.54, takeoffBoost: 1.0, airSpeed: 1.0, airControl: 4, airDrag: 1 };
const FONT = '"Segoe UI", Arial, sans-serif';
let cached = null;

export function createEarthEnvironment({ seed = EARTH_SEED } = {}) {
  if (cached && !cached.disposed) return cached.api;
  const n = createSimplex2D(seed);
  const n2 = createSimplex2D(seed + 3);
  // Flat yard, gentle hills outside the fence.
  const heightAt = (x, z) => {
    const r = Math.max(Math.abs(x) / 11, Math.abs(z) / 11);
    return smoothstep(1.1, 3, r) * (1.5 + 3 * fbm(n, x / 40, z / 40, 3)) + 0.04 * n2(x / 3, z / 3) * (1 - smoothstep(0.9, 1.1, r));
  };
  const root = new THREE.Group();
  root.name = 'earth-environment';

  // ---- Ground: grass with a gravel yard ----
  const geo = new THREE.PlaneGeometry(400, 400, 160, 160);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const yard = Math.max(Math.abs(x) / 9.5, Math.abs(z + 0.5) / 9.5) < 1 ? 1 : 0;
    const g = 0.5 + 0.12 * n(x / 6, z / 6);
    if (yard) { col[i * 3] = 0.62 * g + 0.15; col[i * 3 + 1] = 0.58 * g + 0.13; col[i * 3 + 2] = 0.5 * g + 0.1; }
    else { col[i * 3] = 0.28 * g; col[i * 3 + 1] = 0.55 * g + 0.08; col[i * 3 + 2] = 0.2 * g; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  ground.name = 'earth-ground';
  root.add(ground);

  const mats = {
    hull: M(0xeeeae2, { roughness: 0.6 }), darkMetal: M(0x3a3d42, { roughness: 0.6, metalness: 0.4 }),
    lightMetal: M(0xb0b4ba, { roughness: 0.45, metalness: 0.55 }), hatch: M(0x9ba3ad, { roughness: 0.5, metalness: 0.4 }),
    green: M(0x3fa86b), tank: M(0xf0ece6, { roughness: 0.35 }), water: M(0x3a8fd6),
    glass: new THREE.MeshStandardMaterial({ color: 0xdff0ff, transparent: true, opacity: 0.25, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false }),
    bed: M(0x7a6a58, { roughness: 0.8 }), soil: M(0x3b2a20, { roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x9aa64a, roughness: 0.8, flatShading: true, emissive: 0x2a3a10, emissiveIntensity: 0.2 }),
    veg: M(0xd9572e), growLight: new THREE.MeshStandardMaterial({ color: 0x333322, emissive: 0xfff2c0, emissiveIntensity: 0.2 }),
    wood: M(0x8a6240, { roughness: 0.9 }), roof: M(0x7b3b2e, { roughness: 0.8 }), orange: M(0xe9832b),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffd27a, emissiveIntensity: 0 }),
  };
  const textTargets = [];
  const tagTex = makeTagTexture('Selected');
  textTargets.push({ tex: tagTex, key: 'map.selected' });
  const sign = (key, opts) => { const tex = makeSignTexture(opts); textTargets.push({ tex, key }); return tex; };

  // ---- Greenhouse (decor: shows the plants' state) ----
  const gh = buildGreenhouse(mats, sign('map.greenhouse', { text: 'GREENHOUSE', icon: 'plant', accent: '#7ee2a0' }), seed);
  gh.group.position.set(GREENHOUSE.x, heightAt(GREENHOUSE.x, GREENHOUSE.z), GREENHOUSE.z);
  gh.group.traverse((o) => { if (o.isMesh) o.userData.interact = 'plants'; });
  root.add(gh.group);

  // ---- Battery cabinet with a live display ----
  const battery = new THREE.Group();
  battery.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.7, 0.7), M(0x4a5a6a, { metalness: 0.3 })))).position.y = 0.85;
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 512;
  const bctx = bc.getContext('2d');
  const btex = canvasTexture(bc);
  const bscreen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false }));
  bscreen.position.set(0, 1.05, 0.36);
  battery.add(bscreen);
  for (const sx of [-0.35, 0.35]) battery.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), mats.orange))).position.set(sx, 1.78, 0);
  battery.position.set(BATTERY.x, heightAt(BATTERY.x, BATTERY.z), BATTERY.z);
  battery.rotation.y = BATTERY.yaw;
  battery.traverse((o) => { if (o.isMesh) o.userData.interact = 'battery'; });
  root.add(battery);
  let batteryLabels = { title: 'BATTERY', unit: 'energy', pump: 'Pump after sunset: 5', test: 'Soil test: 3' };
  let batteryValue = 7;
  function drawBattery() {
    const fit = (text, w, size, maxW) => { bctx.font = `${w} ${size}px ${FONT}`; while (bctx.measureText(text).width > maxW && size > 14) { size -= 2; bctx.font = `${w} ${size}px ${FONT}`; } };
    bctx.fillStyle = '#0d131b'; bctx.fillRect(0, 0, 512, 512);
    bctx.strokeStyle = '#ffd166'; bctx.lineWidth = 12; bctx.strokeRect(6, 6, 500, 500);
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    bctx.fillStyle = '#ffd166'; fit(batteryLabels.title, 800, 56, 460); bctx.fillText(batteryLabels.title, 256, 62);
    // battery bar with 10 cells
    for (let i = 0; i < 10; i++) {
      bctx.fillStyle = i < batteryValue ? (batteryValue >= 5 ? '#58c27d' : '#ff8a5c') : '#28313c';
      bctx.fillRect(36 + i * 44, 110, 38, 70);
    }
    bctx.fillStyle = '#f4f1e8'; bctx.font = `800 130px ${FONT}`; bctx.fillText(String(batteryValue), 256, 270);
    bctx.fillStyle = '#c9ced6'; fit(batteryLabels.unit, 600, 40, 460); bctx.fillText(batteryLabels.unit, 256, 350);
    bctx.fillStyle = '#9ee3de'; fit(batteryLabels.pump, 700, 38, 470); bctx.fillText(batteryLabels.pump, 256, 410);
    bctx.fillStyle = '#ffe2b8'; fit(batteryLabels.test, 700, 38, 470); bctx.fillText(batteryLabels.test, 256, 462);
    btex.needsUpdate = true;
  }
  drawBattery();

  // ---- Soil test bench (key: lab) ----
  const bench = new THREE.Group();
  const top = shadowed(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 0.9), mats.wood));
  top.position.y = 0.85;
  bench.add(top);
  for (const sx of [-0.9, 0.9]) for (const sz of [-0.38, 0.38]) bench.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.07), mats.wood))).position.set(sx, 0.42, sz);
  const instrument = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.5), mats.hull));
  instrument.position.set(-0.4, 1.12, 0);
  bench.add(instrument);
  const iscreen = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.25), new THREE.MeshStandardMaterial({ color: 0x0d1b2a, emissive: 0x3cff8a, emissiveIntensity: 0.15 }));
  iscreen.position.set(-0.4, 1.15, 0.26);
  bench.add(iscreen);
  for (let i = 0; i < 3; i++) {
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 12), mats.glass);
    jar.position.set(0.35 + i * 0.22, 0.98, 0.1);
    bench.add(jar);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 12), mats.soil);
    soil.position.set(0.35 + i * 0.22, 0.94, 0.1);
    bench.add(soil);
  }
  const benchSign = signPlane(sign('map.soilTest', { text: 'SOIL TEST', icon: 'sample', accent: '#f2c230', w: 768, h: 160 }), 1.6, 0.33);
  benchSign.position.set(0, 1.75, -0.4);
  bench.add(benchSign);
  bench.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), mats.darkMetal))).position.set(0, 1.3, -0.42);
  bench.position.set(BENCH.x, heightAt(BENCH.x, BENCH.z), BENCH.z);
  bench.rotation.y = BENCH.yaw;
  tagPickable(bench, 'lab');
  root.add(bench);

  // ---- Water pump (key: pump) + pipe to the greenhouse ----
  const pump = new THREE.Group();
  pump.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.25, 0.8), mats.darkMetal))).position.y = 0.12;
  const motor = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 18), M(0x2f6fb5, { metalness: 0.4 })));
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0.1, 0.55, 0);
  pump.add(motor);
  const head = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 16), mats.lightMetal));
  head.position.set(-0.35, 0.6, 0);
  pump.add(head);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.03, 8, 20), mats.orange);
  wheel.position.set(-0.35, 0.95, 0);
  wheel.rotation.x = Math.PI / 2;
  pump.add(wheel);
  const pumpLamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0x555555, emissiveIntensity: 0.6 }));
  pumpLamp.position.set(0.45, 0.95, 0);
  pump.add(pumpLamp);
  const pumpPost = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 0.05), mats.darkMetal));
  pumpPost.position.set(0.0, 1.0, -0.45);
  pump.add(pumpPost);
  const pumpSign = signPlane(sign('map.pump', { text: 'WATER PUMP', icon: 'arrowR', accent: '#7cc8ff', w: 768, h: 160 }), 1.4, 0.29);
  pumpSign.position.set(0, 1.6, -0.42);
  pump.add(pumpSign);
  pump.position.set(PUMP.x, heightAt(PUMP.x, PUMP.z), PUMP.z);
  tagPickable(pump, 'pump');
  root.add(pump);
  const pipePts = PIPE.map(([x, z]) => [x, heightAt(x, z) + 0.15, z]);
  root.add(shadowed(tube(pipePts, 0.09, new THREE.MeshStandardMaterial({ color: 0xd8e6ef, transparent: true, opacity: 0.45, roughness: 0.2 }), 24)));
  const flowTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1d6fd6'; ctx.fillRect(0, 0, 64, 16);
    ctx.fillStyle = '#9fd8ff'; for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 4, 8, 8);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 1); return t;
  })();
  const water = tube(pipePts, 0.06, new THREE.MeshStandardMaterial({ map: flowTex, emissive: 0x2a8fff, emissiveIntensity: 0.5, emissiveMap: flowTex }), 24);
  water.visible = false;
  root.add(water);

  // ---- Shed, fence, trees, lamps ----
  const shed = new THREE.Group();
  shed.add(shadowed(new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 3), M(0xd9cbb0)))).position.y = 1.3;
  const roofGeo = new THREE.CylinderGeometry(0.01, 2.9, 1.2, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.scale(1.05, 1, 0.8);
  shed.add(shadowed(new THREE.Mesh(roofGeo, mats.roof))).position.y = 3.2;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), mats.bulb);
  win.position.set(-0.8, 1.6, 1.51);
  shed.add(win);
  shed.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9), M(0x6b4a30))).position.set(0.9, 0.95, 1.51);
  shed.position.set(SHED.x, heightAt(SHED.x, SHED.z), SHED.z);
  root.add(shed);
  const fenceMat = mats.wood;
  const posts = [];
  const { minX, maxX, minZ, maxZ } = PLAY_AREA;
  for (let x = minX - 0.6; x <= maxX + 0.6; x += 2) { posts.push([x, minZ - 0.6]); posts.push([x, maxZ + 0.6]); }
  for (let z = minZ - 0.6 + 2; z < maxZ + 0.6; z += 2) { posts.push([minX - 0.6, z]); posts.push([maxX + 0.6, z]); }
  const postMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), fenceMat, posts.length);
  const d = new THREE.Object3D();
  posts.forEach(([x, z], i) => { d.position.set(x, heightAt(x, z) + 0.55, z); d.updateMatrix(); postMesh.setMatrixAt(i, d.matrix); });
  postMesh.castShadow = true;
  root.add(postMesh);
  for (const [a, b, len, rot] of [[0, minZ - 0.6, maxX - minX + 1.2, 0], [0, maxZ + 0.6, maxX - minX + 1.2, 0], [minX - 0.6, (minZ + maxZ) / 2, maxZ - minZ + 1.2, Math.PI / 2], [maxX + 0.6, (minZ + maxZ) / 2, maxZ - minZ + 1.2, Math.PI / 2]]) {
    for (const h of [0.45, 0.9]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.05), fenceMat);
      rail.position.set(a, h, b);
      rail.rotation.y = rot;
      root.add(rail);
    }
  }
  const rand = mulberry32(seed + 5);
  for (const [x, z] of TREES) {
    const tree = new THREE.Group();
    const h = 2 + rand() * 1.5;
    tree.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, h, 8), mats.wood))).position.y = h / 2;
    const crown = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + rand() * 0.6, 1), new THREE.MeshStandardMaterial({ color: 0x3d7a3a, roughness: 0.9, flatShading: true })));
    crown.position.y = h + 0.8;
    tree.add(crown);
    tree.position.set(x, heightAt(x, z), z);
    root.add(tree);
  }
  const lamps = [];
  for (const [x, z] of [[-1.2, 2.4], [3.6, -1.6], [-6, -1]]) {
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.8, 8), mats.darkMetal));
    pole.position.set(x, heightAt(x, z) + 1.4, z);
    root.add(pole);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mats.bulb);
    bulb.position.set(x, heightAt(x, z) + 2.85, z);
    root.add(bulb);
    const light = new THREE.PointLight(0xffd8a0, 0, 14, 1.6);
    light.position.copy(bulb.position);
    root.add(light);
    lamps.push(light);
  }

  // ---- Selection rings, status plates ----
  const markers = {};
  for (const [key, obj, r, y] of [['lab', bench, 1.8, 2.5], ['pump', pump, 1.4, 2.3]]) {
    const m = selectionMarker(r, y, tagTex);
    m.group.position.copy(obj.position);
    root.add(m.group);
    markers[key] = m;
  }
  const plates = {};
  for (const [key, x, y, z] of [['battery', BATTERY.x, 2.6, BATTERY.z], ['greenhouse', GREENHOUSE.x, 3.9, GREENHOUSE.z + 3.6], ['pump', PUMP.x, 2.6, PUMP.z]]) {
    const tex = makeStatusTexture();
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.scale.set(2.8, 0.7, 1);
    s.position.set(x, heightAt(x, z) + y, z);
    s.visible = false;
    s.renderOrder = 9;
    root.add(s);
    plates[key] = { s, tex };
  }

  const layer = createWorldLayer({
    heightAt, consoleAt: CONSOLE,
    shapes: {
      lab: { circle: [BENCH.x, BENCH.z, 1.05] },
      pump: { circle: [PUMP.x, PUMP.z, 0.65] },
      battery: { circle: [BATTERY.x, BATTERY.z, 0.75] },
      plants: { box: [GREENHOUSE.x - GREENHOUSE.radius - 0.2, GREENHOUSE.x + GREENHOUSE.radius + 1.3, GREENHOUSE.z - GREENHOUSE.length / 2, GREENHOUSE.z + GREENHOUSE.length / 2 + 1.2] },
    },
    markerHeights: { lab: 2.9, pump: 2.6, battery: 3.0, plants: 3.9 },
  });
  root.add(layer.root);

  // ---- Sky: gradient dome, sun, stars ----
  const skyGroup = new THREE.Group();
  const uniforms = { zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: 1 } };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform float glow; varying vec3 vDir;
      void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(horizon, zenith, pow(h, 0.5)); if (d.y < 0.0) c = horizon * 0.8;
        float s = max(dot(d, normalize(sunDir)), 0.0); c += vec3(1.0, 0.75, 0.45) * (pow(s, 60.0) * 0.8 + pow(s, 6.0) * 0.25) * glow;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  }));
  dome.renderOrder = -3;
  skyGroup.add(dome);
  const starPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const u = rand() * 0.9 + 0.1, th = rand() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    starPos.set([r * Math.cos(th) * 850, u * 850, r * Math.sin(th) * 850], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, transparent: true, opacity: 0 }));
  skyGroup.add(stars);
  const sunSprite = new THREE.Mesh(new THREE.CircleGeometry(16, 24), new THREE.MeshBasicMaterial({ color: 0xffe2a0, toneMapped: false }));
  skyGroup.add(sunSprite);

  const sunLight = new THREE.DirectionalLight(0xffd6a0, 2);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  Object.assign(sunLight.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 400 });
  sunLight.shadow.bias = -0.0005;
  root.add(sunLight, sunLight.target);
  const fill = new THREE.HemisphereLight(0xbcd4ff, 0x4a5a30, 0.9);
  root.add(fill);
  const fog = new THREE.Fog(0xf4b67a, 60, 260);

  function setShift(i) {
    const cfg = SKY_BY_SHIFT[Math.max(0, Math.min(SKY_BY_SHIFT.length - 1, i))];
    const dir = bearingToDir(cfg.bearing, cfg.elevation);
    uniforms.zenith.value.setHex(cfg.zenith);
    uniforms.horizon.value.setHex(cfg.horizon);
    uniforms.sunDir.value.set(...dir);
    uniforms.glow.value = cfg.night ? 0.15 : 1;
    sunSprite.position.set(...dir).multiplyScalar(820);
    sunSprite.lookAt(0, 0, 0);
    sunSprite.visible = !cfg.night;
    stars.material.opacity = cfg.night ? 0.85 : 0;
    sunLight.position.set(dir[0] * 100, Math.max(dir[1], 0.05) * 100, dir[2] * 100);
    sunLight.intensity = cfg.sun;
    sunLight.castShadow = !cfg.night;
    fill.color.setHex(cfg.night ? 0x6d84c4 : 0xbcd4ff);
    fill.intensity = cfg.night ? 0.55 : 0.9;
    fog.color.setHex(cfg.horizon);
    api.background.setHex(cfg.horizon);
    mats.bulb.emissiveIntensity = cfg.night ? 1.6 : 0;
    for (const l of lamps) l.intensity = cfg.night ? 18 : 0;
  }

  // ---- Colliders ----
  const circles = [
    { x: BATTERY.x, z: BATTERY.z, r: 0.8 }, { x: BENCH.x, z: BENCH.z, r: 1.05 }, { x: PUMP.x, z: PUMP.z, r: 0.65 },
    { x: -1.2, z: 2.4, r: 0.15 }, { x: 3.6, z: -1.6, r: 0.15 }, { x: -6, z: -1, r: 0.15 },
    ...layer.colliders,
  ];
  const boxes = [
    { minX: GREENHOUSE.x - GREENHOUSE.radius - 0.15, maxX: GREENHOUSE.x + GREENHOUSE.radius + 1.3, minZ: GREENHOUSE.z - GREENHOUSE.length / 2 - 0.15, maxZ: GREENHOUSE.z + GREENHOUSE.length / 2 + 1.15 },
    { minX: SHED.x - 2.1, maxX: SHED.x + 2.1, minZ: SHED.z - 1.6, maxZ: SHED.z + 1.6 },
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
  const pickables = [];
  root.traverse((o) => { if (o.isMesh && (o.userData.moduleKey || o.userData.interact)) pickables.push(o); });
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(camera, x, y) {
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    raycaster.far = 40;
    const h = firstVisibleHit(raycaster.intersectObjects([ground, ...pickables], false));
    return h ? (h.object.userData.moduleKey ?? h.object.userData.interact ?? null) : null;
  }

  let time = 0;
  let pumping = false;
  function update(dt, camera) {
    time += dt;
    skyGroup.position.copy(camera.position);
    layer.update(dt);
    if (pumping) flowTex.offset.x -= dt * 1.5;
    for (const m of Object.values(markers)) m.ring.material.opacity = 0.65 + 0.3 * (0.85 + 0.15 * Math.sin(time * 4));
  }
  function setSelected(keys) {
    const sel = new Set(keys || []);
    for (const [k, m] of Object.entries(markers)) m.group.visible = sel.has(k);
    pumpLamp.material.emissive.setHex(sel.has('pump') ? 0x5ee1ff : (pumping ? 0x3cff8a : 0x555555));
  }
  // { battery: {value, text}, greenhouse: {text, done}, watered, pump: {text} }
  function setStatus(status = {}) {
    if (status.batteryValue !== undefined) { batteryValue = status.batteryValue; drawBattery(); }
    for (const [key, p] of Object.entries(plates)) {
      const s = status[key];
      p.s.visible = !!s;
      if (s) p.tex.userData.set(s.text, s.warn ? 'warn' : (s.done ? 'done' : 'normal'));
    }
    pumping = !!status.watered;
    water.visible = pumping;
    gh.setGrowth(pumping ? 2 : 0);
    mats.leaf.color.setHex(pumping ? 0x4fae4a : 0x9aa64a); // dry, yellowish leaves turn green after watering
    gh.crate.visible = false;
  }
  function setTexts(t) {
    for (const { tex, key } of textTargets) tex.userData.setText(t(key));
    batteryLabels = { title: t('map.battery'), unit: t('map.batteryUnit'), pump: t('map.batteryPump'), test: t('map.batteryTest') };
    drawBattery();
    layer.setTexts(t);
  }
  function dispose() {
    for (const g of [root, skyGroup]) g.traverse((o) => {
      o.geometry?.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of ms) { for (const k of Object.keys(m)) if (m[k]?.isTexture) m[k].dispose(); m.dispose(); }
    });
    sunLight.shadow.map?.dispose();
    cached.disposed = true;
    cached = null;
  }
  const api = {
    id: 'earth', root, sky: { group: skyGroup }, fog, background: new THREE.Color(0xf4b67a), eyeHeight: EYE_HEIGHT, jump: EARTH_JUMP,
    spawn: { x: SPAWN.x, z: SPAWN.z, yaw: -(SPAWN.bearing * Math.PI) / 180, pitch: SPAWN.pitch },
    heightAt, resolveMove, isBlocked: blocked, pick, setShift, setSelected, setHovered() {}, setTexts, setStatus, update, dispose,
    interactDistance: layer.distance, setRocks() {}, setConsole: layer.setConsole, setMarker: layer.setMarker,
  };
  cached = { api, disposed: false };
  setShift(0);
  return api;
}
