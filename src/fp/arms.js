// Spacesuit gloves + forearms that hold the tablet by its edges.
// Gloves are children of gripLeft/gripRight (they move with the tablet);
// forearms are rebuilt each frame between a fixed off-screen elbow and the glove cuff.
// Grip-local frame: +x outward from the tablet edge, +y up, +z toward the viewer.
import * as THREE from 'three';

const suit = () => new THREE.MeshStandardMaterial({ color: 0xe9e7e2, roughness: 0.92, metalness: 0 });

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  return m;
}

function createGlove(mats) {
  const g = new THREE.Group();
  g.name = 'glove';
  // Palm/back of hand wraps the outer edge of the tablet.
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.094, 0.062), mats.glove);
  palm.position.set(0.02, 0, -0.002);
  g.add(palm);
  const knuckle = capsule(0.017, 0.07, mats.glove);
  knuckle.position.set(0.03, 0, -0.004);
  g.add(knuckle);
  // Four fingers curl behind the device (z < 0) — mostly hidden, visible at the edge.
  for (let i = 0; i < 4; i++) {
    const f = capsule(0.0085, 0.036, mats.glove);
    f.rotation.z = Math.PI / 2;
    f.position.set(-0.01, 0.032 - i * 0.021, -0.026);
    g.add(f);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), mats.pad);
    pad.scale.set(1.1, 0.9, 0.7);
    pad.position.set(-0.03, 0.032 - i * 0.021, -0.022);
    g.add(pad);
  }
  // Thumb rests on the side bezel in front (z > 0), never over the screen.
  const thumb = capsule(0.0105, 0.03, mats.glove);
  thumb.rotation.z = Math.PI / 2 + 0.25;
  thumb.position.set(0.004, -0.008, 0.026);
  g.add(thumb);
  const thumbPad = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), mats.pad);
  thumbPad.scale.set(1.0, 0.75, 0.4);
  thumbPad.position.set(-0.011, -0.003, 0.031);
  g.add(thumbPad);
  // Dark grip patch on the palm side + knuckle segments.
  const patch = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.04), mats.pad);
  patch.position.set(0.038, 0, 0.0);
  g.add(patch);
  // Wrist cuff: segmented ring with an orange band.
  // The wrist bends down and out, so the forearm comes up from below like a real hold.
  const wristDir = new THREE.Vector3(0.55, -0.83, -0.08).normalize();
  const heel = capsule(0.022, 0.03, mats.glove); // heel of the hand under the palm
  heel.position.set(0.03, -0.045, -0.006);
  heel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wristDir);
  g.add(heel);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.045, 18), mats.cuff);
  cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wristDir);
  cuff.position.set(0.045, -0.07, -0.008);
  g.add(cuff);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.0055, 6, 20), mats.orange);
  band.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wristDir);
  band.position.set(0.053, -0.082, -0.009);
  g.add(band);
  const wrist = new THREE.Object3D();
  wrist.name = 'wrist';
  wrist.position.set(0.062, -0.095, -0.01);
  g.add(wrist);
  return { group: g, wrist };
}

function createForearm(mats) {
  const g = new THREE.Group();
  // Unit-length segments along +y, scaled per frame.
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.058, 1, 16, 1, true), mats.suit);
  sleeve.position.y = 0.5;
  g.add(sleeve);
  const rings = [];
  for (const t of [0.12, 0.42, 0.72]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 20), mats.joint);
    r.rotation.x = Math.PI / 2;
    r.userData.t = t;
    g.add(r);
    rings.push(r);
  }
  return { group: g, sleeve, rings };
}

export function createArms(tablet) {
  const mats = {
    suit: suit(),
    glove: new THREE.MeshStandardMaterial({ color: 0xdcd9d2, roughness: 0.95 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.9 }),
    joint: new THREE.MeshStandardMaterial({ color: 0xbfc3c9, roughness: 0.8 }),
    cuff: new THREE.MeshStandardMaterial({ color: 0xc9ccd1, roughness: 0.7, metalness: 0.2 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xe9832b, roughness: 0.6 }),
  };
  mats.suit.side = THREE.DoubleSide;
  const group = new THREE.Group();
  group.name = 'astronautArms';

  const left = createGlove(mats);
  const right = createGlove(mats);
  tablet.gripLeft.add(left.group);
  tablet.gripRight.add(right.group);
  const armL = createForearm(mats);
  const armR = createForearm(mats);
  group.add(armL.group, armR.group);

  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();

  function place(arm, wristObj, elbow) {
    wristObj.getWorldPosition(a);
    b.copy(elbow);
    dir.subVectors(b, a);
    const len = dir.length();
    dir.normalize();
    arm.group.position.copy(a);
    arm.group.quaternion.setFromUnitVectors(up, dir);
    arm.sleeve.scale.set(1, len, 1);
    arm.sleeve.position.y = len / 2;
    for (const r of arm.rings) {
      const rad = 0.046 + (0.058 - 0.046) * r.userData.t + 0.003;
      r.scale.set(rad, rad, rad);
      r.position.y = len * r.userData.t;
    }
  }

  // elbowLeft/elbowRight are in the parent (viewmodel) space, off-screen bottom corners.
  function update(elbowLeft, elbowRight) {
    tablet.tabletRoot.updateMatrixWorld(true);
    place(armL, left.wrist, elbowLeft);
    place(armR, right.wrist, elbowRight);
  }

  function dispose() {
    for (const root of [group, left.group, right.group]) root.traverse((o) => o.geometry?.dispose());
    Object.values(mats).forEach((m) => m.dispose());
  }

  return { group, update, dispose };
}
