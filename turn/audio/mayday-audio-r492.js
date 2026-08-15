const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

let context = null;
let masterGain = null;
let noiseBuffer = null;
let prepared = false;
let distortionCurve = null;

export function prepareMaydayAudio() {
  if (prepared || !AudioContextClass) return;
  prepared = true;

  const unlockFromGesture = () => {
    void unlock();
  };
  document.addEventListener('pointerdown', unlockFromGesture, { capture: true, passive: true });
  document.addEventListener('keydown', unlockFromGesture, { capture: true });
}

export function playMaydayCrashSound() {
  withReady(() => {
    const now = context.currentTime;

    // About four times the duration and roughly one quarter of the bright transient
    // pitch from r491: this should read as a distant aircraft impact/rumble rather
    // than TURN's familiar short bump/fail family of cues.
    playTone(58, 17, 2.25, 0.13, 'sine', now);
    playTone(138, 24, 1.3, 0.052, 'square', now + 0.03);
    playDistortedNoise(now + 0.015, 2.45, 0.11, 55, 720, 0.9);
    playTone(46, 26, 1.45, 0.075, 'triangle', now + 0.48);
    playNoiseBurst(now + 0.62, 1.55, 0.05, 70, 460, 0.96);
  });
}

export function pulseMaydayFire({ pan = 0, intensity = 0.6 } = {}) {
  withReady(() => {
    const now = context.currentTime;
    const level = clamp(Number(intensity) || 0.6, 0.25, 1);
    const stereo = clamp(Number(pan) || 0, -0.96, 0.96);
    playNoiseBurst(now, 0.28, 0.025 + level * 0.022, 210, 1650, 0.98, stereo);
    playNoiseBurst(now + 0.085, 0.15, 0.015 + level * 0.014, 620, 2800, 0.84, stereo);
  });
}

export function pulseMaydayResponderSiren({ service = 'ambulance', pan = 0, high = false } = {}) {
  withReady(() => {
    const now = context.currentTime;
    const stereo = clamp(Number(pan) || 0, -0.96, 0.96);
    const pair = service === 'firetruck' ? [430, 570] : [610, 820];
    const start = high ? pair[1] : pair[0];
    const end = high ? pair[0] : pair[1];
    const level = service === 'firetruck' ? 0.068 : 0.062;

    // Long enough to overlap the 540 ms pulse cadence slightly, so the responder
    // actually reads as an ongoing siren rather than isolated notification beeps.
    playTone(start, end, 0.58, level, 'triangle', now, stereo);
    playTone(start * 1.5, end * 1.5, 0.58, level * 0.28, 'sine', now, stereo);
  });
}

function withReady(callback) {
  if (!audioEnabled()) return;
  void unlock().then((ready) => {
    if (ready && audioEnabled()) callback();
  });
}

async function unlock() {
  if (!AudioContextClass) return false;
  ensureContext();
  if (!context) return false;
  if (context.state === 'running') return true;
  try {
    await context.resume();
  } catch (_) {
    return false;
  }
  return context.state === 'running';
}

function ensureContext() {
  if (context || !AudioContextClass) return;
  try {
    context = new AudioContextClass({ latencyHint: 'interactive' });
  } catch (_) {
    context = new AudioContextClass();
  }

  masterGain = context.createGain();
  masterGain.gain.value = 0.66;
  masterGain.connect(context.destination);
  noiseBuffer = makeNoiseBuffer(context, 2.8);
  distortionCurve = makeDistortionCurve(85);
}

function audioEnabled() {
  const settings = globalThis.__turnAudioPreferences?.getSettings?.();
  return settings?.audioEnabled !== false;
}

function playTone(startHz, endHz, duration, level, type, startAt, pan = 0) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const panner = createStereoPanner(pan);
  const endAt = startAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, startHz), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), endAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), startAt + Math.min(0.03, duration * 0.16));
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gain);
  gain.connect(panner);
  panner.connect(masterGain);
  oscillator.addEventListener('ended', () => disconnect(oscillator, gain, panner), { once: true });
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
}

function playNoiseBurst(startAt, duration, level, lowHz, highHz, roughness, pan = 0) {
  if (!noiseBuffer) return;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const panner = createStereoPanner(pan);
  const endAt = startAt + duration;

  source.buffer = noiseBuffer;
  source.loop = true;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(Math.max(40, highHz), startAt);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, lowHz), endAt);
  filter.Q.value = 0.45 + clamp(Number(roughness) || 0.8, 0, 1) * 0.65;
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), startAt + Math.min(0.025, duration * 0.12));
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(masterGain);
  source.addEventListener('ended', () => disconnect(source, filter, gain, panner), { once: true });
  source.start(startAt);
  source.stop(endAt + 0.02);
}

function playDistortedNoise(startAt, duration, level, lowHz, highHz, roughness) {
  if (!noiseBuffer) return;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const shaper = context.createWaveShaper();
  const gain = context.createGain();
  const endAt = startAt + duration;

  source.buffer = noiseBuffer;
  source.loop = true;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(40, highHz), startAt);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, lowHz), endAt);
  filter.Q.value = 0.5 + clamp(Number(roughness) || 0.8, 0, 1) * 0.8;
  shaper.curve = distortionCurve;
  shaper.oversample = '2x';
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), startAt + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  source.connect(filter);
  filter.connect(shaper);
  shaper.connect(gain);
  gain.connect(masterGain);
  source.addEventListener('ended', () => disconnect(source, filter, shaper, gain), { once: true });
  source.start(startAt);
  source.stop(endAt + 0.02);
}

function createStereoPanner(pan) {
  if (typeof context.createStereoPanner === 'function') {
    const node = context.createStereoPanner();
    node.pan.value = clamp(Number(pan) || 0, -1, 1);
    return node;
  }
  const gain = context.createGain();
  gain.gain.value = 1;
  return gain;
}

function makeNoiseBuffer(audioContext, seconds) {
  const frames = Math.max(1, Math.floor(audioContext.sampleRate * seconds));
  const buffer = audioContext.createBuffer(1, frames, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < frames; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.82 + white * 0.18;
    data[index] = previous * 0.78 + white * 0.22;
  }
  return buffer;
}

function makeDistortionCurve(amount) {
  const samples = 512;
  const curve = new Float32Array(samples);
  const k = Math.max(1, Number(amount) || 50);
  for (let index = 0; index < samples; index += 1) {
    const x = index * 2 / (samples - 1) - 1;
    curve[index] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function disconnect(...nodes) {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch (_) {}
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
