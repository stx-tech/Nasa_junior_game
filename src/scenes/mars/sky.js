import * as THREE from 'three';
import { mulberry32, createSimplex2D } from '../moon/noise.js';
import { MOONS, bearingToDir } from './layout.js';

// Sky objects follow the camera (zero parallax), like on the Moon.
export const SKY_DISTANCE = 900;

// Daytime Mars sky: butterscotch near the horizon, a bit darker overhead, a pale
// glow around the small Sun. Dust thickens the glow and darkens everything.
export function buildSky(seed) {
  const group = new THREE.Group();
  group.name = 'mars-sky';

  const uniforms = {
    zenith: { value: new THREE.Color(0xa77a58) },
    horizon: { value: new THREE.Color(0xd8b48e) },
    sunDir: { value: new THREE.Vector3(0, 1, 0) },
    sunGlow: { value: 1 },
    dust: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_DISTANCE * 1.08, 48, 24),
    new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 zenith; uniform vec3 horizon; uniform vec3 sunDir; uniform float sunGlow; uniform float dust;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          // Below the horizon: the same colour as the far haze (fog).
          if (d.y < 0.0) col = horizon;
          float s = max(dot(d, normalize(sunDir)), 0.0);
          // Tight bright aureole when clear, wide dim one in a storm.
          float tight = pow(s, mix(120.0, 18.0, dust));
          float wide = pow(s, mix(9.0, 3.0, dust));
          col += vec3(1.0, 0.93, 0.82) * (tight * 0.55 + wide * 0.12) * sunGlow;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  dome.renderOrder = -3;
  dome.frustumCulled = false;
  group.add(dome);

  // Sun: ~2/3 of the size seen from Earth; soft disc. Fades and blurs in dust.
  const sunTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,252,244,1)');
    g.addColorStop(0.09, 'rgba(255,248,232,1)');
    g.addColorStop(0.13, 'rgba(255,236,206,0.4)');
    g.addColorStop(0.4, 'rgba(255,226,190,0.05)');
    g.addColorStop(1, 'rgba(255,226,190,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false, fog: false }));
  sun.scale.set(110, 110, 1);
  group.add(sun);

  // Phobos and Deimos: small grey lumpy bodies, lit from the Sun's side.
  const n = createSimplex2D(seed + 31);
  const moons = MOONS.map((m, i) => {
    const geo = new THREE.IcosahedronGeometry(1, 3);
    const p = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      const s = 1 + 0.18 * n(v.x * 1.7 + i * 5, v.y * 1.7 + v.z);
      v.multiplyScalar(s);
      v.x *= m.name === 'phobos' ? 1.35 : 1.1; // Phobos is potato-shaped
      p.setXYZ(k, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9c8a7c, roughness: 1, flatShading: true, fog: false, emissive: 0x3a2a20, emissiveIntensity: 0.6 }));
    const dir = new THREE.Vector3(...bearingToDir(m.bearing, m.elevation));
    mesh.position.copy(dir).multiplyScalar(SKY_DISTANCE);
    mesh.scale.setScalar(m.size);
    mesh.rotation.set(0.3 * i, 1.1 + i, 0.2);
    group.add(mesh);
    return mesh;
  });

  function setSky(cfg, dir) {
    uniforms.zenith.value.setHex(cfg.zenith);
    uniforms.horizon.value.setHex(cfg.horizon);
    uniforms.sunDir.value.set(dir[0], dir[1], dir[2]);
    uniforms.dust.value = cfg.dust;
    uniforms.sunGlow.value = 1 - 0.55 * cfg.dust;
    sun.position.set(dir[0], dir[1], dir[2]).multiplyScalar(SKY_DISTANCE * 0.98);
    sun.material.opacity = 1 - 0.75 * cfg.dust;
    const s = 110 * (1 + 1.4 * cfg.dust); // larger, softer halo in dust
    sun.scale.set(s, s, 1);
    // The moons disappear behind thick dust.
    for (const m of moons) m.visible = cfg.dust < 0.7;
  }
  function follow(camera) {
    group.position.copy(camera.position);
  }
  return { group, setSky, follow, moons };
}

// Wind-blown dust: soft points that live in a box around the camera and wrap.
export function buildDust(seed) {
  const rand = mulberry32(seed + 77);
  const count = 1600;
  const box = { x: 40, y: 12, z: 40 };
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * box.x;
    pos[i * 3 + 1] = rand() * box.y;
    pos[i * 3 + 2] = (rand() - 0.5) * box.z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const mat = new THREE.PointsMaterial({ map: tex, color: 0xd9a77a, size: 0.12, transparent: true, opacity: 0.2, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.name = 'mars-dust';
  const wind = new THREE.Vector3(2.2, 0, 0.8); // drifts toward ESE
  let strength = 0.2;
  function setDust(dust) {
    strength = dust;
    mat.opacity = 0.15 + 0.5 * dust;
    mat.size = 0.05 + 0.06 * dust;
    points.visible = true;
  }
  function update(dt, camera) {
    // World-space particles drift with the wind and wrap around the camera,
    // so walking through them shows real parallax.
    const speed = 0.4 + 2.2 * strength;
    const cx = camera.position.x, cy = camera.position.y - 3, cz = camera.position.z;
    const a = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      let x = a[i * 3] + wind.x * speed * dt;
      let y = a[i * 3 + 1] + Math.sin((x + i) * 0.7) * 0.15 * dt;
      let z = a[i * 3 + 2] + wind.z * speed * dt;
      if (x - cx > box.x / 2) x -= box.x; else if (x - cx < -box.x / 2) x += box.x;
      if (z - cz > box.z / 2) z -= box.z; else if (z - cz < -box.z / 2) z += box.z;
      if (y - cy > box.y) y -= box.y; else if (y < cy) y += box.y;
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { points, setDust, update };
}
