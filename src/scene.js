import * as THREE from 'three';
import { createMoonEnvironment } from './scenes/moon/index.js';

const appearance = {
  mars: [0x3b2427, 0xa45a40],
  earth: [0x173043, 0x536d47],
};

export function mountScene(container, mission, shift, selected, onSelect, pose) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    container.textContent = 'The 3D view is unavailable. Use the module controls below.';
    return () => {};
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'First-person base. Press Enter to capture the mouse, W A S D to move, arrow keys to look, and E to select a module.');
  container.append(renderer.domElement);
  const reticle = document.createElement('span');
  reticle.className = 'reticle';
  reticle.setAttribute('aria-hidden', 'true');
  container.append(reticle);
  const mouseNotice = document.createElement('p');
  mouseNotice.className = 'mouse-notice';
  mouseNotice.setAttribute('role', 'status');
  mouseNotice.hidden = true;
  container.append(mouseNotice);

  const scene = new THREE.Scene();
  const moon = mission.id === 'moon' ? createMoonEnvironment() : null;
  const camera = new THREE.PerspectiveCamera(65, 1, 0.06, moon ? 2000 : 80);
  camera.rotation.order = 'YXZ';
  const targets = moon ? [] : addPlaceholder();
  if (moon) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    scene.background = moon.background;
    scene.add(moon.root, moon.sky.group);
    if (pose.x === undefined) Object.assign(pose, moon.spawn);
    moon.setShift(shift, { solarOutput: mission.generation[shift] });
  } else if (pose.x === undefined) {
    Object.assign(pose, { x: 0, z: 4.3, yaw: 0, pitch: -0.14 });
  }

  function addPlaceholder() {
    const [sky, ground] = appearance[mission.id];
    scene.background = new THREE.Color(sky);
    scene.add(new THREE.HemisphereLight(0xdce8ff, ground, 2));
    const sun = new THREE.DirectionalLight(0xffe6bd, 1 + mission.generation[shift] / 6);
    sun.position.set(-6, 4, 3);
    scene.add(sun);

    function box(size, position, color) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(...size),
        new THREE.MeshStandardMaterial({ color }),
      );
      mesh.position.set(...position);
      scene.add(mesh);
      return mesh;
  }

  box([16, 0.3, 10], [0, -0.19, 0], ground);
  const hitTargets = mission.modules.map((key, index) => {
    const x = (index - (mission.modules.length - 1) / 2) * 2.65;
    const building = box([1.75, 1.15, 1.65], [x, 0.58, 0], 0xc6cbd4);
    const roof = box([1.87, 0.2, 1.75], [x, 1.22, 0], selected.has(key) ? 0x44ddac : 0x4a6388);
    building.userData.key = roof.userData.key = key;
    roof.userData.isRoof = true;
    return [building, roof];
  }).flat();
  if (mission.id !== 'earth') {
    box([4.5, 0.13, 1.3], [0, 0.65, -2.2], mission.generation[shift] ? 0x43649f : 0x283044).rotation.x = 0.22;
  }
  return hitTargets;
  }

  const ray = new THREE.Raycaster();
  const center = new THREE.Vector2();
  const canvas = renderer.domElement;
  const keys = new Set();
  const locked = () => document.pointerLockElement === canvas;
  let lockUnavailable = typeof canvas.requestPointerLock !== 'function';
  let lockPending = false;
  let fallbackLook = false;

  function setFallbackLook(enabled) {
    fallbackLook = enabled;
    container.classList.toggle('mouse-look', enabled);
    mouseNotice.textContent = 'Move the mouse inside the scene to look. Click a module to select it. Press Esc to stop.';
    mouseNotice.hidden = !enabled;
  }

  function lockFailed() {
    if (!lockPending) return;
    lockPending = false;
    lockUnavailable = true;
    if (document.activeElement === canvas) setFallbackLook(true);
  }

  function captureMouse() {
    if (lockUnavailable) {
      setFallbackLook(true);
      return;
    }
    if (lockPending) return;
    lockPending = true;
    try {
      canvas.requestPointerLock()?.catch(lockFailed);
    } catch {
      lockFailed();
    }
  }

  function lockChanged() {
    if (document.pointerLockElement && !locked()) return;
    lockPending = false;
    keys.clear();
    container.classList.toggle('mouse-locked', locked());
  }

  function lookWithMouse(event) {
    if (!locked() && !(fallbackLook && event.target === canvas)) return;
    pose.yaw -= event.movementX * 0.0025;
    pose.pitch = THREE.MathUtils.clamp(pose.pitch - event.movementY * 0.0025, -1.4, 1.4);
  }

  function targetAt(cursor) {
    syncCamera();
    scene.updateMatrixWorld();
    if (moon) return moon.pick(camera, cursor.x, cursor.y);
    ray.setFromCamera(cursor, camera);
    return ray.intersectObjects(targets)[0]?.object.userData.key;
  }

  function selectAt(cursor) {
    const key = targetAt(cursor);
    if (key) onSelect(key);
  }

  document.addEventListener('pointerlockchange', lockChanged);
  document.addEventListener('pointerlockerror', lockFailed);
  document.addEventListener('mousemove', lookWithMouse);
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  canvas.addEventListener('keydown', event => {
    if (event.code === 'Escape' && fallbackLook) {
      setFallbackLook(false);
      keys.clear();
      return;
    }
    if (event.code === 'Tab' && locked()) document.exitPointerLock();
    if (event.code === 'KeyE' || event.code === 'Enter') {
      event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Enter' && !locked() && !fallbackLook) captureMouse();
      else selectAt(center);
      return;
    }
    if (!movementKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  canvas.addEventListener('keyup', event => keys.delete(event.code));
  canvas.addEventListener('blur', () => {
    keys.clear();
    if (fallbackLook) setFallbackLook(false);
  });

  let drag = null;
  let dragged = false;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    canvas.focus({ preventScroll: true });
    if (locked() || fallbackLook) return;
    drag = { x: event.clientX, y: event.clientY, yaw: pose.yaw, pitch: pose.pitch };
    dragged = false;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragged = true;
    if (!dragged) return;
    pose.yaw = drag.yaw - dx * 0.005;
    pose.pitch = THREE.MathUtils.clamp(drag.pitch - dy * 0.005, -1, 1);
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointercancel', () => {
    drag = null;
    dragged = false;
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  canvas.addEventListener('click', event => {
    if (locked()) {
      selectAt(center);
      return;
    }
    if (dragged) return;
    if (!fallbackLook && event.pointerType !== 'touch') {
      captureMouse();
      return;
    }
    const rect = canvas.getBoundingClientRect();
    selectAt(new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    ));
  });

  const isBlocked = (x, z) => targets.some(({ position }) =>
    Math.abs(x - position.x) < 1.15 && Math.abs(z - position.z) < 1.1);
  const pressed = key => Number(keys.has(key));
  function syncCamera() {
    const height = moon ? moon.heightAt(pose.x, pose.z) + moon.eyeHeight : 1.55;
    camera.position.set(pose.x, height, pose.z);
    camera.rotation.set(pose.pitch, pose.yaw, 0);
    camera.updateMatrixWorld();
  }

  let previousTime = 0;
  let previousSelection;
  renderer.setAnimationLoop(time => {
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    pose.yaw += (pressed('ArrowLeft') - pressed('ArrowRight')) * dt * 1.9;
    pose.pitch = THREE.MathUtils.clamp(
      pose.pitch + (pressed('ArrowUp') - pressed('ArrowDown')) * dt * 1.4, -1.4, 1.4,
    );
    const forward = pressed('KeyW') - pressed('KeyS');
    const side = pressed('KeyD') - pressed('KeyA');
    const speed = 3.8 * dt / (Math.hypot(forward, side) || 1);
    const dx = (side * Math.cos(pose.yaw) - forward * Math.sin(pose.yaw)) * speed;
    const dz = (-side * Math.sin(pose.yaw) - forward * Math.cos(pose.yaw)) * speed;
    if (moon && (dx || dz)) {
      const steps = Math.ceil(Math.hypot(dx, dz) / 0.15);
      for (let step = 0; step < steps; step++) {
        const next = moon.resolveMove(pose.x, pose.z, pose.x + dx / steps, pose.z + dz / steps);
        pose.x = next.x;
        pose.z = next.z;
      }
    } else if (!moon) {
      const x = THREE.MathUtils.clamp(pose.x + dx, -7.6, 7.6);
      const z = THREE.MathUtils.clamp(pose.z + dz, -4.6, 4.6);
      if (!isBlocked(x, pose.z)) pose.x = x;
      if (!isBlocked(pose.x, z)) pose.z = z;
    }
    syncCamera();
    if (moon) {
      moon.update(dt, camera);
      const selection = [...selected].join(',');
      if (selection !== previousSelection) {
        moon.setSelected([...selected]);
        previousSelection = selection;
      }
    }
    for (const target of targets) {
      if (target.userData.isRoof) {
        target.material.color.setHex(selected.has(target.userData.key) ? 0x44ddac : 0x4a6388);
      }
    }
    renderer.render(scene, camera);
  });
  const resize = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    if (moon) camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(1 / camera.aspect)), 65, 80);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resize.observe(container);
  return () => {
    document.removeEventListener('pointerlockchange', lockChanged);
    document.removeEventListener('pointerlockerror', lockFailed);
    document.removeEventListener('mousemove', lookWithMouse);
    if (locked()) document.exitPointerLock();
    resize.disconnect();
    renderer.setAnimationLoop(null);
    if (moon) moon.dispose();
    else scene.traverse(object => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
