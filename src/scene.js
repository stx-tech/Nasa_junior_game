import * as THREE from 'three';
import { createMoonEnvironment } from './scenes/moon/index.js';
import { createMarsEnvironment } from './scenes/mars/index.js';
import { createViewModel } from './fp/viewmodel.js';
import { createJumpBody } from './fp/jump.js';

const appearance = {
  mars: [0x3b2427, 0xa45a40],
  earth: [0x173043, 0x536d47],
};

const CLICK_SLOP = 6; // CSS px: below = click (select), above = drag (look)
const DRAG_LOOK = 0.005; // rad per CSS px
const WALK_SPEED = 3.8; // m/s (unchanged)
// Long Moon jump — game tuning for a low-gravity feel (≈1.5 s airtime, ≈1 m apex on flat ground).
const MOON_JUMP = { height: 1.05, airtime: 1.5, takeoffBoost: 1.15, airSpeed: 1.2, airControl: 5, airDrag: 0.6 };

// Mounts the 3D view once per mission and returns a controller.
// The view is NOT rebuilt on clicks or shifts: call setShift() instead.
//
//   const view = mountScene(container, mission, shift, selected, onSelect, pose, { onFrame });
//   view.setShift(n)          // lighting / solar state for shift n
//   view.setInputEnabled(b)   // walking, looking and clicking (off while the tablet is up)
//   view.viewmodel            // tablet + gloves layer (see src/fp/viewmodel.js)
//   view.focus()              // give keyboard focus back to the scene
//   view.stop()               // dispose everything
export function mountScene(container, mission, shift, selected, onSelect, pose, { onFrame, t } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    container.textContent = t ? t('scene.unavailable') : 'The 3D view is unavailable. Use the Mission Tablet to plan each shift.';
    return { stop() {}, setShift() {}, setInputEnabled() {}, setTexts() {}, focus() {}, viewmodel: null, canvas: null };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.autoClear = false;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'First-person base. W A S D to move, hold the left mouse button and drag to look, arrow keys to look, E to select the module in the centre, T for the tablet.');
  container.append(renderer.domElement);
  const reticle = document.createElement('span');
  reticle.className = 'reticle';
  reticle.setAttribute('aria-hidden', 'true');
  container.append(reticle);

  const scene = new THREE.Scene();
  // Detailed first-person maps (Moon, Mars); Earth still uses the simple placeholder.
  const env = mission.id === 'moon' ? createMoonEnvironment() : mission.id === 'mars' ? createMarsEnvironment() : null;
  const jumpCfg = env?.jump ?? MOON_JUMP;
  const camera = new THREE.PerspectiveCamera(65, 1, 0.06, env ? 2000 : 80);
  camera.rotation.order = 'YXZ';
  const viewmodel = createViewModel();
  let placeholder = null;
  if (env) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    scene.background = env.background;
    scene.fog = env.fog ?? null;
    scene.add(env.root, env.sky.group);
    if (pose.x === undefined) Object.assign(pose, env.spawn);
  } else {
    placeholder = addPlaceholder();
    if (pose.x === undefined) Object.assign(pose, { x: 0, z: 4.3, yaw: 0, pitch: -0.14 });
  }
  const targets = placeholder ? placeholder.targets : [];
  const body = env ? createJumpBody(jumpCfg) : null;
  body?.snapTo(env.heightAt(pose.x, pose.z));
  const hv = { x: 0, z: 0 }; // horizontal velocity (m/s), kept through the air
  let jumpRequested = false;
  let spaceHeld = false;
  let landingDip = 0;
  let simTime = 0;

  function setShift(n) {
    if (env) env.setShift(n, { solarOutput: mission.generation[n], radiation: n === mission.shelterShift });
    else placeholder.setShift(n);
  }
  setShift(shift);

  function addPlaceholder() {
    const [sky, ground] = appearance[mission.id];
    scene.background = new THREE.Color(sky);
    scene.add(new THREE.HemisphereLight(0xdce8ff, ground, 2));
    const sun = new THREE.DirectionalLight(0xffe6bd, 1);
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
    let panel = null;
    if (mission.id !== 'earth') {
      panel = box([4.5, 0.13, 1.3], [0, 0.65, -2.2], 0x43649f);
      panel.rotation.x = 0.22;
    }
    return {
      targets: hitTargets,
      setShift(n) {
        sun.intensity = 1 + (mission.generation[n] ?? 0) / 6;
        panel?.material.color.setHex(mission.generation[n] ? 0x43649f : 0x283044);
      },
    };
  }

  const ray = new THREE.Raycaster();
  const center = new THREE.Vector2();
  const canvas = renderer.domElement;
  const keys = new Set();
  let inputEnabled = true;

  function targetAt(cursor) {
    syncCamera();
    scene.updateMatrixWorld();
    if (env) return env.pick(camera, cursor.x, cursor.y);
    ray.setFromCamera(cursor, camera);
    return ray.intersectObjects(targets)[0]?.object.userData.key;
  }

  function selectAt(cursor) {
    if (!inputEnabled) return;
    const key = targetAt(cursor);
    if (key) onSelect(key);
  }

  function cursorOf(event) {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      1 - ((event.clientY - rect.top) / rect.height) * 2,
    );
  }

  // ---- Look only while the left button is held ----
  let drag = null; // { id, x, y, lastX, lastY, moved }
  let hoverCursor = null; // resolved once per frame (raycast is not free)
  function endDrag() {
    if (drag && canvas.hasPointerCapture?.(drag.id)) canvas.releasePointerCapture(drag.id);
    drag = null;
    container.classList.remove('looking');
  }
  function resetInput() {
    keys.clear();
    endDrag();
    spaceHeld = false;
    jumpRequested = false;
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !inputEnabled) return;
    canvas.focus({ preventScroll: true });
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.id) {
      if (inputEnabled && event.pointerType === 'mouse' && !drag) hoverCursor = cursorOf(event);
      return;
    }
    if ((event.buttons & 1) === 0) { endDrag(); return; } // button released outside the window
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= CLICK_SLOP) {
      drag.moved = true;
      container.classList.add('looking');
      drag.lastX = event.clientX; // no jump: start rotating from the threshold point
      drag.lastY = event.clientY;
    }
    if (!drag.moved) return;
    pose.yaw -= (event.clientX - drag.lastX) * DRAG_LOOK;
    pose.pitch = THREE.MathUtils.clamp(pose.pitch - (event.clientY - drag.lastY) * DRAG_LOOK, -1.2, 1.2);
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const wasClick = !drag.moved;
    endDrag();
    if (wasClick) selectAt(cursorOf(event));
  });
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', () => { if (drag) endDrag(); });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  canvas.addEventListener('keydown', (event) => {
    if (!inputEnabled) return;
    if (event.code === 'Space' && body) {
      event.preventDefault(); // no page scroll; buttons elsewhere keep their own Space behaviour
      if (!event.repeat && !spaceHeld) jumpRequested = true; // holding Space gives one jump
      spaceHeld = true;
      return;
    }
    if (event.code === 'KeyE' || event.code === 'Enter') {
      event.preventDefault();
      if (!event.repeat) selectAt(center);
      return;
    }
    if (!movementKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  canvas.addEventListener('keyup', (event) => {
    keys.delete(event.code);
    if (event.code === 'Space') spaceHeld = false;
  });
  canvas.addEventListener('blur', resetInput);
  const onWindowBlur = () => resetInput();
  window.addEventListener('blur', onWindowBlur);

  function setInputEnabled(enabled) {
    if (inputEnabled === enabled) return;
    inputEnabled = enabled;
    resetInput();
    container.classList.toggle('input-paused', !enabled);
    if (!enabled) canvas.style.cursor = '';
  }

  const isBlocked = (x, z) => targets.some(({ position }) =>
    Math.abs(x - position.x) < 1.15 && Math.abs(z - position.z) < 1.1);
  const pressed = (key) => Number(keys.has(key));
  function syncCamera() {
    const height = env ? body.feetY + env.eyeHeight - landingDip : 1.55;
    camera.position.set(pose.x, height, pose.z);
    camera.rotation.set(pose.pitch, pose.yaw, 0);
    camera.updateMatrixWorld();
  }

  let previousTime = 0;
  let previousSelection;
  renderer.setAnimationLoop((time) => {
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0;
    previousTime = time;
    if (inputEnabled) {
      pose.yaw += (pressed('ArrowLeft') - pressed('ArrowRight')) * dt * 1.9;
      pose.pitch = THREE.MathUtils.clamp(
        pose.pitch + (pressed('ArrowUp') - pressed('ArrowDown')) * dt * 1.4, -1.2, 1.2,
      );
      simTime += dt;
      const forward = pressed('KeyW') - pressed('KeyS');
      const side = pressed('KeyD') - pressed('KeyA');
      const speed = WALK_SPEED * dt / (Math.hypot(forward, side) || 1);
      const dx = (side * Math.cos(pose.yaw) - forward * Math.sin(pose.yaw)) * speed;
      const dz = (-side * Math.sin(pose.yaw) - forward * Math.cos(pose.yaw)) * speed;
      if (env) {
        // Desired ground velocity from WASD (m/s).
        const wantX = dt ? dx / dt : 0, wantZ = dt ? dz / dt : 0;
        const moving = wantX !== 0 || wantZ !== 0;
        if (jumpRequested) {
          jumpRequested = false;
          if (body.tryJump()) {
            hv.x = wantX * jumpCfg.takeoffBoost;
            hv.z = wantZ * jumpCfg.takeoffBoost;
          }
        }
        if (body.grounded) {
          hv.x = wantX; hv.z = wantZ;
        } else {
          // In the air: keep momentum, steer gently with WASD.
          const tx = moving ? wantX * jumpCfg.airSpeed : hv.x;
          const tz = moving ? wantZ * jumpCfg.airSpeed : hv.z;
          const rate = (moving ? jumpCfg.airControl : jumpCfg.airDrag) * dt;
          const ax = (moving ? tx : 0) - hv.x, az = (moving ? tz : 0) - hv.z;
          const len = Math.hypot(ax, az);
          if (len > 0) { const k = Math.min(1, rate / len); hv.x += ax * k; hv.z += az * k; }
        }
        const mx = hv.x * dt, mz = hv.z * dt;
        if (mx || mz) {
          const x0 = pose.x, z0 = pose.z;
          const steps = Math.ceil(Math.hypot(mx, mz) / 0.15);
          for (let step = 0; step < steps; step++) {
            const next = env.resolveMove(pose.x, pose.z, pose.x + mx / steps, pose.z + mz / steps);
            pose.x = next.x;
            pose.z = next.z;
          }
          // Blocked by a wall or the map edge: lose that part of the momentum.
          if (dt && !body.grounded) {
            if (Math.abs(pose.x - x0) < Math.abs(mx) * 0.5) hv.x = (pose.x - x0) / dt;
            if (Math.abs(pose.z - z0) < Math.abs(mz) * 0.5) hv.z = (pose.z - z0) / dt;
          }
        }
        body.step(dt, () => env.heightAt(pose.x, pose.z));
        if (body.landedThisStep) landingDip = 0.12;
      } else if (!env) {
        const x = THREE.MathUtils.clamp(pose.x + dx, -7.6, 7.6);
        const z = THREE.MathUtils.clamp(pose.z + dz, -4.6, 4.6);
        if (!isBlocked(x, pose.z)) pose.x = x;
        if (!isBlocked(pose.x, z)) pose.z = z;
      }
    }
    landingDip *= Math.exp(-10 * dt);
    syncCamera();
    if (env) {
      env.update(dt, camera);
      const selection = [...selected].join(',');
      if (selection !== previousSelection) {
        env.setSelected([...selected]);
        previousSelection = selection;
      }
    }
    for (const target of targets) {
      if (target.userData.isRoof) {
        target.material.color.setHex(selected.has(target.userData.key) ? 0x44ddac : 0x4a6388);
      }
    }
    if (hoverCursor && inputEnabled && !drag) {
      canvas.style.cursor = targetAt(hoverCursor) ? 'pointer' : '';
      hoverCursor = null;
    }
    viewmodel.update(dt);
    renderer.clear();
    renderer.render(scene, camera);
    if (viewmodel.progress > 0) {
      renderer.clearDepth();
      renderer.render(viewmodel.scene, viewmodel.camera);
    }
    onFrame?.(dt);
  });
  const resize = new ResizeObserver(() => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    if (env) camera.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(1 / camera.aspect)), 65, 80);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    viewmodel.resize(width, height);
  });
  resize.observe(container);

  return {
    canvas,
    camera,
    viewmodel,
    setShift,
    setInputEnabled,
    get inputEnabled() { return inputEnabled; },
    // Mission state in the world (Moon and Mars; the placeholder ignores it).
    setStatus(status) { env?.setStatus(status); },
    // Language switch: canvas name, Moon map signs, tablet label/idle screen.
    setTexts(tr) {
      canvas.setAttribute('aria-label', tr('scene.label'));
      env?.setTexts(tr);
      viewmodel.tablet.setTexts(tr);
    },
    // Read-only state for tests.
    debug: {
      get grounded() { return body ? body.grounded : true; },
      get feetY() { return body ? body.feetY : 0; },
      get groundY() { return env ? env.heightAt(pose.x, pose.z) : 0; },
      get envId() { return env?.id ?? 'placeholder'; },
      get fogDensity() { return scene.fog?.density ?? 0; },
      isBlocked: (x, z) => (env?.isBlocked ? env.isBlocked(x, z) : false),
      pickAt: (x, y) => (env ? env.pick(camera, x, y) : null),
      get simTime() { return simTime; },
    },
    focus() { canvas.focus({ preventScroll: true }); },
    stop() {
      window.removeEventListener('blur', onWindowBlur);
      resize.disconnect();
      renderer.setAnimationLoop(null);
      viewmodel.dispose();
      if (env) env.dispose();
      else scene.traverse((object) => {
        object.geometry?.dispose();
        object.material?.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      reticle.remove();
    },
  };
}
