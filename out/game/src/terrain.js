// Coral Run — the archipelago: a deterministic heightfield, the runway, the rings,
// the beacons and the clouds. One job: answer "what is the ground here?" and lay
// out the course the missions fly.
import { createRandom, hash1, smooth } from './random.js';
import { MISSION_BEACONS, MISSION_RINGS, RING_RADIUS, RUNWAY } from './config.js';

// Island peaks: [x, z, radius, height]. The first is the home island with the runway.
const ISLANDS = [
  [0, 120, 170, 11],
  [-260, 420, 130, 15],
  [300, 480, 150, 13],
  [-180, 760, 120, 9],
  [240, 820, 140, 16],
  [60, 1050, 170, 12],
  [-420, 980, 130, 10],
  [430, 1120, 120, 8],
];

function islandHeight(x, z) {
  let h = 0;
  for (let i = 0; i < ISLANDS.length; i += 1) {
    const [ix, iz, r, peak] = ISLANDS[i];
    const dx = (x - ix) / r;
    const dz = (z - iz) / r;
    const d2 = dx * dx + dz * dz;
    if (d2 < 1) h += peak * (1 - d2) * (1 - d2);
  }
  return h;
}

/** Rolling bumps so the ground is never a perfect cone. */
function bumpHeight(x, z) {
  const nx = Math.floor(x / 90);
  const nz = Math.floor(z / 90);
  const fx = smooth(x / 90 - nx);
  const fz = smooth(z / 90 - nz);
  const a = hash1(nx * 73856093 + nz * 19349663);
  const b = hash1((nx + 1) * 73856093 + nz * 19349663);
  const c = hash1(nx * 73856093 + (nz + 1) * 19349663);
  const d = hash1((nx + 1) * 73856093 + (nz + 1) * 19349663);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return (top + (bottom - top) * fz) * 1.1;
}

export function isOnRunway(x, z) {
  return x >= RUNWAY.x0 && x <= RUNWAY.x1 && z >= RUNWAY.z0 && z <= RUNWAY.z1;
}

/** The cleared glide path in front of the runway: flat grass at runway height. */
export const APPROACH = { x0: -12, x1: 12, z0: -90, z1: RUNWAY.z0 };

export function isOnApproach(x, z) {
  return x >= APPROACH.x0 && x <= APPROACH.x1 && z >= APPROACH.z0 && z <= APPROACH.z1;
}

/** Ground height in feet at (x, z). Sea level is 0; the runway is flattened. */
export function groundHeight(x, z) {
  let h = islandHeight(x, z) + bumpHeight(x, z);
  if (h < 0) h = 0; // the sea
  if (isOnRunway(x, z) || isOnApproach(x, z)) return RUNWAY.height;
  // Feather the runway's and the approach's edges so the flat blends into the island.
  const margin = 14;
  const flatX0 = Math.min(RUNWAY.x0, APPROACH.x0);
  const flatX1 = Math.max(RUNWAY.x1, APPROACH.x1);
  const flatZ0 = Math.min(RUNWAY.z0, APPROACH.z0);
  const flatZ1 = Math.max(RUNWAY.z1, APPROACH.z1);
  const dx = Math.max(flatX0 - margin - x, 0, x - (flatX1 + margin));
  const dz = Math.max(flatZ0 - margin - z, 0, z - (flatZ1 + margin));
  const d = Math.max(dx, dz);
  if (d < margin) {
    const t = d / margin;
    h = RUNWAY.height + (h - RUNWAY.height) * t * t;
  }
  return h;
}

/** Colour for a patch of ground at the given height. */
export function groundColor(h, x, z) {
  if (isOnRunway(x, z)) {
    // Asphalt with a dashed centreline.
    const dash = Math.floor(z / 18) % 2 === 0;
    const centre = Math.abs(x) < 0.8;
    if (centre && dash) return '#e8e4d8';
    return '#3a3d42';
  }
  if (h <= 0.05) return '#1d6f9e'; // lagoon
  if (h < 0.9) return '#e6d49a'; // sand
  if (h < 5) return '#5d9e4a'; // grass
  if (h < 9) return '#4a7d3a'; // high grass
  if (h < 13) return '#7a6a55'; // rock
  return '#cfd6dd'; // high peaks
}

/**
 * Lay out the course from a seed: rings snake between the islands, beacons sit over
 * the far islands, and the runway is home. Returns { rings, beacons, clouds }.
 */
export function createCourse(seed) {
  const rng = createRandom(seed);
  const rings = [];
  // Ring i sits ahead of the last, weaving left and right, climbing gently.
  let x = 0;
  let z = 260;
  let y = 42;
  for (let i = 0; i < MISSION_RINGS; i += 1) {
    x += (rng() - 0.5) * 260;
    x = Math.max(-320, Math.min(320, x));
    z += 90 + rng() * 70;
    y = 30 + rng() * 55;
    rings.push({ x, y, z, r: RING_RADIUS, passed: false });
  }
  const beacons = [];
  const beaconIslands = [
    [-260, 420, 95],
    [300, 480, 100],
    [60, 1050, 110],
  ];
  for (let i = 0; i < MISSION_BEACONS; i += 1) {
    const [bx, bz, by] = beaconIslands[i];
    beacons.push({ x: bx, y: by, z: bz, r: 14, passed: false });
  }
  const clouds = [];
  for (let i = 0; i < 46; i += 1) {
    clouds.push({
      x: (rng() - 0.5) * 1600,
      y: 90 + rng() * 130,
      z: 150 + rng() * 1400,
      s: 26 + rng() * 46,
      drift: 2 + rng() * 4,
    });
  }
  return { rings, beacons, clouds };
}
