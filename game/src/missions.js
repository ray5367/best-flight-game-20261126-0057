// Coral Run — the sorties: three missions, one after the other, and the crash and
// landing calls. One job: know what the pilot has to do next, and when it is done.
import {
  BEACON_RADIUS,
  LANDING_MAX_SINK,
  LANDING_MAX_SPEED,
  LIVES,
  RING_RADIUS,
  SCORE_BEACON,
  SCORE_LANDING,
  SCORE_RING,
} from './config.js';
import { groundHeight, isOnRunway } from './terrain.js';

export const MISSION_RING_RUN = 0;
export const MISSION_TOUR = 1;
export const MISSION_LANDING = 2;

export const MISSION_NAMES = ['Ring Run', 'Island Tour', 'Touchdown'];
export const MISSION_BRIEFS = [
  'Fly through all 8 rings over the islands.',
  'Pass the 3 beacons, then come home.',
  'Land on the runway: slow, low, gear down.',
];

export const EVENT_NONE = 0;
export const EVENT_RING = 1 << 0;
export const EVENT_BEACON = 1 << 1;
export const EVENT_MISSION = 1 << 2;
export const EVENT_CRASH = 1 << 3;
export const EVENT_LANDED = 1 << 4;
export const EVENT_WIN = 1 << 5;

/** Fresh campaign state. */
export function createMissions(course) {
  return {
    mission: MISSION_RING_RUN,
    ringsDone: 0,
    beaconsDone: 0,
    score: 0,
    lives: LIVES,
    rings: course.rings.map((r) => ({ ...r })),
    beacons: course.beacons.map((b) => ({ ...b })),
    // Where a crash drops the pilot back to: the start of the current mission.
    checkpoint: { x: 0, y: 6, z: 120, heading: 0 },
    message: '',
    messageUntil: 0,
  };
}

/** The target the pilot is flying toward right now (ring, beacon or runway). */
export function currentTarget(m) {
  if (m.mission === MISSION_RING_RUN) {
    return m.rings.find((r) => !r.passed) ?? { x: 0, y: 6, z: 120, r: 0 };
  }
  if (m.mission === MISSION_TOUR) {
    return m.beacons.find((b) => !b.passed) ?? { x: 0, y: 6, z: 120, r: 0 };
  }
  return { x: 0, y: 6, z: 120, r: 0, runway: true };
}

/** Short progress line for the HUD: "Ring 3/8", "Beacon 1/3", "Land on the runway". */
export function missionProgress(m) {
  if (m.mission === MISSION_RING_RUN) return `Ring ${m.ringsDone + 1}/8`;
  if (m.mission === MISSION_TOUR) return `Beacon ${m.beaconsDone + 1}/3`;
  return 'Land on the runway';
}

function dist3(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function setMessage(m, text, now) {
  m.message = text;
  m.messageUntil = now + 3;
}

function advanceMission(m, now) {
  if (m.mission === MISSION_RING_RUN) {
    m.mission = MISSION_TOUR;
    m.checkpoint = { x: 0, y: 6, z: 120, heading: 0 };
    setMessage(m, 'Ring Run complete! Now the Island Tour.', now);
    return EVENT_MISSION;
  }
  if (m.mission === MISSION_TOUR) {
    m.mission = MISSION_LANDING;
    setMessage(m, 'Tour complete! Bring her home to the runway.', now);
    return EVENT_MISSION;
  }
  return EVENT_NONE;
}

/**
 * Check the world against the campaign: rings, beacons, the ground and the runway.
 * `now` is the world clock in seconds. Returns an event bitmask.
 */
export function stepMissions(m, plane, now) {
  let events = EVENT_NONE;

  if (m.mission === MISSION_RING_RUN) {
    for (const ring of m.rings) {
      if (ring.passed) continue;
      if (dist3(plane, ring) < ring.r + 2) {
        ring.passed = true;
        m.ringsDone += 1;
        m.score += SCORE_RING;
        events |= EVENT_RING;
        setMessage(m, `Ring ${m.ringsDone}/8 — +${SCORE_RING}`, now);
        if (m.ringsDone === m.rings.length) events |= advanceMission(m, now);
        break;
      }
    }
  } else if (m.mission === MISSION_TOUR) {
    for (const beacon of m.beacons) {
      if (beacon.passed) continue;
      if (dist3(plane, beacon) < BEACON_RADIUS + 4) {
        beacon.passed = true;
        m.beaconsDone += 1;
        m.score += SCORE_BEACON;
        events |= EVENT_BEACON;
        setMessage(m, `Beacon ${m.beaconsDone}/3 — +${SCORE_BEACON}`, now);
        if (m.beaconsDone === m.beacons.length) events |= advanceMission(m, now);
        break;
      }
    }
  }

  // The ground, decided by the flight model: a flying plane that just touched
  // down either lands on the runway or crashes. A taxiing plane never trips this.
  if (plane.justLanded) {
    const onStrip = isOnRunway(plane.x, plane.z);
    const gentle = Math.abs(plane.touchSink) <= LANDING_MAX_SINK
      && plane.speed <= LANDING_MAX_SPEED
      && Math.abs(plane.roll) < 0.35;
    if (m.mission === MISSION_LANDING && onStrip && gentle) {
      m.score += SCORE_LANDING;
      events |= EVENT_LANDED | EVENT_WIN;
      setMessage(m, `Touchdown! +${SCORE_LANDING}`, now);
    } else {
      events |= EVENT_CRASH;
    }
  }
  return events;
}

/** After a crash: one life fewer, back at the mission checkpoint, parked. */
export function applyCrash(m, plane) {
  m.lives -= 1;
  plane.x = m.checkpoint.x;
  plane.y = groundHeight(m.checkpoint.x, m.checkpoint.z) + 1.2;
  plane.z = m.checkpoint.z;
  plane.heading = m.checkpoint.heading;
  plane.pitch = 0;
  plane.roll = 0;
  plane.speed = 0;
  plane.throttle = 0;
  plane.airborne = false;
  plane.fuel = Math.max(plane.fuel, 40);
  setMessage(m, m.lives > 0 ? `Crashed! ${m.lives} ${m.lives === 1 ? 'life' : 'lives'} left.` : 'Crashed! No lives left.', 0);
}
