const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

const AUDIO_UPDATE_INTERVAL_MS = 1000 / 30;
const MASTER_GAIN = 0.72;

let context = null;
let masterGain = null;
let engineGain = null;
let engineFilter = null;
let engineLow = null;
let engineHigh = null;
let driftGain = null;
let driftFilter = null;
let skidGain = null;
let skidFilter = null;
let boostGain = null;
let boostFilter = null;
let boostTone = null;
let lastUpdateAt = -Infinity;
let lastBoostActive = false;
let lotOpen = false;
let installed = false;

export function installTurnAudio() {
  if (installed) return globalThis.__turnAudio;
  installed = true;

  const api = Object.freeze({
    unlock,
    update,
    cue,
    silence,
    get available() {
      return Boolean(AudioContextClass);
    },
    get state() {
      return context?.state || 'unavailable';
    }
  });

  globalThis.__turnAudio = api;

  document.addEventListener('pointerdown', unlockFromGesture, { capture: true, passive: true });
  document.addEventListener('pointerdown', handleLotPointerDown, { capture: true, passive: true });
  document.addEventListener('keydown', unlockFromGesture, { capture: true });
  document.addEventListener('click', handleUiClick, { capture: true });
  document.addEventListener('change', handleUiChange, { capture: true });
  document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
  window.addEventListener('pagehide', handlePageHide, { passive: true });

  lotOpen = document.body?.classList.contains('turn-lot-open') || false;
  if (document.body && typeof MutationObserver !== 'undefined') {
    const lotObserver = new MutationObserver(handleLotVisibilityChange);
    lotObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  return api;
}

export async function unlock() {
  if (!AudioContextClass) return false;
  ensureGraph();
  if (!context) return false;
  if (context.state === 'running') return true;

  try {
    await context.resume();
  } catch (_) {
    return false;
  }
  return context.state === 'running';
}

export function update(frame = {}, now = performance.now()) {
  if (!context || context.state !== 'running') return;
  if (now - lastUpdateAt < AUDIO_UPDATE_INTERVAL_MS) return;
  lastUpdateAt = now;

  const active = Boolean(frame.active);
  const speed = Math.max(0, Number(frame.speed) || 0);
  const maxSpeed = Math.max(1, Number(frame.maxSpeed) || 1);
  const speedRatio = clamp(speed / maxSpeed, 0, 1.25);
  const throttle = clamp(Number(frame.throttle) || 0, 0, 1);
  const driftAmount = clamp(Number(frame.driftAmount) || 0, 0, 1);
  const driftHeld = Boolean(frame.driftHeld);
  const boostActive = active && Boolean(frame.boostActive);
  const enginePitch = clamp(
    Number(frame.enginePitch ?? globalThis.__turnVehicleTuning?.enginePitch) || 1,
    0.55,
    1.7
  );
  const audioNow = context.currentTime;

  const engineLevel = active
    ? 0.045 + speedRatio * 0.045 + throttle * 0.075
    : 0;
  const engineBaseHz = (52 + speedRatio * 96 + throttle * 24) * enginePitch;
  smooth(engineGain.gain, engineLevel, audioNow, 0.06);
  smooth(engineLow.frequency, engineBaseHz, audioNow, 0.045);
  smooth(engineHigh.frequency, engineBaseHz * 2.02, audioNow, 0.045);
  smooth(
    engineFilter.frequency,
    (420 + speedRatio * 1450 + throttle * 420) * (0.82 + enginePitch * 0.18),
    audioNow,
    0.06
  );

  // Ordinary cornering can create a little physics slip, but it should sit far below
  // the engine. Holding DRIFT adds a stronger tire layer plus a separate high skid hiss.
  const slipIntent = clamp((driftAmount - 0.12) / 0.88, 0, 1);
  const driftSpeed = clamp((speed - 10) / 42, 0, 1);
  const regularSlipLevel = active ? slipIntent * driftSpeed * 0.018 : 0;
  const deliberateDriftLevel = active && driftHeld
    ? driftSpeed * (0.018 + slipIntent * 0.032)
    : 0;
  const driftLevel = regularSlipLevel + deliberateDriftLevel;
  const skidLevel = active && driftHeld
    ? driftSpeed * clamp((driftAmount - 0.08) / 0.92, 0, 1) * 0.045
    : 0;
  smooth(driftGain.gain, driftLevel, audioNow, 0.05);
  smooth(driftFilter.frequency, 720 + speedRatio * 1200, audioNow, 0.08);
  smooth(skidGain.gain, skidLevel, audioNow, 0.045);
  smooth(skidFilter.frequency, 2500 + speedRatio * 2800, audioNow, 0.055);

  const boostLevel = boostActive ? 0.16 : 0;
  smooth(boostGain.gain, boostLevel, audioNow, boostActive ? 0.035 : 0.09);
  smooth(boostFilter.frequency, 1050 + speedRatio * 1000, audioNow, 0.05);
  smooth(boostTone.frequency, 82 + speedRatio * 58, audioNow, 0.045);

  if (boostActive && !lastBoostActive) playCueNow('boost-start');
  lastBoostActive = boostActive;
}

export function cue(name, options = {}) {
  void unlock().then((ready) => {
    if (ready) playCueNow(name, options);
  });
}

export function silence() {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime;
  hardMute(engineGain.gain, now);
  hardMute(driftGain.gain, now);
  hardMute(skidGain.gain, now);
  hardMute(boostGain.gain, now);
  lastBoostActive = false;
}

function ensureGraph() {
  if (context || !AudioContextClass) return;

  try {
    context = new AudioContextClass({ latencyHint: 'interactive' });
  } catch (_) {
    context = new AudioContextClass();
  }

  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 12;
  compressor.ratio.value = 4;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.16;

  masterGain = context.createGain();
  masterGain.gain.value = MASTER_GAIN;
  masterGain.connect(compressor);
  compressor.connect(context.destination);

  installEngineGraph();
  installDriftGraph();
  installBoostGraph();
}

function installEngineGraph() {
  engineGain = context.createGain();
  engineGain.gain.value = 0;

  engineFilter = context.createBiquadFilter();
  engineFilter.type = 'lowpass';
  engineFilter.frequency.value = 520;
  engineFilter.Q.value = 1.1;

  const lowMix = context.createGain();
  lowMix.gain.value = 0.72;
  const highMix = context.createGain();
  highMix.gain.value = 0.2;

  engineLow = context.createOscillator();
  engineLow.type = 'triangle';
  engineLow.frequency.value = 52;
  engineLow.connect(lowMix);

  engineHigh = context.createOscillator();
  engineHigh.type = 'sawtooth';
  engineHigh.frequency.value = 105;
  engineHigh.connect(highMix);

  lowMix.connect(engineFilter);
  highMix.connect(engineFilter);
  engineFilter.connect(engineGain);
  engineGain.connect(masterGain);

  engineLow.start();
  engineHigh.start();
}

function installDriftGraph() {
  driftGain = context.createGain();
  driftGain.gain.value = 0;

  driftFilter = context.createBiquadFilter();
  driftFilter.type = 'bandpass';
  driftFilter.frequency.value = 900;
  driftFilter.Q.value = 0.58;

  skidGain = context.createGain();
  skidGain.gain.value = 0;

  skidFilter = context.createBiquadFilter();
  skidFilter.type = 'bandpass';
  skidFilter.frequency.value = 3200;
  skidFilter.Q.value = 1.05;

  const driftNoise = context.createBufferSource();
  driftNoise.buffer = makeNoiseBuffer(context, 1.4, 0.72);
  driftNoise.loop = true;
  driftNoise.connect(driftFilter);
  driftFilter.connect(driftGain);
  driftGain.connect(masterGain);

  const skidNoise = context.createBufferSource();
  skidNoise.buffer = makeNoiseBuffer(context, 1.1, 0.1);
  skidNoise.loop = true;
  skidNoise.connect(skidFilter);
  skidFilter.connect(skidGain);
  skidGain.connect(masterGain);

  driftNoise.start();
  skidNoise.start();
}

function installBoostGraph() {
  boostGain = context.createGain();
  boostGain.gain.value = 0;

  boostFilter = context.createBiquadFilter();
  boostFilter.type = 'bandpass';
  boostFilter.frequency.value = 1300;
  boostFilter.Q.value = 0.45;

  const boostNoiseMix = context.createGain();
  boostNoiseMix.gain.value = 0.8;
  const boostToneMix = context.createGain();
  boostToneMix.gain.value = 0.28;

  const boostNoise = context.createBufferSource();
  boostNoise.buffer = makeNoiseBuffer(context, 1.1);
  boostNoise.loop = true;
  boostNoise.connect(boostNoiseMix);

  boostTone = context.createOscillator();
  boostTone.type = 'triangle';
  boostTone.frequency.value = 82;
  boostTone.connect(boostToneMix);

  boostNoiseMix.connect(boostFilter);
  boostToneMix.connect(boostFilter);
  boostFilter.connect(boostGain);
  boostGain.connect(masterGain);

  boostNoise.start();
  boostTone.start();
}

function playCueNow(name, options = {}) {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime;

  switch (name) {
    case 'garage-open':
      playTone(260, 390, 0.11, 0.038, 'triangle', now);
      playTone(430, 620, 0.12, 0.032, 'triangle', now + 0.07);
      break;
    case 'ui-confirm':
      playTone(420, 610, 0.085, 0.075, 'triangle', now);
      playTone(610, 760, 0.09, 0.06, 'triangle', now + 0.07);
      break;
    case 'ui-back':
      playTone(390, 250, 0.12, 0.06, 'triangle', now);
      break;
    case 'car-select': {
      const pitch = clamp(Number(options.enginePitch) || 1, 0.55, 1.7);
      playTone(170 * pitch, 310 * pitch, 0.12, 0.052, 'square', now);
      playNoiseBurst(now, 0.07, 0.022, 320 * pitch, 920 * pitch);
      break;
    }
    case 'paint-select':
      playTone(560, 760, 0.065, 0.032, 'triangle', now);
      break;
    case 'boost-start':
      playNoiseBurst(now, 0.18, 0.11, 720, 2400);
      playTone(92, 180, 0.18, 0.075, 'sawtooth', now);
      break;
    case 'ui-tap':
    default:
      playTone(330, 420, 0.055, 0.038, 'triangle', now);
      break;
  }
}

function playTone(startHz, endHz, duration, level, type, startAt) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const endAt = startAt + duration;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(Math.max(1, startHz), startAt);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endHz), endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), startAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  oscillator.connect(gain);
  gain.connect(masterGain);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
}

