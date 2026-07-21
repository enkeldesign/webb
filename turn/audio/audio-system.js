const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

const AUDIO_UPDATE_INTERVAL_MS = 1000 / 30;
const MASTER_GAIN = 0.72;
const RIVAL_NEAR_ENTER_METERS = 10;
const RIVAL_NEAR_EXIT_METERS = 15;

let context = null;
let masterGain = null;
let engineGain = null;
let engineFilter = null;
let engineLow = null;
let engineHigh = null;
let driftGain = null;
let driftFilter = null;
let gritGain = null;
let gritFilter = null;
let skidGain = null;
let skidFilter = null;
let skidTone = null;
let skidChopGain = null;
let skidPulse = null;
let skidPulseDepth = null;
let skidWobble = null;
let skidWobbleDepth = null;
let boostGain = null;
let lastUpdateAt = -Infinity;
let lastBoostActive = false;
let rivalNearLatched = false;
let lotOpen = false;
let installed = false;
const cueTimes = new Map();

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
  const nearestRivalDistance = Number(frame.nearestRivalDistance);
  const audioNow = context.currentTime;

  // Boost lifts the existing engine slightly instead of replacing it with a loud effect bed.
  const boostEngineLift = boostActive ? 1.055 : 1;
  const engineLevel = active
    ? 0.045 + speedRatio * 0.045 + throttle * 0.075
    : 0;
  const engineBaseHz = (52 + speedRatio * 96 + throttle * 24) * enginePitch * boostEngineLift;
  smooth(engineGain.gain, engineLevel, audioNow, 0.06);
  smooth(engineLow.frequency, engineBaseHz, audioNow, 0.045);
  smooth(engineHigh.frequency, engineBaseHz * 2.02, audioNow, 0.045);
  smooth(
    engineFilter.frequency,
    (420 + speedRatio * 1450 + throttle * 420) * (0.82 + enginePitch * 0.18),
    audioNow,
    0.06
  );

  // Drift is split into roles: a quiet friction bed, low-mid body grit, and a bright chopped
  // squeal. Strong slip ducks the continuous bed so the tires read as grip/slip pulses, not spray.
  const slipIntent = clamp((driftAmount - 0.14) / 0.86, 0, 1);
  const strongSlip = clamp((driftAmount - 0.32) / 0.68, 0, 1);
  const driftSpeed = clamp((speed - 10) / 42, 0, 1);
  const regularScrubLevel = active ? slipIntent * driftSpeed * 0.0032 : 0;
  const deliberateScrubLevel = active && driftHeld
    ? driftSpeed * (0.006 + slipIntent * 0.011)
    : 0;
  const driftBedDuck = driftHeld ? 1 - strongSlip * 0.42 : 1;
  const gritLevel = active && driftHeld
    ? driftSpeed * (0.007 + slipIntent * 0.018)
    : regularScrubLevel * 0.32;
  const skidLevel = active && driftHeld
    ? driftSpeed * strongSlip * (0.012 + strongSlip * 0.008)
    : 0;

  smooth(driftGain.gain, (regularScrubLevel + deliberateScrubLevel) * driftBedDuck, audioNow, 0.075);
  smooth(driftFilter.frequency, 680 + speedRatio * 620 + slipIntent * 180, audioNow, 0.085);
  smooth(gritGain.gain, gritLevel, audioNow, 0.09);
  smooth(gritFilter.frequency, 300 + speedRatio * 330 + slipIntent * 180, audioNow, 0.1);
  smooth(skidGain.gain, skidLevel, audioNow, 0.055);
  smooth(skidTone.frequency, 2600 + speedRatio * 1800 + strongSlip * 900, audioNow, 0.045);
  smooth(skidFilter.frequency, 3300 + speedRatio * 2100 + strongSlip * 900, audioNow, 0.06);
  smooth(skidPulse.playbackRate, 0.8 + speedRatio * 0.35 + strongSlip * 0.55, audioNow, 0.08);
  smooth(skidWobbleDepth.gain, 10 + strongSlip * 22, audioNow, 0.09);

  // BOOST is a one-shot blast. The only continuous cue is the small engine pitch lift above.
  if (boostActive && !lastBoostActive) playCueNow('boost-start');
  lastBoostActive = boostActive;

  updateRivalProximity(active, nearestRivalDistance);
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
  hardMute(gritGain.gain, now);
  hardMute(skidGain.gain, now);
  lastBoostActive = false;
  rivalNearLatched = false;
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
  driftFilter.Q.value = 0.62;

  gritGain = context.createGain();
  gritGain.gain.value = 0;
  gritFilter = context.createBiquadFilter();
  gritFilter.type = 'bandpass';
  gritFilter.frequency.value = 420;
  gritFilter.Q.value = 0.62;

  skidGain = context.createGain();
  skidGain.gain.value = 0;
  skidFilter = context.createBiquadFilter();
  skidFilter.type = 'bandpass';
  skidFilter.frequency.value = 4200;
  skidFilter.Q.value = 1.8;

  skidChopGain = context.createGain();
  skidChopGain.gain.value = 0.035;

  const driftNoise = context.createBufferSource();
  driftNoise.buffer = makeNoiseBuffer(context, 1.6, 0.92);
  driftNoise.loop = true;
  driftNoise.connect(driftFilter);
  driftFilter.connect(driftGain);
  driftGain.connect(masterGain);

  const gritNoise = context.createBufferSource();
  gritNoise.buffer = makeNoiseBuffer(context, 1.7, 0.95);
  gritNoise.loop = true;
  gritNoise.connect(gritFilter);
  gritFilter.connect(gritGain);
  gritGain.connect(masterGain);

  skidTone = context.createOscillator();
  skidTone.type = 'triangle';
  skidTone.frequency.value = 3400;
  skidTone.connect(skidFilter);
  skidFilter.connect(skidChopGain);
  skidChopGain.connect(skidGain);
  skidGain.connect(masterGain);

  // A deterministic unipolar control buffer creates uneven, click-safe grip/slip pulses.
  // Playback rate follows speed and slip, so a hard fast drift chatters faster than a lazy slide.
  skidPulse = context.createBufferSource();
  skidPulse.buffer = makeSkidPulseBuffer(context, 1.25);
  skidPulse.loop = true;
  skidPulse.playbackRate.value = 1;
  skidPulseDepth = context.createGain();
  skidPulseDepth.gain.value = 0.965;
  skidPulse.connect(skidPulseDepth);
  skidPulseDepth.connect(skidChopGain.gain);

  // A few cents of independent pitch movement stops the high note becoming a static synth whistle.
  skidWobble = context.createOscillator();
  skidWobble.type = 'sine';
  skidWobble.frequency.value = 8.3;
  skidWobbleDepth = context.createGain();
  skidWobbleDepth.gain.value = 10;
  skidWobble.connect(skidWobbleDepth);
  skidWobbleDepth.connect(skidTone.detune);

  driftNoise.start();
  gritNoise.start();
  skidTone.start();
  skidPulse.start();
  skidWobble.start();
}

