// Coral Run — the screenshot scenes behind ?shot=start|play|land|end. Each one sets
// the world to an exact, seeded scene and steps it a few seconds with a simple
// autopilot, so the frame is what real play looks like and the same seed always
// gives the same frame.
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Any unknown name stages the title.
 */
export function stageShot(name, world, seed) {
  const { plane, missions, course } = world;
  world.time = 0;
  if (name === 'play') {
    // Mid Ring Run: three rings down, the fourth dead ahead and in frame, islands below.
    // Staged still (no autopilot steps): the plane sits on the ring's line, level,
    // so the ring reads as the target it is.
    missions.rings[0].passed = true;
    missions.rings[1].passed = true;
    missions.rings[2].passed = true;
    missions.ringsDone = 3;
    missions.score = 750;
    const ring = missions.rings[3];
    plane.x = ring.x;
    plane.y = ring.y + 4;
    plane.z = ring.z - 200;
    plane.heading = 0;
    plane.pitch = 0.02;
    plane.roll = 0;
    plane.speed = 165;
    plane.throttle = 0.72;
    plane.fuel = 78;
    world.time = 2.4;
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'land') {
    // Final approach: on the runway's extended centreline, gear down, low and slow,
    // the strip dead ahead. Staged still so the runway stays in frame.
    missions.mission = 2;
    missions.rings.forEach((r) => { r.passed = true; });
    missions.beacons.forEach((b) => { b.passed = true; });
    missions.ringsDone = 8;
    missions.beaconsDone = 3;
    missions.score = 3200;
    plane.x = 2;
    plane.y = 30;
    plane.z = -80;
    plane.heading = 0;
    plane.pitch = -0.05;
    plane.roll = 0;
    plane.speed = 88;
    plane.throttle = 0.35;
    plane.fuel = 31;
    plane.gearDown = true;
    world.time = 2.4;
    return { screen: SCREEN_PLAY, best: 3200 };
  }
  if (name === 'end') {
    // Campaign complete: everything passed, the win screen over the runway.
    missions.mission = 2;
    missions.rings.forEach((r) => { r.passed = true; });
    missions.beacons.forEach((b) => { b.passed = true; });
    missions.ringsDone = 8;
    missions.beaconsDone = 3;
    missions.score = 4200;
    plane.x = 0;
    plane.y = 2.4;
    plane.z = 120;
    plane.heading = 0;
    plane.speed = 0;
    plane.throttle = 0;
    plane.fuel = 24;
    world.elapsed = 1214;
    return { screen: SCREEN_WIN, best: 4200 };
  }
  if (name === 'over') {
    missions.lives = 0;
    return { screen: SCREEN_OVER, best: 1250 };
  }
  // start: parked on the runway at dawn, title over the islands.
  plane.x = 0;
  plane.y = 2.4;
  plane.z = 120;
  plane.heading = 0;
  plane.speed = 0;
  plane.throttle = 0;
  world.time = 4;
  void course;
  void seed;
  return { screen: SCREEN_TITLE, best: 0 };
}