function playNoiseBurst(startAt, duration, level, lowHz, highHz) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const endAt = startAt + duration;

  source.buffer = makeNoiseBuffer(context, Math.max(0.2, duration));
  filter.type = 'bandpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(lowHz, startAt);
  filter.frequency.exponentialRampToValueAtTime(highHz, endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(level, startAt + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  source.start(startAt);
  source.stop(endAt + 0.02);
}

function makeNoiseBuffer(audioContext, seconds, smoothing = 0.72) {
  const frameCount = Math.max(1, Math.ceil(audioContext.sampleRate * seconds));
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  const memory = clamp(Number(smoothing) || 0, 0, 0.98);
  const fresh = 1 - memory;

  for (let index = 0; index < frameCount; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * memory + white * fresh;
    data[index] = previous;
  }
  return buffer;
}

function smooth(param, value, time, timeConstant) {
  param.setTargetAtTime(value, time, timeConstant);
}

function hardMute(param, time) {
  param.cancelScheduledValues(time);
  param.setValueAtTime(0, time);
}

function handleLotPointerDown(event) {
  if (!event.target.closest?.('.lot-canvas-host')) return;
  cue('car-select');
}

function handleUiChange(event) {
  if (event.target.matches?.('.lot-color-input')) cue('paint-select');
}

function handleLotVisibilityChange() {
  const nextLotOpen = document.body?.classList.contains('turn-lot-open') || false;
  if (nextLotOpen && !lotOpen) cue('garage-open');
  lotOpen = nextLotOpen;
}

function handleUiClick(event) {
  const button = event.target.closest?.('button');
  if (!button) return;
  if (button.closest('.drive-pad') || button.classList.contains('pedal') || button.classList.contains('brake-reverse')) return;

  if (button.matches('#motionButton, #manualButton, .lot-race, .nuke-confirm')) {
    cue('ui-confirm');
    return;
  }
  if (button.matches('.lot-back, .lot-view-close, .nuke-cancel')) {
    cue('ui-back');
    return;
  }
  cue('ui-tap');
}

function unlockFromGesture() {
  void unlock();
}

function handleVisibilityChange() {
  if (document.hidden) {
    silence();
    suspendContext();
  }
}

function handlePageHide() {
  silence();
  suspendContext();
}

function suspendContext() {
  if (context?.state !== 'running') return;
  void context.suspend().catch(() => {});
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
