import * as THREE from 'three';
import { mulberry32 } from './noise.js';
import { EARTH, bearingToDir } from './layout.js';
import { makeEarthTexture } from './textures.js';

// Sky objects live in a group that is moved to the camera position every
// frame (zero parallax). They sit far away but inside camera.far so the
// ridge and horizon still occlude them through the depth buffer.
export const SKY_DISTANCE = 900;

export function buildSky(seed) {
  const group = new THREE.Group();
  group.name = 'moon-sky';

  // Restrained star field: few, small, dim; none below the horizon.
  const rand = mulberry32(seed + 400);
  const count = 1400;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  let n = 0;
  while (n < count) {
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2;
    const y = u; const r = Math.sqrt(1 - y * y);
    if (y < 0.02) continue;
    const d = SKY_DISTANCE * 1.05;
    pos[n * 3] = r * Math.cos(th) * d; pos[n * 3 + 1] = y * d; pos[n * 3 + 2] = r * Math.sin(th) * d;
    const b = 0.25 + Math.pow(rand(), 3) * 0.55;
    const warm = rand();
    col[n * 3] = b * (warm > 0.8 ? 1 : 0.9); col[n * 3 + 1] = b * 0.95; col[n * 3 + 2] = b * (warm < 0.2 ? 1 : 0.92);
    n++;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, depthWrite: false, toneMapped: false }));
  stars.renderOrder = -2;
  group.add(stars);

  // Earth: own lighting (fixed gibbous phase), ocean/cloud texture, thin blue limb.
  const earthDir = new THREE.Vector3(...bearingToDir(EARTH.bearing, EARTH.elevation));
  const scale = SKY_DISTANCE / EARTH.distance;
  const radius = EARTH.radius * scale;
  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: makeEarthTexture(seed) },
      lightDir: { value: new THREE.Vector3(0.75, 0.25, 0.6).normalize() },
    },
    vertexShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vView = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 lightDir;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        vec3 c = texture2D(map, vUv).rgb;
        float d = dot(normalize(vN), lightDir);
        float day = smoothstep(-0.08, 0.25, d);
        float rim = pow(1.0 - max(dot(normalize(vN), vView), 0.0), 3.0);
        vec3 col = c * (0.04 + 1.15 * day) + vec3(0.35, 0.6, 1.0) * rim * (0.25 + day) * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), earthMat);
  earth.position.copy(earthDir).multiplyScalar(SKY_DISTANCE);
  earth.rotation.set(0.35, 1.2, 0.2);
  group.add(earth);
  // Thin atmospheric halo (additive sprite)
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 40, 64, 64, 64);
    g.addColorStop(0, 'rgba(120,180,255,0.0)');
    g.addColorStop(0.74, 'rgba(120,180,255,0.0)');
    g.addColorStop(0.79, 'rgba(140,195,255,0.35)');
    g.addColorStop(0.9, 'rgba(120,180,255,0.08)');
    g.addColorStop(1, 'rgba(120,180,255,0.0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.set(radius * 2.62, radius * 2.62, 1);
  halo.position.copy(earth.position);
  group.add(halo);

  // Sun disc + glare (position set per shift).
  const sunTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,250,1)');
    g.addColorStop(0.12, 'rgba(255,253,240,1)');
    g.addColorStop(0.16, 'rgba(255,240,210,0.35)');
    g.addColorStop(0.45, 'rgba(255,230,190,0.06)');
    g.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  sun.scale.set(150, 150, 1);
  group.add(sun);

  function setSun(dir) {
    sun.position.set(dir[0], dir[1], dir[2]).multiplyScalar(SKY_DISTANCE * 0.98);
  }
  function follow(camera) {
    group.position.copy(camera.position);
  }
  return { group, setSun, follow, earthDir, earthRadius: radius };
}
