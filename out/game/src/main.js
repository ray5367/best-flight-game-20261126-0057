// Coral Run — boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between title, play, paused,
// crashed, win and game-over screens.
//
// ?seed=N fixes the course. ?shot=start|play|land|end|over (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createCourse } from './terrain.js';
import { createPlane, isParked, resetPlane, stepPlane } from './plane.js';
import {
  EVENT_BEACON,
  EVENT_CRASH,
  EVENT_LANDED,
  EVENT_MISSION,
  EVENT_RING,
  EVENT_WIN,
  applyCrash,
  createMissions,
  currentTarget,
  stepMissions,
} from './missions.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import {
  SCREEN_CRASHED,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const course = createCourse(seed);
const plane = createPlane();
const missions = createMissions(course);
const renderer = createRenderer(canvas);
const audio = createAudio();
const world = {
  plane,
  missions,
  course,
  time: 0,
  elapsed: 0,
  stalled: false,
  target: currentTarget(missions),
};
void createRandom;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world, seed);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetPlane(plane);
    const fresh = createMissions(course);
    Object.assign(missions, fresh);
    world.target = currentTarget(missions);
    world.elapsed = 0;
    world.time = 0;
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Flying. Ring Run: fly through all 8 rings.');
  }

  function endGame(won) {
    if (won) {
      const timeBonus = Math.max(0, 3600 - Math.round(world.elapsed));
      missions.score += timeBonus;
      screen = SCREEN_WIN;
      audio.win();
    } else {
      screen = SCREEN_OVER;
    }
    if (missions.score > best) {
      best = missions.score;
      saveBest(best);
    }
    announce(won ? `All missions complete. Score ${missions.score}.` : `Game over. Score ${missions.score}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_RESTART && screen !== SCREEN_TITLE) {
      startGame();
      return;
    }
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) {
      startGame();
    } else if (actions & ACTION_CONFIRM && screen === SCREEN_CRASHED) {
      if (missions.lives > 0) {
        screen = SCREEN_PLAY;
        announce('Back in the air.');
      } else {
        endGame(false);
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    world.time += STEP;
    world.elapsed += STEP;
    const { stalled } = stepPlane(plane, input.controls(), STEP);
    world.stalled = stalled;
    audio.update(plane);
    const events = stepMissions(missions, plane, world.time);
    world.target = currentTarget(missions);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_BEACON) audio.beacon();
    if (events & EVENT_MISSION) announce(`Mission ${missions.mission + 1} of 3.`);
    if (events & EVENT_LANDED) {
      audio.touchdown();
      endGame(true);
      return;
    }
    if (events & EVENT_WIN) return;
    if (events & EVENT_CRASH) {
      audio.crash();
      applyCrash(missions, plane);
      world.target = currentTarget(missions);
      if (missions.lives > 0) {
        screen = SCREEN_CRASHED;
        announce('Crashed. Press Space to climb back in.');
      } else {
        endGame(false);
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting it fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A parked plane on the title screen still shows the islands behind it.
  world.target = currentTarget(missions);
  // Debug hook for automated play-tests: live state, never used by the game itself.
  window.__coral = { world, get screen() { return screen; }, get best() { return best; } };
  announce('Coral Run. Press Space or click to fly.');
  requestAnimationFrame(frame);
  void isParked;
}

if (shot) runShot(shot);
else runGame();
