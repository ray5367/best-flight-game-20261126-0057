// Coral Run — the aircraft: arcade flight physics. One job: turn throttle, pitch
// and bank into speed, climb, turn and position, and say when the wing stalls.
import {
  CLIMB_RATE,
  CRUISE_THROTTLE,
  FUEL_DRAIN,
  MAX_PITCH,
  MAX_ROLL,
  MAX_SPEED,
  MIN_SPEED,
  PITCH_RATE,
  ROLL_RATE,
  SPEED_RESPONSE,
  SPAWN,
  TURN_RATE,
} from './config.js';
import { groundHeight } from './terrain.js';

/** Fresh flight state, sitting on the runway. */
export function createPlane() {
  return {
    x: SPAWN.x,
    y: SPAWN.y,
    z: SPAWN.z,
    heading: SPAWN.heading, // rad, 0 = +z (north)
    pitch: 0, // rad, positive = nose up
    roll: 0, // rad, positive = bank right
    speed: 0, // knots
    throttle: 0,
    fuel: 100, // percent
    gearDown: true,
    airborne: false, // latched true once the wheels leave the ground
    verticalSpeed: 0, // ft/s, for the HUD and the landing check
    justLanded: false, // set on the step the wheels touch the ground while flying
    touchSink: 0, // vertical speed at that touch, ft/s
  };
}

export function resetPlane(plane) {
  const fresh = createPlane();
  Object.assign(plane, fresh);
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Advance the flight model one fixed step.
 * controls: { pitch: -1..1 (stick back = climb), roll: -1..1, throttle: -1..1 delta }
 * Returns { stalled } — true while the wing has no lift.
 */
export function stepPlane(plane, controls, dt) {
  // Throttle: a held key moves it, and it stays where it was left.
  plane.throttle = clamp(plane.throttle + controls.throttle * dt * 0.55, 0, 1);
  if (plane.fuel <= 0) plane.throttle = 0;

  // Stick: pitch and bank chase the commanded angles.
  const targetPitch = controls.pitch * MAX_PITCH;
  const targetRoll = controls.roll * MAX_ROLL;
  plane.pitch += clamp(targetPitch - plane.pitch, -PITCH_RATE * dt, PITCH_RATE * dt);
  plane.roll += clamp(targetRoll - plane.roll, -ROLL_RATE * dt, ROLL_RATE * dt);

  // Speed chases the throttle, helped downhill and hurt uphill.
  const targetSpeed = plane.throttle * MAX_SPEED + Math.sin(plane.pitch) * -28;
  plane.speed += clamp(targetSpeed - plane.speed, -SPEED_RESPONSE * 90 * dt, SPEED_RESPONSE * 90 * dt);
  plane.speed = clamp(plane.speed, 0, MAX_SPEED + 20);

  // A stalled wing cannot hold the nose up — but only once the plane is really
  // flying. A parked or taxiing plane never stalls.
  const groundBefore = groundHeight(plane.x, plane.z);
  const stalled = plane.speed < MIN_SPEED && plane.y - groundBefore > 8;
  if (stalled) plane.pitch = Math.max(plane.pitch - 0.9 * dt, -0.3);

  // Climb is pitch times speed; a stalled wing sinks instead.
  const climb = stalled
    ? -14
    : Math.sin(plane.pitch) * (plane.speed / MAX_SPEED) * CLIMB_RATE * 3.2;
  plane.verticalSpeed = climb;
  plane.y += climb * dt;

  // Bank turns the nose: turn rate grows with bank and speed.
  const turn = -Math.sin(plane.roll) * TURN_RATE * (0.35 + 0.65 * (plane.speed / MAX_SPEED));
  plane.heading += turn * dt;

  // Move along the heading. Speed is knots; 1 knot ≈ 1.688 ft/s.
  const forward = plane.speed * 1.688 * dt;
  plane.x += Math.sin(plane.heading) * forward;
  plane.z += Math.cos(plane.heading) * forward;

  // The ground, at the new position: once the wheels leave it the plane is
  // flying, and a flying plane that reaches it again touches down — the missions
  // decide whether that is a landing or a crash. A taxiing plane just rolls on.
  const ground = groundHeight(plane.x, plane.z);
  if (plane.y - ground > 1.5) plane.airborne = true;
  plane.justLanded = false;
  if (plane.y <= ground + 1.2) {
    if (plane.airborne) {
      plane.justLanded = true;
      plane.touchSink = plane.verticalSpeed;
      plane.airborne = false;
    }
    plane.y = ground + 1.2;
    plane.verticalSpeed = 0;
  }

  // Fuel burns with throttle; the tanks are empty at 0.
  plane.fuel = Math.max(0, plane.fuel - plane.throttle * FUEL_DRAIN * dt);

  // Gear comes up once airborne and fast, down again when slow and low.
  if (plane.speed > 90 && plane.y > groundHeight(plane.x, plane.z) + 12) plane.gearDown = false;
  if (plane.speed < 80) plane.gearDown = true;

  return { stalled };
}

/** True while the aircraft is sitting on the runway, slow enough to count as parked. */
export function isParked(plane) {
  return plane.speed < 12 && plane.y <= groundHeight(plane.x, plane.z) + 2.5;
}
