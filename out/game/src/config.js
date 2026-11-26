// Coral Run — tuning constants. One job: every number the game balances on, in one place.
export const STEP = 1 / 60;
export const BEST_KEY = 'coral-run-best';

// Flight model.
export const MAX_SPEED = 220; // knots at full throttle
export const MIN_SPEED = 55; // knots: below this the wing stops flying
export const CRUISE_THROTTLE = 0.7;
export const CLIMB_RATE = 26; // ft/s at full pitch up and full speed, scaled by speed
export const TURN_RATE = 0.55; // rad/s at full bank and full speed
export const MAX_PITCH = 0.42; // rad, about 24 degrees
export const MAX_ROLL = 1.1; // rad, about 63 degrees
export const PITCH_RATE = 1.4; // rad/s toward the commanded pitch
export const ROLL_RATE = 2.2; // rad/s toward the commanded bank
export const SPEED_RESPONSE = 0.35; // 1/s toward the throttle's target speed
export const FUEL_DRAIN = 0.16; // percent per second at full throttle
export const LIVES = 3;

// World.
export const WORLD_SEED_DEFAULT = 1;
export const RUNWAY = { x0: -7, x1: 7, z0: 60, z1: 190, height: 1.2 };
export const SPAWN = { x: 0, y: 2.4, z: 120, heading: 0 }; // on the runway, facing +z
export const RING_RADIUS = 9;
export const BEACON_RADIUS = 16;
export const CRASH_MARGIN = 1.6; // ft above the ground the skids clear

// Missions.
export const MISSION_RINGS = 8;
export const MISSION_BEACONS = 3;
export const SCORE_RING = 250;
export const SCORE_BEACON = 400;
export const SCORE_LANDING = 1000;
export const LANDING_MAX_SPEED = 100; // knots on touchdown
export const LANDING_MAX_SINK = 9; // ft/s at touchdown

// Renderer.
export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;
export const FOCAL = 620; // px: perspective focal length
export const HORIZON_FRACTION = 0.42; // horizon line as a fraction of height
export const FAR_Z = 900; // farthest terrain row drawn, ft ahead
export const NEAR_Z = 14;
export const ROWS = 30; // terrain depth rows
export const COLS = 96; // terrain columns across the view
