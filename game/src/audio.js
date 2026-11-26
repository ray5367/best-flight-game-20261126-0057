// Coral Run — every sound is synthesized with WebAudio: an engine drone, wind,
// and short chimes for rings, beacons, touchdowns and crashes. One job: make
// noise that follows the flight, and nothing else.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    // Engine: two detuned saws through a low-pass, pitched by throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.7;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise, louder with speed.
    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSource.start();
    return ctx;
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  return {
    /** Start the audio graph on the first user gesture. */
    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended') c.resume();
    },
    /** Engine and wind follow the flight, every frame. */
    update(plane) {
      if (!ctx || muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (windGain) windGain.gain.value = 0;
        return;
      }
      const throttle = plane.throttle;
      const speed = plane.speed / 220;
      engineOsc.frequency.value = 48 + throttle * 66 + speed * 22;
      engineOsc2.frequency.value = 48.7 + throttle * 66 + speed * 22;
      engineGain.gain.value = 0.028 + throttle * 0.05;
      windGain.gain.value = speed * speed * 0.05;
    },
    ring() {
      blip(880, 0.18, 'sine', 0.16);
      blip(1318, 0.28, 'sine', 0.14, 0.09);
    },
    beacon() {
      blip(659, 0.2, 'triangle', 0.16);
      blip(988, 0.32, 'triangle', 0.14, 0.1);
    },
    touchdown() {
      blip(180, 0.3, 'sine', 0.22);
      blip(523, 0.25, 'sine', 0.14, 0.12);
      blip(784, 0.4, 'sine', 0.14, 0.22);
    },
    crash() {
      blip(140, 0.5, 'sawtooth', 0.2);
      blip(70, 0.7, 'sawtooth', 0.18, 0.08);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.4, 'sine', 0.15, i * 0.13));
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    isMuted() {
      return muted;
    },
  };
}
