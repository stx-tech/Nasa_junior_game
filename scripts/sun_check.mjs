// Ray test: is each panel centre lit by the Sun in each shift? Uses the real height field.
import { createTerrainField, ridgeHeight } from '../src/scenes/moon/terrain.js';
import { SOLAR_ARRAY as A, SUN_BY_SHIFT, MODULES, MOON_SEED, bearingToDir } from '../src/scenes/moon/layout.js';
const f = createTerrainField(MOON_SEED);
const lab = MODULES.lab;
function blockedByLab(x, y, z) {
  return Math.abs(x - lab.x) < lab.width / 2 && Math.abs(z - lab.z) < lab.depth / 2 && y < lab.legHeight + lab.height + 1.8;
}
SUN_BY_SHIFT.forEach((s, i) => {
  const d = bearingToDir(s.bearing, s.elevation);
  let lit = 0, total = 0;
  for (let r = 0; r < A.rows; r++) for (let p = 0; p < A.perRow; p++) for (const [ox, oy] of [[-0.9, -0.6], [0.9, -0.6], [0, 0], [-0.9, 0.6], [0.9, 0.6]]) {
    const x0 = A.x + (p - (A.perRow - 1) / 2) * A.panelSpacing + ox;
    const z0 = A.z + (r - (A.rows - 1) / 2) * A.rowSpacing;
    const y0 = f.heightAt(x0, z0) + A.mastH + oy;
    let ok = true;
    for (let t = 0.5; t < 150; t += 0.25) {
      const x = x0 + d[0] * t, y = y0 + d[1] * t, z = z0 + d[2] * t;
      if (f.heightAt(x, z) > y || blockedByLab(x, y, z)) { ok = false; break; }
    }
    total++; if (ok) lit++;
  }
  console.log(`shift ${i + 1} sun ${s.bearing}°/${s.elevation}°: ${lit}/${total} panel points lit`);
});
