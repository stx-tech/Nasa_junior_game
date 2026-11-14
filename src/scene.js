// Shared 3D stage. Public entry point (same signature as the team prototype):
//   mountScene(container, mission, shift, selected, onSelect, pose)
// The stage is kept on the container and reused between calls, so clicking a
// module or running a shift never rebuilds the map or reloads assets.
// `pose` ({x, z, yaw, pitch}) is mutated in place so position and view survive
// re-renders and shift changes.

import * as THREE from 'three';
import { createMoonEnvironment } from './scenes/moon/index.js';
import { createPlaceholderEnvironment } from './scenes/placeholder.js';

const ENVIRONMENTS = {
  moon: () => createMoonEnvironment(),
  placeholder: (mission) => createPlaceholderEnvironment(mission),
};

const WALK_SPEED = 3.2; // m/s
const RUN_SPEED = 5.0;
const LOOK_KEYS_SPEED = 1.6; // rad/s
const DRAG_SENS = 0.0042;

function createStage(container, mission, pose) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  renderer.setPixelRatio(pixelRatio);
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', '3D view of the base. Use W A S D to walk, arrow keys or drag to look, click a module to select it.');
  canvas.className = 'scene-canvas';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.05, 2000);
  camera.rotation.order = 'YXZ';

  const envFactory = ENVIRONMENTS[mission.environment] || ENVIRONMENTS.placeholder;
  const env = envFactory(mission);
  scene.background = env.background;
  scene.add(env.root);
  if (env.sky) scene.add(env.sky.group);

  if (pose.x === undefined) Object.assign(pose, env.spawn);
  let eyeY = env.heightAt(pose.x, pose.z) + env.eyeHeight;

  const keys = new Set();
  let onSelect = () => {};
  let selected = [];
  let hoveredKey = null;

  const onKeyDown = (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      keys.add(k);
      if (k.startsWith('arrow') && document.activeElement === canvas) e.preventDefault();
    }
  };
  const onKeyUp = (e) => keys.delete(e.key.toLowerCase());
  const onBlur = () => keys.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // Drag to look; a click without drag selects a module.
  let drag = null;
  const ndcOf = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
  };
  const onPointerDown = (e) => {
    drag = { x: e.clientX, y: e.clientY, moved: 0, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
    canvas.focus({ preventScroll: true });
  };
  const onPointerMove = (e) => {
    if (drag && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX; drag.y = e.clientY;
      pose.yaw -= dx * DRAG_SENS;
      pose.pitch = THREE.MathUtils.clamp(pose.pitch - dy * DRAG_SENS, -1.2, 1.2);
    } else if (env.pick) {
      const [nx, ny] = ndcOf(e);
      hoveredKey = env.pick(camera, nx, ny);
      canvas.style.cursor = hoveredKey ? 'pointer' : 'grab';
      env.setHovered?.(hoveredKey);
    }
  };
  const onPointerUp = (e) => {
    if (!drag) return;
    if (drag.moved < 6 && env.pick) {
      const [nx, ny] = ndcOf(e);
      const key = env.pick(camera, nx, ny);
      if (key) onSelect(key);
    }
    drag = null;
  };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', () => { drag = null; });

  const resize = () => {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 450;
    renderer.setSize(w, h, false);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    camera.aspect = w / h;
    // Keep at least ~90 deg horizontal view on narrow screens (vertical FOV 65..80).
    const vNeeded = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(45)) / camera.aspect));
    camera.fov = THREE.MathUtils.clamp(vNeeded, 65, 80);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  // Adaptive resolution: drop pixel ratio if the frame rate stays low.
  let slowTime = 0;
  let last = performance.now();
  let raf = 0;
  let disposed = false;
  const forward = new THREE.Vector3();

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.25);
    last = now;
    if (dt > 1 / 40) slowTime += dt; else slowTime = Math.max(0, slowTime - dt);
    if (slowTime > 2 && pixelRatio > 1) { pixelRatio = 1; renderer.setPixelRatio(1); resize(); slowTime = 0; }

    // Look with arrow keys
    if (keys.has('arrowleft')) pose.yaw += LOOK_KEYS_SPEED * dt;
    if (keys.has('arrowright')) pose.yaw -= LOOK_KEYS_SPEED * dt;
    if (keys.has('arrowup')) pose.pitch = Math.min(1.2, pose.pitch + LOOK_KEYS_SPEED * 0.7 * dt);
    if (keys.has('arrowdown')) pose.pitch = Math.max(-1.2, pose.pitch - LOOK_KEYS_SPEED * 0.7 * dt);

    // Walk on the ground plane relative to yaw
    let mx = 0, mz = 0;
    if (keys.has('w')) mz -= 1;
    if (keys.has('s')) mz += 1;
    if (keys.has('a')) mx -= 1;
    if (keys.has('d')) mx += 1;
    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const speed = keys.has('shift') ? RUN_SPEED : WALK_SPEED;
      const sin = Math.sin(pose.yaw), cos = Math.cos(pose.yaw);
      const wx = (mx * cos + mz * sin) / len * speed * dt;
      const wz = (-mx * sin + mz * cos) / len * speed * dt;
      // Sub-steps of <= 0.15 m so a slow frame never skips through a collider.
      const steps = Math.max(1, Math.ceil(Math.hypot(wx, wz) / 0.15));
      for (let i = 0; i < steps; i++) {
        const p = env.resolveMove(pose.x, pose.z, pose.x + wx / steps, pose.z + wz / steps);
        pose.x = p.x; pose.z = p.z;
      }
    }
    const targetY = env.heightAt(pose.x, pose.z) + env.eyeHeight;
    eyeY += (targetY - eyeY) * Math.min(1, dt * 12);
    camera.position.set(pose.x, eyeY, pose.z);
    camera.rotation.set(pose.pitch, pose.yaw, 0);
    camera.getWorldDirection(forward);

    env.update(dt, camera);
    renderer.render(scene, camera);
  }
  frame();

  return {
    missionId: mission.id,
    env,
    camera,
    renderer,
    canvas,
    update({ shift, selected: sel, onSelect: cb, pose: newPose, solarOutput }) {
      if (newPose && newPose !== pose) Object.assign(pose, newPose);
      onSelect = cb || onSelect;
      selected = sel || [];
      env.setShift(shift, { solarOutput });
      env.setSelected(selected);
    },
    renderOnce() { env.update(0, camera); renderer.render(scene, camera); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      scene.remove(env.root);
      if (env.sky) scene.remove(env.sky.group);
      env.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}

export function mountScene(container, mission, shift, selected, onSelect, pose) {
  let stage = container.__stage;
  if (!stage || stage.missionId !== mission.id) {
    stage?.dispose();
    for (const k of Object.keys(pose)) delete pose[k]; // new mission -> new spawn
    stage = createStage(container, mission, pose);
    container.__stage = stage;
  }
  stage.update({ shift, selected, onSelect, pose, solarOutput: mission.generation?.[shift] });
  return stage;
}

export function unmountScene(container) {
  container.__stage?.dispose();
  container.__stage = null;
}
