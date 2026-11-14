// First-person "in hands" layer: tablet + gloves rendered on top of the world
// with their own camera (so they never clip into walls and ignore world pitch).
//
//   const vm = createViewModel();
//   vm.resize(width, height);            // CSS px of the 3D view
//   vm.open() / vm.close() / vm.toggle();
//   each frame: vm.update(dt); renderer.clearDepth(); renderer.render(vm.scene, vm.camera);
//   vm.screenRect()  -> { left, top, width, height } CSS px of the screen (valid when state === 'up')
//   vm.on('opened' | 'closed' | 'state', cb)
//
// States: 'down' -> 'raising' -> 'up' -> 'lowering' -> 'down'. A toggle in the
// middle of a move reverses from the current position, so fast repeated presses
// always end in the last requested state.
import * as THREE from 'three';
import { createTabletModel } from './tablet.js';
import { createArms } from './arms.js';

const FOV = 50;
const RAISE_MS = 300;
const RAISE_MS_REDUCED = 110;

// One symmetric curve for both directions: reversing mid-move never jumps.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createViewModel({ reducedMotion } = {}) {
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reduced = reducedMotion ?? !!motionQuery?.matches;
  const onMotion = (e) => { reduced = reducedMotion ?? e.matches; };
  motionQuery?.addEventListener?.('change', onMotion);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.01, 5);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3530, 1.4));
  const key = new THREE.DirectionalLight(0xfff3dc, 2.2);
  key.position.set(-0.6, 1.0, 0.8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc4ff, 0.6);
  rim.position.set(0.8, 0.3, -0.5);
  scene.add(rim);

  const tablet = createTabletModel();
  const arms = createArms(tablet);
  scene.add(tablet.tabletRoot, arms.group);
  tablet.tabletRoot.visible = false;
  arms.group.visible = false;

  let width = 1, height = 1;
  let distance = 0.45; // camera -> tablet when up (set in resize)
  let visH = 1, visW = 1; // visible size (m) at that distance
  let progress = 0; // 0 = down, 1 = up
  let target = 0;
  let state = 'down';
  const listeners = { opened: new Set(), closed: new Set(), state: new Set() };
  const emit = (name, arg) => listeners[name].forEach((cb) => cb(arg));
  const elbowL = new THREE.Vector3();
  const elbowR = new THREE.Vector3();

  function layout() {
    camera.aspect = width / height;
    // Portrait tablet in narrow views so the screen stays readable.
    tablet.setOrientation(camera.aspect < 0.95 ? 'portrait' : 'landscape');
    const { width: tw, height: th } = tablet.size;
    const perM = 2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)); // visible height per metre of distance
    // Landscape: device ~80% of the view so both gloves stay visible.
    // Portrait (narrow windows): device fills ~96% of the width so the screen stays readable.
    const portrait = tablet.orientation === 'portrait';
    const fillW = portrait ? 0.96 : 0.8, fillH = portrait ? 0.84 : 0.8;
    distance = Math.max(th / (fillH * perM), tw / (fillW * perM * camera.aspect));
    visH = perM * distance;
    visW = visH * camera.aspect;
    camera.updateProjectionMatrix();
  }

  function applyPose() {
    const t = ease(progress);
    const { height: th } = tablet.size;
    const downY = -(visH / 2 + th * 0.75);
    const yUp = -visH * 0.03;
    const root = tablet.tabletRoot;
    root.position.set(0, downY + (yUp - downY) * t, -distance);
    root.rotation.x = reduced ? 0 : -0.75 * (1 - t);
    root.rotation.z = reduced ? 0 : 0.05 * (1 - t);
    const visible = progress > 0.001;
    root.visible = visible;
    arms.group.visible = visible;
    if (visible) {
      // Elbows sit just outside the bottom corners, a bit nearer than the tablet.
      const ez = -distance * 0.72;
      const hw = (visW / 2) * 0.72 / 1, hh = (visH / 2) * 0.72;
      elbowL.set(-hw * 1.05, -hh * 1.25 + root.position.y * 0.25, ez);
      elbowR.set(hw * 1.05, -hh * 1.25 + root.position.y * 0.25, ez);
      arms.update(elbowL, elbowR);
    }
  }

  function setState(next) {
    if (next === state) return;
    state = next;
    emit('state', state);
    if (state === 'up') emit('opened');
    if (state === 'down') emit('closed');
  }

  function open() {
    if (target === 1) return;
    target = 1;
    setState(progress >= 1 ? 'up' : 'raising');
  }
  function close() {
    if (target === 0) return;
    target = 0;
    setState(progress <= 0 ? 'down' : 'lowering');
  }
  function toggle() { if (target === 1) close(); else open(); }

  function update(dt) {
    const dur = (reduced ? RAISE_MS_REDUCED : RAISE_MS) / 1000;
    if (progress !== target) {
      const step = dt / dur;
      progress = target > progress ? Math.min(1, progress + step) : Math.max(0, progress - step);
      if (progress === target) setState(target === 1 ? 'up' : 'down');
    }
    applyPose();
  }

  const corner = new THREE.Vector3();
  function screenRect() {
    tablet.tabletRoot.updateMatrixWorld(true);
    const { width: sw, height: sh } = tablet.screenAnchor.userData.size;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // screenAnchor is inside `device`, which may be rotated; use the unrotated screen size there.
    const portrait = tablet.orientation === 'portrait';
    const lw = portrait ? sh : sw, lh = portrait ? sw : sh;
    for (const [x, y] of [[-lw / 2, -lh / 2], [lw / 2, -lh / 2], [lw / 2, lh / 2], [-lw / 2, lh / 2]]) {
      corner.set(x, y, 0);
      tablet.screenAnchor.localToWorld(corner);
      corner.project(camera);
      const px = (corner.x + 1) / 2 * width;
      const py = (1 - corner.y) / 2 * height;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }

  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    layout();
    applyPose();
  }

  function on(name, cb) { listeners[name].add(cb); return () => listeners[name].delete(cb); }

  function dispose() {
    motionQuery?.removeEventListener?.('change', onMotion);
    arms.dispose();
    tablet.dispose();
  }

  resize(width, height);
  return {
    scene, camera, tablet, arms,
    open, close, toggle, update, resize, screenRect, on, dispose,
    get state() { return state; },
    get isOpen() { return target === 1; },
    get progress() { return progress; },
    get reducedMotion() { return reduced; },
    // Test/debug helper: jump to a state without animation.
    snap(open) { target = open ? 1 : 0; progress = target; setState(open ? 'up' : 'down'); applyPose(); },
  };
}
