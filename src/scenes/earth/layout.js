// Earth · Keep the Pump Ready — a small fenced field station (single source of coordinates).
// Units: metres. +x = east, +z = south, -z = north.
export { bearingToDir } from '../moon/layout.js';

export const EARTH_SEED = 1972;
export const PLAY_AREA = { minX: -10, maxX: 10, minZ: -10.5, maxZ: 9.5 };
export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.35;
export const SPAWN = { x: 0, z: 8, bearing: 0, pitch: -0.08 };

// Same greenhouse size as on Mars (shared builder), door faces south.
export const GREENHOUSE = { x: -3.6, z: -5.2, length: 7, radius: 1.7 };
export const BATTERY = { x: -6.4, z: 2.6, yaw: 0.5 }; // battery cabinet with a big display
export const BENCH = { x: 4.4, z: 1.6, yaw: -0.3 }; // soil test bench (module key: lab)
export const PUMP = { x: 2.6, z: -3.6 }; // water pump (module key: pump)
export const SHED = { x: 6.8, z: -6.8 };
export const CONSOLE = { x: 1.9, z: 5.6, yaw: -0.33 };
// Pipe from the pump to the greenhouse (east wall), lying on the ground.
export const PIPE = [[2.2, -3.6], [0.6, -3.7], [-1.2, -4.2]];
export const TREES = [[-13, -8], [-12.5, 3], [-14, 10], [13, -9], [12.5, 2], [14, 9], [-6, -13.5], [3, -14], [9, -13], [-2, 13.5], [8, 13]];
// Sun per shift: late afternoon (low in the west), then after sunset.
export const SKY_BY_SHIFT = [
  { bearing: 255, elevation: 7, night: 0, zenith: 0x4f86c6, horizon: 0xf4b67a, sun: 2.2 },
  { bearing: 275, elevation: -8, night: 1, zenith: 0x0b1530, horizon: 0x2c3b63, sun: 0 },
];
