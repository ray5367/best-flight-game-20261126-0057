// Coral Run — keyboard and mouse. One job: turn keys and the pointer into stick,
// throttle and menu actions, and remember them until the loop reads them.
export const ACTION_CONFIRM = 1 << 0;
export const ACTION_PAUSE = 1 << 1;
export const ACTION_MUTE = 1 << 2;
export const ACTION_RESTART = 1 << 3;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0.5; // 0..1 across the canvas
  let mouseY = 0.5;
  let mouseActive = false;

  function keyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyR') actions |= ACTION_RESTART;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  }

  function keyUp(event) {
    keys.delete(event.code);
  }

  function pointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) / rect.width;
    mouseY = (event.clientY - rect.top) / rect.height;
    mouseActive = true;
  }

  function pointerDown(event) {
    pointerMove(event);
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', keyDown);
  window.addEventListener('keyup', keyUp);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerdown', pointerDown);

  function held(code) {
    return keys.has(code);
  }

  return {
    /** Stick and throttle for this frame: { pitch, roll, throttle }. */
    controls() {
      // Keyboard: arrows fly the plane, W/S work the throttle.
      let pitch = 0;
      let roll = 0;
      let throttle = 0;
      if (held('ArrowUp')) pitch += 1;
      if (held('ArrowDown')) pitch -= 1;
      if (held('ArrowLeft')) roll -= 1;
      if (held('ArrowRight')) roll += 1;
      if (held('KeyW') || held('ShiftLeft') || held('ShiftRight')) throttle += 1;
      if (held('KeyS') || held('ControlLeft') || held('ControlRight')) throttle -= 1;
      // Mouse: steer toward the pointer when it has moved and no arrow key is held.
      if (mouseActive && pitch === 0 && roll === 0) {
        roll = (mouseX - 0.5) * 2.4;
        pitch = (0.5 - mouseY) * 1.6;
        roll = Math.max(-1, Math.min(1, roll));
        pitch = Math.max(-1, Math.min(1, pitch));
      }
      return { pitch, roll, throttle };
    },
    /** One-shot menu actions since the last read; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    destroy() {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerdown', pointerDown);
    },
  };
}
