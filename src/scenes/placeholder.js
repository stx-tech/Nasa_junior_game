// Minimal environment for missions that do not have a detailed map yet (Mars, Earth).
// Same interface as the Moon environment so the shared stage can switch to it.
import * as THREE from 'three';

export function createPlaceholderEnvironment(mission) {
  const palette = mission.palette || { ground: 0xb5653a, sky: 0xd9a577, module: 0xe9e6df };
  const root = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: palette.ground, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(20, 30, 10);
  root.add(sun, new THREE.HemisphereLight(0xffffff, 0x444444, 0.8));
  const pickables = [];
  const mk = (key, x, color, label) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 3), new THREE.MeshStandardMaterial({ color }));
    m.position.set(x, 1.25, -8);
    m.userData.moduleKey = key;
    m.name = label;
    root.add(m);
    pickables.push(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.2, 48), new THREE.MeshBasicMaterial({ color: 0x5ee1ff, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(x, 0.05, -8); ring.visible = false;
    root.add(ring);
    return ring;
  };
  const rings = { crew: mk('crew', -4, palette.module, 'Life Support'), lab: mk('lab', 4, 0xc7d2dc, 'Science Lab') };
  const raycaster = new THREE.Raycaster();
  return {
    id: 'placeholder',
    root,
    sky: null,
    background: new THREE.Color(palette.sky),
    eyeHeight: 1.6,
    spawn: { x: 0, z: 6, yaw: 0, pitch: -0.05 },
    heightAt: () => 0,
    resolveMove: (x0, z0, x1, z1) => ({ x: Math.max(-40, Math.min(40, x1)), z: Math.max(-40, Math.min(40, z1)) }),
    pickables,
    pick(camera, nx, ny) {
      raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const h = raycaster.intersectObjects(pickables)[0];
      return h ? h.object.userData.moduleKey : null;
    },
    setShift() {},
    setSelected(keys) { for (const [k, r] of Object.entries(rings)) r.visible = (keys || []).includes(k); },
    setHovered() {},
    update() {},
    dispose() {
      root.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    },
  };
}
