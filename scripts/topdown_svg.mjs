// Generates docs/moon-map-topdown.svg from the same layout data the game uses.
import { writeFileSync } from 'node:fs';
import {
  PLAY_AREA, BASE_PAD, SPAWN, MODULES, SOLAR_ARRAY as A, RIDGE, CRATERS, BOULDERS, ROUTES, FORK, EARTH, SUN_BY_SHIFT, bearingToDir,
} from '../src/scenes/moon/layout.js';
import { ridgeHeight } from '../src/scenes/moon/terrain.js';

const S = 22; // px per metre
const X0 = -22, X1 = 31, Z0 = -24, Z1 = 19; // world window
const W = (X1 - X0) * S, H = (Z1 - Z0) * S + 150;
const px = (x) => ((x - X0) * S).toFixed(1);
const pz = (z) => ((z - Z0) * S).toFixed(1);
const out = [];
const add = (s) => out.push(s);
const font = 'font-family="Segoe UI, Arial, sans-serif"';

add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" ${font}>`);
add(`<defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#e7d6c9"/><line x1="0" y1="0" x2="0" y2="8" stroke="#c0572f" stroke-width="2.5"/></pattern>
<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1b2a41"/></marker>
<marker id="sunarr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#d18a00"/></marker></defs>`);
add(`<rect width="${W}" height="${H}" fill="#f4f3ef"/>`);
// grid
for (let x = Math.ceil(X0); x <= X1; x++) add(`<line x1="${px(x)}" y1="0" x2="${px(x)}" y2="${pz(Z1)}" stroke="${x % 5 ? '#e4e2dc' : '#cfccc4'}" stroke-width="${x % 5 ? 0.6 : 1}"/>`);
for (let z = Math.ceil(Z0); z <= Z1; z++) add(`<line x1="0" y1="${pz(z)}" x2="${W}" y2="${pz(z)}" stroke="${z % 5 ? '#e4e2dc' : '#cfccc4'}" stroke-width="${z % 5 ? 0.6 : 1}"/>`);
for (let x = -20; x <= 30; x += 5) add(`<text x="${px(x) - 0 + 3}" y="${pz(Z1) - 4}" font-size="11" fill="#6b6b6b">x ${x}</text>`);
for (let z = -20; z <= 15; z += 5) add(`<text x="3" y="${pz(z) - 3}" font-size="11" fill="#6b6b6b">z ${z}</text>`);

// ridge no-go (sampled) + contours
const step = 0.5;
// merge each row of no-go samples into horizontal runs (few hundred rects instead of thousands)
for (let z = Z0; z < Z1; z += step) {
  let runStart = null;
  for (let x = X0; x <= X1; x += step) {
    const inside = x < X1 && ridgeHeight(x + step / 2, z + step / 2) > 0.9;
    if (inside && runStart === null) runStart = x;
    if (!inside && runStart !== null) {
      add(`<rect x="${px(runStart)}" y="${pz(z)}" width="${((x - runStart) * S).toFixed(1)}" height="${(step * S + 0.5).toFixed(1)}" fill="url(#hatch)"/>`);
      runStart = null;
    }
  }
}
// ridge crest line
const c0 = [RIDGE.x - RIDGE.dir[0] * RIDGE.halfLength, RIDGE.z - RIDGE.dir[1] * RIDGE.halfLength];
const c1 = [RIDGE.x + RIDGE.dir[0] * RIDGE.halfLength, RIDGE.z + RIDGE.dir[1] * RIDGE.halfLength];
add(`<line x1="${px(c0[0])}" y1="${pz(c0[1])}" x2="${px(c1[0])}" y2="${pz(c1[1])}" stroke="#7a3b1f" stroke-width="3" stroke-dasharray="10 5"/>`);
add(`<text x="${+px(RIDGE.x) + 18}" y="${pz(RIDGE.z) - 6}" font-size="14" font-weight="700" fill="#7a3b1f">RIDGE crest ~${RIDGE.height} m</text>`);
add(`<text x="${+px(RIDGE.x) + 18}" y="${+pz(RIDGE.z) + 12}" font-size="12" fill="#7a3b1f">steep slope = edge of walk area</text>`);

