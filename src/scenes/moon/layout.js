// Moon · The Long Shadow — world layout (single source of truth).
// Units: metres. Axes (three.js): +x = east, +z = south, -z = north, +y = up.
// Bearing: degrees clockwise from north (0 = -z, 90 = +x).
// The site is fictional ("near the lunar south pole"); nothing here is a real location.

export const MOON_SEED = 1969;

export const PLAY_AREA = { minX: -17, maxX: 16.5, minZ: -14, maxZ: 13.5 }; // walkable box (~33.5 x 27.5 m)
export const BASE_PAD = { x: 0, z: -3, radius: 10, blend: 4 }; // flattened ground under the base
export const TERRAIN_CENTER = { x: 0, z: -3 }; // polar terrain mesh is centred here

export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.35;

// Spawn: southern edge of the base, looking NNE so Earth, both modules,
// the solar array and the ridge are all in the first frame.
export const SPAWN = { x: 0, z: 11, bearing: 12, pitch: -0.06 };

export const MODULES = {
  crew: { // Life Support habitat — round dome, airlock faces south
    x: -5.5, z: -2.5, radius: 3.0, height: 2.6,
    door: { x: -5.5, z: 2.3 }, // outside the airlock hatch
  },
  lab: { // Science Lab — box on legs, door + steps face south
    x: 5, z: -4, width: 5, depth: 3.2, height: 2.5, legHeight: 0.9,
    door: { x: 5, z: -0.6 }, // foot of the steps
  },
};

export const SOLAR_ARRAY = {
  x: 12.6, z: -7, rows: 3, perRow: 4,
  rowSpacing: 2.8, panelSpacing: 2.25, panelW: 2.0, panelH: 1.5, mastH: 1.7,
};

// Ridge NE of the array. When the Sun is at bearing ~55 deg (shift 2) the
// ridge stands between the Sun and every panel -> "Solar output: 0".
export const RIDGE = {
  x: 21.7, z: -12.7, // centre of the crest line
  dir: [0.574, 0.819], // crest runs along this (x, z) unit vector (NNE-SSW)
  halfLength: 10, height: 7.5, sigma: 3.6,
};

export const CRATERS = [
  { x: -12, z: 6, r: 4.5, depth: 1.3, rim: 0.45 }, // main side crater (walkable, west of route)
  { x: -8.5, z: -10, r: 2.6, depth: 0.7, rim: 0.25 }, // behind Life Support
  { x: 9.5, z: 10.5, r: 1.6, depth: 0.35, rim: 0.12 },
  { x: -14.5, z: -12, r: 1.8, depth: 0.4, rim: 0.15 },
  { x: 1.5, z: -12.5, r: 1.3, depth: 0.3, rim: 0.1 },
];

// Large boulders = colliders. r = collision radius (visual is a bit smaller).
export const BOULDERS = [
  { x: -14, z: -6, r: 1.4, type: 0 },
  { x: 9.2, z: 7.6, r: 1.0, type: 1 },
  { x: 15.6, z: 3.2, r: 1.5, type: 2 },
  { x: -2.2, z: -12, r: 1.1, type: 3 },
  { x: -15.2, z: 10.4, r: 1.1, type: 1 },
  { x: 7.8, z: -12.8, r: 0.9, type: 0 },
];

// Main route (rover tracks + guide posts). Polylines of [x, z].
export const ROUTES = {
  trunk: [[0, 12.5], [0, 8], [0.2, 5]], // spawn -> fork
  toCrew: [[0.2, 5], [-2.5, 3.8], [-5.5, 2.6]],
  toLab: [[0.2, 5], [3, 2.2], [5, -0.4]],
  toArray: [[5, -0.4], [8.5, -2.2], [11, -3.6]],
};
export const FORK = { x: 0.6, z: 5.2 };

// Sky objects. Earth is pinned to a world direction and follows the camera
// (zero parallax). Size is artistically enlarged (see docs/moon-map.md).
export const EARTH = { bearing: 350, elevation: 9, distance: 420, radius: 16 };

// Sun per shift (index 0..3). Compressed and stylised: real polar Sun stays
// <= ~1.5 deg high; we use 4-8 deg so the ground stays readable.
// Azimuth moves one way (decreasing bearing) across the four shifts.
export const SUN_BY_SHIFT = [
  { bearing: 140, elevation: 7 }, // shift 1 — panels lit
  { bearing: 55, elevation: 4 }, // shift 2 — Sun behind the ridge, panels in shadow
  { bearing: 325, elevation: 7.5 }, // shift 3 — lit again (clear of the lab's shadow)
  { bearing: 185, elevation: 8 }, // shift 4 — lit (clear of the lab's shadow)
];

export function bearingToDir(bearingDeg, elevationDeg = 0) {
  const b = (bearingDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  return [Math.sin(b) * Math.cos(e), Math.sin(e), -Math.cos(b) * Math.cos(e)];
}
