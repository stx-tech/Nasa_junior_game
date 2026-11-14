// Vertical body for the long Moon jump. Pure logic (no Three.js), fixed 120 Hz
// sub-steps so the arc is the same at 30, 60 or 144 fps.
//
//   const body = createJumpBody({ height: 1.05, airtime: 1.5 });
//   body.snapTo(groundY)                 // standing on the ground
//   body.tryJump()                       // true if it started a jump (only when grounded)
//   body.step(dt, groundAt)              // groundAt() -> terrain height under the player NOW
//   body.feetY, body.grounded, body.vy, body.landedThisStep
//
// Game tuning (not physics): height and airtime are chosen to feel like low gravity.
// On flat ground airtime ≈ 2·v0/g; on slopes it is shorter (uphill) or longer (downhill).
const STEP = 1 / 120;

export function jumpParams({ height, airtime }) {
  const v0 = (4 * height) / airtime; // initial vertical speed (m/s)
  const gravity = (8 * height) / (airtime * airtime); // m/s²
  return { v0, gravity };
}

export function createJumpBody({ height = 1.05, airtime = 1.5 } = {}) {
  const { v0, gravity } = jumpParams({ height, airtime });
  let feetY = 0;
  let vy = 0;
  let grounded = true;
  let acc = 0;
  let landedThisStep = false;

  return {
    v0, gravity,
    get feetY() { return feetY; },
    get vy() { return vy; },
    get grounded() { return grounded; },
    get landedThisStep() { return landedThisStep; },
    snapTo(y) { feetY = y; vy = 0; grounded = true; acc = 0; },
    tryJump() {
      if (!grounded) return false;
      grounded = false;
      vy = v0;
      acc = 0;
      return true;
    },
    step(dt, groundAt) {
      landedThisStep = false;
      if (grounded) { feetY = groundAt(); return; }
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        vy -= gravity * STEP;
        feetY += vy * STEP;
        const ground = groundAt();
        if (feetY < ground && vy > 0) feetY = ground; // rising along an uphill slope: never under the surface
        if (feetY <= ground && vy <= 0) {
          feetY = ground;
          vy = 0;
          grounded = true;
          landedThisStep = true;
          acc = 0;
          break;
        }
      }
    },
  };
}