function installBoostGraph() {
  // Keep a dedicated bus for the boost transient, but no continuous oscillator/noise bed.
  boostGain = context.createGain();
  boostGain.gain.value = 1;
  boostGain.connect(masterGain);
}

function updateRivalProximity(active, distance) {
  if (!active || !Number.isFinite(distance)) {
    rivalNearLatched = false;
    return;
  }

  if (!rivalNearLatched && distance <= RIVAL_NEAR_ENTER_METERS) {
    rivalNearLatched = true;
    playCueNow('car-near', {
      intensity: clamp(1 - distance / RIVAL_NEAR_ENTER_METERS, 0.25, 1)
    });
    return;
  }

  if (rivalNearLatched && distance >= RIVAL_NEAR_EXIT_METERS) rivalNearLatched = false;
}

function playCueNow(name, options = {}) {
  if (!context || context.state !== 'running') return;
  const now = context.currentTime;
  if (!cueAllowed(name, now)) return;

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
      playNoiseBurst(now, 0.07, 0.022, 320 * pitch, 920 * pitch, 0.84);
      break;
    }
    case 'paint-select':
      playTone(560, 760, 0.065, 0.032, 'triangle', now);
      break;
    case 'boost-start':
      playBoostBlast(now);
      break;
    case 'boost-empty':
      playTone(860, 230, 0.2, 0.034, 'sine', now);
      playNoiseBurst(now + 0.025, 0.15, 0.035, 1300, 340, 0.91);
      playTone(105, 62, 0.09, 0.04, 'triangle', now + 0.045);
      break;
    case 'boost-full':
      playTone(470, 760, 0.08, 0.028, 'triangle', now);
      playTone(760, 1120, 0.1, 0.021, 'sine', now + 0.07);
      playNoiseBurst(now + 0.045, 0.07, 0.012, 900, 2100, 0.88);
      break;
    case 'overtake': {
      const places = clamp(Number(options.places) || 1, 1, 4);
      const lift = 1 + (places - 1) * 0.06;
      playTone(240 * lift, 590 * lift, 0.16, 0.038, 'triangle', now);
      playNoiseBurst(now + 0.025, 0.18, 0.028, 420, 1900, 0.88);
      break;
    }
    case 'car-near': {
      const intensity = clamp(Number(options.intensity) || 0.5, 0.25, 1);
      playTone(150, 360 + intensity * 140, 0.14, 0.014 + intensity * 0.012, 'triangle', now);
      playNoiseBurst(now, 0.16, 0.012 + intensity * 0.012, 300, 1200, 0.9);
      break;
    }
    case 'ui-tap':
    default:
      playTone(330, 420, 0.055, 0.038, 'triangle', now);
      break;
  }
}