// play area
add(`<rect x="${px(PLAY_AREA.minX)}" y="${pz(PLAY_AREA.minZ)}" width="${(PLAY_AREA.maxX - PLAY_AREA.minX) * S}" height="${(PLAY_AREA.maxZ - PLAY_AREA.minZ) * S}" fill="none" stroke="#c0392b" stroke-width="2.5" stroke-dasharray="4 4"/>`);
add(`<text x="${+px(PLAY_AREA.minX) + 4}" y="${+pz(PLAY_AREA.maxZ) + 16}" font-size="12" fill="#c0392b">walk boundary x ${PLAY_AREA.minX}..${PLAY_AREA.maxX}, z ${PLAY_AREA.minZ}..${PLAY_AREA.maxZ} (red/white posts)</text>`);
// base pad
add(`<circle cx="${px(BASE_PAD.x)}" cy="${pz(BASE_PAD.z)}" r="${BASE_PAD.radius * S}" fill="#e2e6ea" stroke="#9aa4ae" stroke-dasharray="6 4"/>`);
add(`<text x="${px(BASE_PAD.x - 3)}" y="${pz(BASE_PAD.z + BASE_PAD.radius - 0.6)}" font-size="11" fill="#6b7680">flat base pad r ${BASE_PAD.radius} m</text>`);
// craters
for (const c of CRATERS) {
  add(`<circle cx="${px(c.x)}" cy="${pz(c.z)}" r="${c.r * S}" fill="#d9d6cf" stroke="#8b877d" stroke-width="2"/>`);
  add(`<circle cx="${px(c.x)}" cy="${pz(c.z)}" r="${c.r * S * 0.55}" fill="#cbc7be"/>`);
}
add(`<text x="${px(CRATERS[0].x - 3.2)}" y="${pz(CRATERS[0].z + 0.2)}" font-size="12" fill="#4d4a44">crater r 4.5, depth 1.3 (walkable)</text>`);
// routes
for (const [name, r] of Object.entries(ROUTES)) {
  add(`<polyline points="${r.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')}" fill="none" stroke="#3d5a80" stroke-width="${2.6 * S}" stroke-opacity="0.12" stroke-linecap="round" stroke-linejoin="round"/>`);
  add(`<polyline points="${r.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')}" fill="none" stroke="#3d5a80" stroke-width="2.5" stroke-dasharray="8 5" marker-end="url(#arr)"/>`);
}
// cables
const cables = [[[9.6, -7], [8.6, -6.6], [6, -6.4], [3, -6.2], [0.85, -5.6]], [[-0.05, -5.6], [-1.5, -4.8], [-2.6, -3.6]], [[0.6, -5.9], [1.6, -5.4], [2.45, -4.6]]];
for (const c of cables) add(`<polyline points="${c.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ')}" fill="none" stroke="#e9832b" stroke-width="3"/>`);
add(`<rect x="${px(0.4 - 0.45)}" y="${pz(-5.6 - 0.3)}" width="${0.9 * S}" height="${0.6 * S}" fill="#3a3f47"/>`);
add(`<text x="${px(-1.4)}" y="${pz(-6.3)}" font-size="11" fill="#3a3f47">power junction (0.4, -5.6)</text>`);
// boulders
for (const b of BOULDERS) add(`<circle cx="${px(b.x)}" cy="${pz(b.z)}" r="${b.r * S}" fill="#8a8a8c" stroke="#555" />`);
// modules
const L = MODULES.crew;
add(`<circle cx="${px(L.x)}" cy="${pz(L.z)}" r="${L.radius * S}" fill="#fff" stroke="#e9832b" stroke-width="3"/>`);
add(`<rect x="${px(L.x - 1.05)}" y="${pz(L.z + L.radius - 0.4)}" width="${2.1 * S}" height="${2.0 * S}" fill="#fff" stroke="#e9832b" stroke-width="2"/>`);
add(`<text x="${px(L.x)}" y="${pz(L.z) - 4}" text-anchor="middle" font-size="14" font-weight="700" fill="#1b2a41">LIFE SUPPORT</text>`);
add(`<text x="${px(L.x)}" y="${+pz(L.z) + 13}" text-anchor="middle" font-size="12" fill="#1b2a41">key: crew · (${L.x}, ${L.z})</text>`);
add(`<text x="${px(L.x)}" y="${+pz(L.door.z) + 18}" text-anchor="middle" font-size="11" fill="#1b2a41">airlock door ↓ (${L.door.x}, ${L.door.z})</text>`);
const B = MODULES.lab;
add(`<rect x="${px(B.x - B.width / 2)}" y="${pz(B.z - B.depth / 2)}" width="${B.width * S}" height="${B.depth * S}" fill="#fff" stroke="#c9a100" stroke-width="3"/>`);
add(`<rect x="${px(B.x + 0.55)}" y="${pz(B.z + B.depth / 2)}" width="${1.3 * S}" height="${1.3 * S}" fill="#555"/>`);
add(`<text x="${px(B.x)}" y="${pz(B.z) - 4}" text-anchor="middle" font-size="14" font-weight="700" fill="#1b2a41">SCIENCE LAB</text>`);
add(`<text x="${px(B.x)}" y="${+pz(B.z) + 13}" text-anchor="middle" font-size="12" fill="#1b2a41">key: lab · (${B.x}, ${B.z})</text>`);
add(`<text x="${px(B.x + 1.2)}" y="${+pz(B.door.z) + 16}" text-anchor="middle" font-size="11" fill="#1b2a41">steps + door ↓ (${B.door.x}, ${B.door.z})</text>`);
// solar array
for (let r = 0; r < A.rows; r++) for (let p = 0; p < A.perRow; p++) {
  const x = A.x + (p - (A.perRow - 1) / 2) * A.panelSpacing, z = A.z + (r - (A.rows - 1) / 2) * A.rowSpacing;
  add(`<rect x="${px(x - A.panelW / 2)}" y="${pz(z - 0.15)}" width="${A.panelW * S}" height="${0.3 * S}" fill="#2c4a86"/>`);
}
add(`<text x="${px(A.x - 1)}" y="${pz(A.z - A.rowSpacing - 1.0)}" text-anchor="middle" font-size="14" font-weight="700" fill="#1b2a41">SOLAR ARRAY 3×4 (${A.x}, ${A.z})</text>`);
add(`<circle cx="${px(10.2)}" cy="${pz(-3.2)}" r="5" fill="#58c27d"/><text x="${px(10.7)}" y="${pz(-1.9)}" font-size="11" fill="#1b2a41">"Solar output" readout (10.2, -3.2)</text>`);
// fork + signpost
add(`<circle cx="${px(0.45)}" cy="${pz(4.2)}" r="5" fill="#1b2a41"/><text x="${px(0.9)}" y="${pz(4.0)}" font-size="11" fill="#1b2a41">signpost (0.45, 4.2)</text>`);
// spawn
const sb = (SPAWN.bearing * Math.PI) / 180;
add(`<circle cx="${px(SPAWN.x)}" cy="${pz(SPAWN.z)}" r="9" fill="#2a9d8f" stroke="#fff" stroke-width="2"/>`);
add(`<line x1="${px(SPAWN.x)}" y1="${pz(SPAWN.z)}" x2="${px(SPAWN.x + Math.sin(sb) * 4)}" y2="${pz(SPAWN.z - Math.cos(sb) * 4)}" stroke="#2a9d8f" stroke-width="4" marker-end="url(#arr)"/>`);
// view cone (16:9, ~97 deg)
for (const d of [-48, 48]) { const a = sb + (d * Math.PI) / 180; add(`<line x1="${px(SPAWN.x)}" y1="${pz(SPAWN.z)}" x2="${px(SPAWN.x + Math.sin(a) * 12)}" y2="${pz(SPAWN.z - Math.cos(a) * 12)}" stroke="#2a9d8f" stroke-width="1.2" stroke-dasharray="3 4"/>`); }
add(`<text x="${+px(SPAWN.x) + 14}" y="${+pz(SPAWN.z) + 5}" font-size="13" font-weight="700" fill="#1f6f66">SPAWN (0, 11) facing bearing ${SPAWN.bearing}°</text>`);
// Earth sector
const eb = (EARTH.bearing * Math.PI) / 180;
add(`<line x1="${px(SPAWN.x)}" y1="${pz(SPAWN.z)}" x2="${px(SPAWN.x + Math.sin(eb) * 30)}" y2="${pz(SPAWN.z - Math.cos(eb) * 30)}" stroke="#2b6cb0" stroke-width="2" stroke-dasharray="2 5"/>`);
add(`<circle cx="${px(SPAWN.x + Math.sin(eb) * 31)}" cy="${pz(SPAWN.z - Math.cos(eb) * 31)}" r="10" fill="#4a90d9" stroke="#bfe0ff" stroke-width="3"/>`);
add(`<text x="${+px(SPAWN.x + Math.sin(eb) * 31) + 14}" y="${+pz(SPAWN.z - Math.cos(eb) * 31) + 5}" font-size="12" fill="#2b6cb0">EARTH: bearing ${EARTH.bearing}°, ${EARTH.elevation}° above horizon (sky object, no parallax)</text>`);
// Sun directions
const ctr = [3, -3];
SUN_BY_SHIFT.forEach((s, i) => {
  const d = bearingToDir(s.bearing, 0);
  const R = 17.5;
  const sx = ctr[0] + d[0] * R, sz = ctr[1] + d[2] * R;
  const ex = ctr[0] + d[0] * (R - 4.5), ez = ctr[1] + d[2] * (R - 4.5);
  add(`<line x1="${px(sx)}" y1="${pz(sz)}" x2="${px(ex)}" y2="${pz(ez)}" stroke="#d18a00" stroke-width="3.5" marker-end="url(#sunarr)"/>`);
  add(`<circle cx="${px(sx)}" cy="${pz(sz)}" r="11" fill="${i === 1 ? '#555' : '#ffd166'}" stroke="#d18a00" stroke-width="2"/>`);
  add(`<text x="${px(sx)}" y="${+pz(sz) + 4}" text-anchor="middle" font-size="11" font-weight="700" fill="${i === 1 ? '#fff' : '#5a3d00'}">S${i + 1}</text>`);
});
// north arrow + scale bar + legend
add(`<g transform="translate(${W - 70},${pz(Z0) - 0 + 40})"><line x1="0" y1="40" x2="0" y2="0" stroke="#1b2a41" stroke-width="3" marker-end="url(#arr)"/><text x="0" y="58" text-anchor="middle" font-size="14" font-weight="700">N (−z)</text></g>`);
const ly = (Z1 - Z0) * S + 20;
add(`<line x1="20" y1="${ly + 10}" x2="${20 + 5 * S}" y2="${ly + 10}" stroke="#1b2a41" stroke-width="4"/><text x="20" y="${ly + 30}" font-size="12">5 m</text>`);
add(`<text x="160" y="${ly + 14}" font-size="13" font-weight="700" fill="#1b2a41">Moon · The Long Shadow — top-down layout (1 grid square = 1 m; +x east, +z south)</text>`);
add(`<text x="160" y="${ly + 34}" font-size="12" fill="#333">S1–S4: Sun direction per shift (bearing ${SUN_BY_SHIFT.map((s) => s.bearing + '°').join(' / ')}). S2 is behind the ridge → panels in shadow, Solar output 0.</text>`);
add(`<text x="160" y="${ly + 52}" font-size="12" fill="#333">Blue dashed = rover-track routes with guide posts · orange = power cables · grey = boulders (colliders) · hatched = ridge slope (no-go).</text>`);
add(`<text x="160" y="${ly + 70}" font-size="12" fill="#333">Walk times at 3.2 m/s from spawn: Life Support door ~3 s, Science Lab steps ~4 s, solar readout ~5 s.</text>`);
add('</svg>');
writeFileSync(new URL('../docs/moon-map-topdown.svg', import.meta.url), out.join('\n'));
console.log('wrote docs/moon-map-topdown.svg', W, 'x', H);
