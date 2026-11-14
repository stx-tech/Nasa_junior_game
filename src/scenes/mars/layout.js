// Mars · Dust on the Horizon — world layout (single source of truth).
// Units: metres. Axes (three.js): +x = east, +z = south, -z = north, +y = up.
// Bearing: degrees clockwise from north (0 = -z, 90 = +x).
// The site is fictional: a flat plain of sand ripples and light bedrock slabs with
// a large old crater to the west — inspired by the plains Opportunity drove across.

export { bearingToDir } from '../moon/layout.js';

export const MARS_SEED = 2004; // Opportunity landed in January 2004

export const PLAY_AREA = { minX: -17, maxX: 16.5, minZ: -14.5, maxZ: 13.5 };
export const BASE_PAD = { x: 0, z: -3, radius: 11, blend: 4 };
export const TERRAIN_CENTER = { x: 0, z: -3 };

export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.35;

// Spawn: south edge of the base, looking north so Life Support, the greenhouse,
// the lab and the solar array are all in the first frame; the Shelter is to the right.
export const SPAWN = { x: 0, z: 11, bearing: 8, pitch: -0.06 };

// Life Support and the lab use the same sizes as on the Moon (shared builders).
export const MODULES = {
  crew: { x: -7, z: -3, radius: 3.0, height: 2.6 },
  lab: { x: 6, z: -5, width: 5, depth: 3.2, height: 2.5, legHeight: 0.9 },
  // Greenhouse: clear arched tunnel along z, door at the south end.
  greenhouse: { x: -1.2, z: -10, length: 7, radius: 1.7 },
  // Shelter: a half-buried vault under a sandbag berm; door faces west (toward the route).
  shelter: { x: 10.8, z: 5.2, length: 5, radius: 1.9 },
};

export const SOLAR_ARRAY = {
  x: 12.4, z: -10.2, rows: 3, perRow: 3,
  rowSpacing: 2.5, panelSpacing: 2.3, panelW: 2.0, panelH: 1.4, mastH: 1.5,
};

export const READOUT = { x: 9.6, z: -4.4, yaw: -0.6 }; // solar output + dust
export const RADIATION_BOARD = { x: 5.9, z: 8.4, yaw: -0.75 }; // space weather (separate from dust)
export const JUNCTION = { x: 2.6, z: -8.4 };
export const ROVER = { x: -5.4, z: 7.6, yaw: 0.9, r: 1.7 };
export const WEATHER_MAST = { x: -12.6, z: 1.2 };
export const LANDER = { x: 4.2, z: 17 }; // outside the walk box: "you arrived here"

// A walkable side crater (west of the route) and small ones.
export const CRATERS = [
  { x: -12.5, z: 9, r: 3.6, depth: 0.9, rim: 0.35 },
  { x: 4.5, z: -13.2, r: 1.4, depth: 0.3, rim: 0.1 },
  { x: 14.5, z: 11, r: 1.8, depth: 0.4, rim: 0.12 },
  { x: -15.2, z: -9.5, r: 2.2, depth: 0.5, rim: 0.2 },
];

// Large old crater west of the base (its rim is the western horizon) and two
// flat-topped buttes far to the north. Outside the play area.
export const BIG_CRATER = { x: -95, z: -25, r: 62, depth: 9, rim: 7 };
export const BUTTES = [
  { x: 55, z: -170, r: 26, height: 22 },
  { x: -30, z: -230, r: 40, height: 30 },
  { x: 160, z: -60, r: 22, height: 16 },
];

// Light-toned layered bedrock slabs (walkable, low) — the kind of rock where
// Opportunity found the small grey "blueberries" (hematite spherules).
export const OUTCROPS = [
  { x: -11.5, z: -10.5, w: 3.6, d: 2.2, yaw: 0.4 },
  { x: 4.2, z: 9.6, w: 2.6, d: 1.6, yaw: -0.3 },
  { x: 14.6, z: -1.2, w: 2.4, d: 1.8, yaw: 1.0 },
  { x: -15, z: 4.5, w: 2.2, d: 1.5, yaw: 0.2 },
];

// Large boulders = colliders.
export const BOULDERS = [
  { x: -14.6, z: -4.5, r: 1.2, type: 0 },
  { x: 9.4, z: 11.5, r: 0.9, type: 1 },
  { x: 15.4, z: -14.0, r: 1.1, type: 2 },
  { x: -3.6, z: -13.6, r: 0.8, type: 3 },
  { x: -15.4, z: 12.4, r: 1.0, type: 1 },
  { x: 15.6, z: 8.6, r: 1.0, type: 0 },
];

// Routes (rover tracks + guide posts). Polylines of [x, z].
export const ROUTES = {
  trunk: [[0, 12.5], [0, 8], [0.2, 5]],
  toCrew: [[0.2, 5], [-3.2, 3.4], [-7, 2.2]],
  toGreenhouse: [[0.2, 5], [-0.6, 0.5], [-1.2, -5.6]],
  toLab: [[0.2, 5], [4, 1.6], [6.2, -1.2]],
  toShelter: [[0.2, 5], [4.2, 5.2], [7.6, 5.2]],
  toArray: [[6.2, -1.2], [9.6, -3.4], [11, -6.6]],
};
export const FORK = { x: 0.7, z: 5.6 };
export const SIGNPOST = { x: -1.1, z: 6.1, yaw: 0.35 }; // left of the trunk, just before the fork, turned toward spawn

// Sun and sky per shift (index 0..3). generation = [10, 2, 2, 3]:
// shift 1 clear, shifts 2–3 dust storm (sky dark, little light), shift 4 clearing.
// dust: 0 (clear) .. 1 (heaviest). Colours are sRGB hex.
export const SKY_BY_SHIFT = [
  { bearing: 150, elevation: 38, dust: 0.0, zenith: 0xa77a58, horizon: 0xd8b48e, fog: 0.0055, sun: 3.1 },
  { bearing: 175, elevation: 44, dust: 0.85, zenith: 0x5e3d2a, horizon: 0x93694a, fog: 0.05, sun: 0.45 },
  { bearing: 200, elevation: 40, dust: 1.0, zenith: 0x4f3324, horizon: 0x845c40, fog: 0.06, sun: 0.35 },
  { bearing: 225, elevation: 30, dust: 0.55, zenith: 0x87593c, horizon: 0xb98d66, fog: 0.022, sun: 1.3 },
];

// Moons: small and far (Phobos ~1/3 of our Moon's apparent size, Deimos a bright dot).
export const MOONS = [
  { name: 'phobos', bearing: 300, elevation: 24, size: 5.5 },
  { name: 'deimos', bearing: 40, elevation: 52, size: 3.2 },
];

// ---- World actions (shared layer, see src/world/layer.js) ----
export const CONSOLE = { x: -2.8, z: 9.4, yaw: 0.85 };
export const SAMPLE_ROCKS = [
  { id: 'rock1', x: -2.6, z: 1.4 }, // between the greenhouse and Life Support routes
  { id: 'rock2', x: 2.4, z: 0.4 }, // beside the lab route
];
export const LAB_TRAY = { x: 3.9, z: -2.2, yaw: 0 };
