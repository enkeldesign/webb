const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

let context = null;
let masterGain = null;
let noiseBuffer = null;
let prepared = false;
let distortionCurve = null;

let fireSource = null;
let fireLowFilter = null;
let fireHighFilter = null;
let fireLowMix = null;
let fireHighMix = null;
let fireGain = null;
let firePanner = null;

let responderSirenGain = null;
let responderSirenFilter = null;
let responderSirenTone = null;
let responderSirenHarmonic = null;
let responderSirenPanner = null;

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

    // A long, low aircraft-impact bed rather than TURN's short bump/fail transient.
    // The fire bed takes over underneath it and keeps running without gaps afterwards.
    playTone(56, 16, 2.85, 0.13, 'sine', now);
    playTone(132, 22, 1.55, 0.048, 'square', now + 0.03);
    playDistortedNoise(now + 0.015, 3.05, 0.112, 48, 680, 0.92);
    playTone(44, 23, 1.9, 0.072, 'triangle', now + 0.44);
    playNoiseBurst(now + 0.58, 2.28, 0.048, 62, 430, 0.97);
  });
}

export function updateMaydayFire({ active = false, pan = 0, intensity = 0.6 } = {}) {
  updateReady(() => {
    if (!fireGain || !firePanner) return;
    const now = context.currentTime;
    const enabled = Boolean(active) && audioEnabled();
    const level = clamp(Number(intensity) || 0.6, 0.2, 1);
    const targetGain = enabled ? 0.025 + level * 0.024 : 0;
    smooth(fireGain.gain, targetGain, now, enabled ? 0.08 : 0.12);
    smoothPan(firePanner, enabled ? pan : 0, now, 0.08);
    if (fireLowFilter) smooth(fireLowFilter.frequency, 300 + level * 250, now, 0.12);
    if (fireHighFilter) smooth(fireHighFilter.frequency, 1350 + level * 950, now, 0.12);
  }, active);
}

export function updateMaydayResponderSiren({ active = false, pan = 0, intensity = 0.7 } = {}) {
  updateReady(() => {
    if (!responderSirenGain || !responderSirenTone || !responderSirenHarmonic) return;
    const now = context.currentTime;
    const enabled = Boolean(active) && audioEnabled();
    const level = clamp(Number(intensity) || 0.7, 0.2, 1);

    // This is TURN's existing Fire Truck siren voice: the same 430/570 Hz skid,
    // triangle fundamental, 1.5x sine harmonic and 1800 Hz low-pass treatment.
    const frequency = Math.floor(now / 0.58) % 2 === 0 ? 430 : 570;
    smooth(responderSirenGain.gain, enabled ? 0.033 * (0.72 + level * 0.28) : 0, now, enabled ? 0.035 : 0.09);
    smooth(responderSirenTone.frequency, frequency, now, 0.055);
    smooth(responderSirenHarmonic.frequency, frequency * 1.5, now, 0.045);
    smooth(responderSirenFilter.frequency, 1800, now, 0.08);
    smoothPan(responderSirenPanner, enabled ? pan : 0, now, 0.075);
  }, active);
}

export function muteMaydayGuides() {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime;
  if (fireGain) smooth(fireGain.gain, 0, now, 0.06);
  if (responderSirenGain) smooth(responderSirenGain.gain, 0, now, 0.06);
}

function withReady(callback) {
  if (!audioEnabled()) return;
  if (context?.state === 'running') {
    callback();
    return;
  }
  void unlock().then((ready) => {
    if (ready && audioEnabled()) callback();
  });
}

function updateReady(callback, wantsAudio) {
  if (!audioEnabled()) {
    if (context?.state === 'running') callback();
    return;
  }
  if (context?.state === 'running') {
    callback();
    return;
  }
  if (!wantsAudio) return;
  void unlock().then((ready) => {
    if (ready) callback();
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
  noiseBuffer = makeNoiseBuffer(context, 3.4);
  distortionCurve = makeDistortionCurve(85);
  installContinuousFireGraph();
  installResponderSirenGraph();
}

function installContinuousFireGraph() {
  fireSource = context.createBufferSource();
  fireSource.buffer = noiseBuffer;
  fireSource.loop = true;

  fireLowFilter = context.createBiquadFilter();
  fireLowFilter.type = 'bandpass';
  fireLowFilter.frequency.value = 420;
  fireLowFilter.Q.value = 0.58;

  fireHighFilter = context.createBiquadFilter();
  fireHighFilter.type = 'bandpass';
  fireHighFilter.frequency.value = 1900;
  fireHighFilter.Q.value = 0.72;

  fireLowMix = context.createGain();
  fireLowMix.gain.value = 0.78;
  fireHighMix = context.createGain();
  fireHighMix.gain.value = 0.28;
  fireGain = context.createGain();
  fireGain.gain.value = 0;
  firePanner = createStereoPanner(0);

  fireSource.connect(fireLowFilter);
  fireSource.connect(fireHighFilter);
  fireLowFilter.connect(fireLowMix);
  fireHighFilter.connect(fireHighMix);
  fireLowMix.connect(fireGain);
  fireHighMix.connect(fireGain);
  fireGain.connect(firePanner);
  firePanner.connect(masterGain);
  fireSource.start();
}

function installResponderSirenGraph() {
  responderSirenGain = context.createGain();
  responderSirenGain.gain.value = 0;

  responderSirenFilter = context.createBiquadFilter();
  responderSirenFilter.type = 'lowpass';
  responderSirenFilter.frequency.value = 1800;
  responderSirenFilter.Q.value = 0.55;

  const fundamentalMix = context.createGain();
  fundamentalMix.gain.value = 0.72;
  const harmonicMix = context.createGain();
  harmonicMix.gain.value = 0.18;

  responderSirenTone = context.createOscillator();
  responderSirenTone.type = 'triangle';
  responderSirenTone.frequency.value = 430;
  responderSirenTone.connect(fundamentalMix);

  responderSirenHarmonic = context.createOscillator();
  responderSirenHarmonic.type = 'sine';
  responderSirenHarmonic.frequency.value = 645;
  responderSirenHarmonic.connect(harmonicMix);

  fundamentalMix.connect(responderSirenFilter);
  harmonicMix.connect(responderSirenFilter);
  responderSirenFilter.connect(responderSirenGain);
  responderSirenPanner = createStereoPanner(0);
  responderSirenGain.connect(responderSirenPanner);
  responderSirenPanner.connect(masterGain);
  responderSirenTone.start();
  responderSirenHarmonic.start();
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

function smoothPan(node, value, now, timeConstant) {
  if (!node) return;
  if (node.pan) {
    smooth(node.pan, clamp(Number(value) || 0, -1, 1), now, timeConstant);
  }
}

function smooth(param, value, now, timeConstant) {
  if (!param) return;
  const target = Number(value) || 0;
  try {
    param.setTargetAtTime(target, now, Math.max(0.001, timeConstant));
  } catch (_) {
    param.value = target;
  }
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
