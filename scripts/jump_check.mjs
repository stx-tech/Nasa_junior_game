// Frame-rate independence + slope landing for the Moon jump (node scripts/jump_check.mjs).
import { createJumpBody } from '../src/fp/jump.js';
const flat = () => 0;
function airtime(fps, ground = flat, vx = 0) {
  const b = createJumpBody({ height: 1.05, airtime: 1.5 });
  let x = 0; b.snapTo(ground(x)); b.tryJump();
  let t = 0, peak = 0; const dt = 1 / fps;
  while (!b.grounded && t < 5) { x += vx * dt; b.step(dt, () => ground(x)); t += dt; peak = Math.max(peak, b.feetY - ground(0)); }
  return { t: +t.toFixed(3), peak: +peak.toFixed(3), x: +x.toFixed(2), landedOnGround: Math.abs(b.feetY - ground(x)) < 1e-9 };
}
for (const fps of [20, 30, 60, 144]) console.log(`flat ${fps} fps`, JSON.stringify(airtime(fps)));
const slope = (x) => 0.25 * x; // 14° uphill
console.log('uphill 60 fps, moving 4.5 m/s', JSON.stringify(airtime(60, slope, 4.5)));
console.log('downhill 60 fps, moving 4.5 m/s', JSON.stringify(airtime(60, (x) => -0.25 * x, 4.5)));