function cueAllowed(name, now) {
  const cooldown = name === 'car-near'
    ? 1.2
    : name === 'overtake'
      ? 0.45
      : 0;
  if (!cooldown) return true;

  const previous = cueTimes.get(name) ?? -Infinity;
  if (now - previous < cooldown) return false;
  cueTimes.set(name, now);
  return true;
}

function playBoostBlast(startAt) {
  const duration = 0.105;
  const endAt = startAt + duration;
  const source = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const gain = context.createGain();

  source.buffer = makeNoiseBuffer(context, 0.14, 0.42);

  highpass.type = 'highpass';
  highpass.frequency.value = 180;
  highpass.Q.value = 0.55;

  lowpass.type = 'lowpass';
  lowpass.Q.value = 0.78;
  lowpass.frequency.setValueAtTime(9600, startAt);
  lowpass.frequency.exponentialRampToValueAtTime(1700, endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.046, startAt + 0.0025);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(gain);
  gain.connect(boostGain);

  source.start(startAt);
  source.stop(endAt + 0.015);

  // Three tiny components read as one compact pressure hit rather than a turbine spool.
  playTone(145, 68, 0.075, 0.034, 'triangle', startAt, boostGain);
  playTone(920, 280, 0.055, 0.021, 'triangle', startAt, boostGain);
  playTone(2800, 1350, 0.06, 0.01, 'sine', startAt + 0.002, boostGain);
}

function playTone(startHz, endHz, duration, level, type, startAt, destination = masterGain) {
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
  gain.connect(destination);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
}

function playNoiseBurst(startAt, duration, level, lowHz, highHz, smoothing = 0.78) {
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const endAt = startAt + duration;

  source.buffer = makeNoiseBuffer(context, Math.max(0.2, duration), smoothing);
  filter.type = 'bandpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(Math.max(1, lowHz), startAt);
  filter.frequency.exponentialRampToValueAtTime(Math.max(1, highHz), endAt);

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

function makeSkidPulseBuffer(audioContext, seconds = 1.25) {
  const frameCount = Math.max(1, Math.ceil(audioContext.sampleRate * seconds));
  const buffer = audioContext.createBuffer(1, frameCount, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  const pattern = [0.052, 0.032, 0.071, 0.025, 0.044, 0.04, 0.064, 0.028, 0.057, 0.035, 0.078, 0.03];
  let sampleIndex = 0;
  let segmentIndex = 0;
  let pulseOn = true;

  while (sampleIndex < frameCount) {
    const segmentSeconds = pattern[segmentIndex % pattern.length];
    const segmentSamples = Math.max(1, Math.round(segmentSeconds * audioContext.sampleRate));
    const pulseIndex = Math.floor(segmentIndex / 2);
    const pulsePeak = 0.74 + ((pulseIndex * 37) % 22) / 100;

    for (let localIndex = 0; localIndex < segmentSamples && sampleIndex < frameCount; localIndex += 1, sampleIndex += 1) {
      if (!pulseOn) {
        data[sampleIndex] = 0;
        continue;
      }

      const phase = localIndex / Math.max(1, segmentSamples - 1);
      const edge = clamp(Math.min(phase / 0.16, (1 - phase) / 0.24), 0, 1);
      const easedEdge = Math.sin(edge * Math.PI * 0.5) ** 2;
      data[sampleIndex] = pulsePeak * easedEdge;
    }

    pulseOn = !pulseOn;
    segmentIndex += 1;
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
