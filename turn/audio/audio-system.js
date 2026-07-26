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
let driftPanner = null;
let boostGain = null;
let boostFilter = null;
let boostTone = null;
let roadGain = null;
let roadFilter = null;
let roadPanner = null;
let lastUpdateAt = -Infinity;
let lastBoostActive = false;
let rivalNearLatched = false;
let lastTurnCueAt = -Infinity;
let lastRecoveryCueAt = -Infinity;
let wrongWayStartedAt = null;
let lastWrongWayCueAt = -Infinity;
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
  const nearestRivalPan = clamp(Number(frame.nearestRivalPan) || 0, -1, 1);
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

  // Drift should read as traction loss rather than broadband spray. Normal slip is nearly
  // subliminal; deliberate DRIFT crossfades in tire scrub, low-mid body grit and a small squeal.
  const slipIntent = clamp((driftAmount - 0.14) / 0.86, 0, 1);
  const strongSlip = clamp((driftAmount - 0.32) / 0.68, 0, 1);
  const driftSpeed = clamp((speed - 10) / 42, 0, 1);
  const regularScrubLevel = active ? slipIntent * driftSpeed * 0.0055 : 0;
  const deliberateScrubLevel = active && driftHeld
    ? driftSpeed * (0.014 + slipIntent * 0.024)
    : 0;
  const gritLevel = active && driftHeld
    ? driftSpeed * (0.007 + slipIntent * 0.021)
    : regularScrubLevel * 0.32;
  const skidLevel = active && driftHeld
    ? driftSpeed * strongSlip * 0.012
    : 0;

  smooth(driftGain.gain, regularScrubLevel + deliberateScrubLevel, audioNow, 0.075);
  smooth(driftFilter.frequency, 820 + speedRatio * 980 + slipIntent * 260, audioNow, 0.085);
  smooth(gritGain.gain, gritLevel, audioNow, 0.09);
  smooth(gritFilter.frequency, 300 + speedRatio * 330 + slipIntent * 180, audioNow, 0.1);
  smooth(skidGain.gain, skidLevel, audioNow, 0.08);
  smooth(skidTone.frequency, 720 + speedRatio * 520 + strongSlip * 190, audioNow, 0.07);
  smooth(skidFilter.frequency, 980 + speedRatio * 520, audioNow, 0.09);
  smoothPan(driftPanner, clamp(Number(frame.driftPan) || 0, -1, 1), audioNow, 0.07);

  // Road-edge sound is physical rather than a special accessibility alert. It emerges on the
  // side nearest the edge and becomes rougher off road, so every player hears usable road position.
  const edgeProximity = clamp(Number(frame.edgeProximity) || 0, 0, 1);
  const recoveryUrgency = clamp(Number(frame.recoveryUrgency) || 0, 0, 1);
  const offRoad = active && Boolean(frame.offRoad);
  const edgeRumbleLevel = active ? Math.pow(edgeProximity, 1.65) * 0.018 : 0;
  const offRoadLevel = offRoad ? 0.026 + recoveryUrgency * 0.026 : 0;
  smooth(roadGain.gain, Math.max(edgeRumbleLevel, offRoadLevel), audioNow, offRoad ? 0.045 : 0.09);
  smooth(
    roadFilter.frequency,
    offRoad ? 300 + recoveryUrgency * 620 : 180 + edgeProximity * 720,
    audioNow,
    0.08
  );
  smoothPan(roadPanner, clamp(Number(frame.edgePan) || 0, -1, 1), audioNow, 0.065);

  // The boost sustain is intentionally quiet. Most of the character lives in the start cue.
  const boostLevel = boostActive ? 0.024 : 0;
  smooth(boostGain.gain, boostLevel, audioNow, boostActive ? 0.055 : 0.12);
  smooth(boostFilter.frequency, 1150 + speedRatio * 1450, audioNow, 0.07);
  smooth(boostTone.frequency, 430 + speedRatio * 430, audioNow, 0.06);

  if (boostActive && !lastBoostActive) playCueNow('boost-start');
  lastBoostActive = boostActive;

  updateRivalProximity(active, nearestRivalDistance, nearestRivalPan);
  updateDrivingGuidance(frame, { active, speed, offRoad, now: audioNow });
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
  hardMute(boostGain.gain, now);
  hardMute(roadGain.gain, now);
  lastBoostActive = false;
  rivalNearLatched = false;
  resetGuidanceState();
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
  installRoadGuidanceGraph();
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
  driftFilter.frequency.value = 980;
  driftFilter.Q.value = 0.72;

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
  skidFilter.frequency.value = 1150;
  skidFilter.Q.value = 1.35;

  driftPanner = createPannerNode();

  const driftNoise = context.createBufferSource();
  driftNoise.buffer = makeNoiseBuffer(context, 1.6, 0.86);
  driftNoise.loop = true;
  driftNoise.connect(driftFilter);
  driftFilter.connect(driftGain);
  driftGain.connect(driftPanner);

  const gritNoise = context.createBufferSource();
  gritNoise.buffer = makeNoiseBuffer(context, 1.7, 0.95);
  gritNoise.loop = true;
  gritNoise.connect(gritFilter);
  gritFilter.connect(gritGain);
  gritGain.connect(driftPanner);

  skidTone = context.createOscillator();
  skidTone.type = 'triangle';
  skidTone.frequency.value = 820;
  skidTone.connect(skidFilter);
  skidFilter.connect(skidGain);
  skidGain.connect(driftPanner);

  driftPanner.connect(masterGain);
  driftNoise.start();
  gritNoise.start();
  skidTone.start();
}

function installBoostGraph() {
  boostGain = context.createGain();
  boostGain.gain.value = 0;

  boostFilter = context.createBiquadFilter();
  boostFilter.type = 'bandpass';
  boostFilter.frequency.value = 1500;
  boostFilter.Q.value = 1.2;

  const boostNoiseMix = context.createGain();
  boostNoiseMix.gain.value = 0.12;
  const boostToneMix = context.createGain();
  boostToneMix.gain.value = 0.58;

  const boostNoise = context.createBufferSource();
  boostNoise.buffer = makeNoiseBuffer(context, 1.3, 0.91);
  boostNoise.loop = true;
  boostNoise.connect(boostNoiseMix);

  boostTone = context.createOscillator();
  boostTone.type = 'sine';
  boostTone.frequency.value = 430;
  boostTone.connect(boostToneMix);

  boostNoiseMix.connect(boostFilter);
  boostToneMix.connect(boostFilter);
  boostFilter.connect(boostGain);
  boostGain.connect(masterGain);

  boostNoise.start();
  boostTone.start();
}

function installRoadGuidanceGraph() {
  roadGain = context.createGain();
  roadGain.gain.value = 0;

  roadFilter = context.createBiquadFilter();
  roadFilter.type = 'bandpass';
  roadFilter.frequency.value = 220;
  roadFilter.Q.value = 0.72;

  roadPanner = createPannerNode();

  const roadNoise = context.createBufferSource();
  roadNoise.buffer = makeNoiseBuffer(context, 1.9, 0.92);
  roadNoise.loop = true;
  roadNoise.connect(roadFilter);
  roadFilter.connect(roadGain);
  roadGain.connect(roadPanner);
  roadPanner.connect(masterGain);
  roadNoise.start();
}

function updateRivalProximity(active, distance, pan = 0) {
  if (!active || !Number.isFinite(distance)) {
    rivalNearLatched = false;
    return;
  }

  if (!rivalNearLatched && distance <= RIVAL_NEAR_ENTER_METERS) {
    rivalNearLatched = true;
    playCueNow('car-near', {
      intensity: clamp(1 - distance / RIVAL_NEAR_ENTER_METERS, 0.25, 1),
      pan
    });
    return;
  }

  if (rivalNearLatched && distance >= RIVAL_NEAR_EXIT_METERS) rivalNearLatched = false;
}

function updateDrivingGuidance(frame, { active, speed, offRoad, now }) {
  if (!active) {
    resetGuidanceState();
    return;
  }

  const wrongWay = Boolean(frame.wrongWay);
  if (wrongWay) {
    if (wrongWayStartedAt === null) wrongWayStartedAt = now;
    if (
      now - wrongWayStartedAt >= 0.72
      && now - lastWrongWayCueAt >= 1.9
    ) {
      playWrongWayCue(clamp(Number(frame.headingCorrectionPan) || 0, -1, 1), now);
      lastWrongWayCueAt = now;
    }
  } else {
    wrongWayStartedAt = null;
    lastWrongWayCueAt = -Infinity;
  }

  if (offRoad) {
    const urgency = clamp(Number(frame.recoveryUrgency) || 0, 0, 1);
    const interval = 1.05 - urgency * 0.52;
    if (speed > 1.5 && now - lastRecoveryCueAt >= interval) {
      playRecoveryCue(clamp(Number(frame.recoveryPan) || 0, -1, 1), urgency, now);
      lastRecoveryCueAt = now;
    }
    return;
  }

  lastRecoveryCueAt = -Infinity;
  if (wrongWay || speed < 7) return;

  const direction = Math.sign(Number(frame.turnDirection) || 0);
  const severity = clamp(Number(frame.turnSeverity) || 0, 0, 1);
  const proximity = clamp(Number(frame.turnProximity) || 0, 0, 1);
  if (!direction || severity < 0.11) return;

  const interval = clamp(1.42 - proximity * 0.58 - severity * 0.34, 0.46, 1.35);
  if (now - lastTurnCueAt < interval) return;

  playTurnCue(direction, severity, proximity, now);
  lastTurnCueAt = now;
}

function playTurnCue(direction, severity, proximity, now) {
  // Direction is deliberately encoded only by side: left curve in the left ear, right curve in
  // the right ear. A bright overtone keeps the cue readable over deliberate tyre scrub.
  const panMagnitude = 0.88 + proximity * 0.12;
  const pan = direction < 0 ? -panMagnitude : panMagnitude;
  const level = 0.024 + severity * 0.022;
  const start = 1040 + severity * 140;
  const end = 1280 + severity * 180;
  playTone(start, end, 0.115, level, 'sine', now, pan);
  playTone(start * 1.72, end * 1.72, 0.09, level * 0.34, 'sine', now + 0.008, pan);
  if (severity > 0.5) {
    playTone(start * 0.96, end * 0.96, 0.095, level * 0.8, 'triangle', now + 0.12, pan);
  }
}

function playRecoveryCue(pan, urgency, now) {
  const level = 0.017 + urgency * 0.016;
  playTone(210 + urgency * 40, 330 + urgency * 120, 0.11, level, 'triangle', now, pan);
  playTone(250 + urgency * 60, 390 + urgency * 150, 0.1, level * 0.82, 'triangle', now + 0.115, pan);
}

function playWrongWayCue(correctionPan, now) {
  playTone(310, 170, 0.16, 0.028, 'square', now, 0);
  playTone(280, 145, 0.16, 0.025, 'square', now + 0.19, 0);
  if (Math.abs(correctionPan) > 0.08) {
    playTone(360, 520, 0.11, 0.018, 'triangle', now + 0.39, correctionPan);
  }
}

function resetGuidanceState() {
  lastTurnCueAt = -Infinity;
  lastRecoveryCueAt = -Infinity;
  wrongWayStartedAt = null;
  lastWrongWayCueAt = -Infinity;
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
      // Spool, pressure punch, then a short whoosh. The quiet sustain takes over underneath.
      playTone(260, 980, 0.18, 0.038, 'sine', now);
      playTone(86, 54, 0.085, 0.05, 'triangle', now + 0.015);
      playNoiseBurst(now + 0.025, 0.23, 0.045, 520, 3200, 0.84);
      playTone(620, 1080, 0.19, 0.018, 'triangle', now + 0.035);
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
      const pan = clamp(Number(options.pan) || 0, -1, 1);
      playTone(
        150,
        360 + intensity * 140,
        0.14,
        0.014 + intensity * 0.012,
        'triangle',
        now,
        pan
      );
      playNoiseBurst(
        now,
        0.16,
        0.012 + intensity * 0.012,
        300,
        1200,
        0.9,
        pan
      );
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

function playTone(startHz, endHz, duration, level, type, startAt, pan = 0) {
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
  connectPanned(gain, pan);
  oscillator.start(startAt);
  oscillator.stop(endAt + 0.02);
}

function playNoiseBurst(
  startAt,
  duration,
  level,
  lowHz,
  highHz,
  smoothing = 0.78,
  pan = 0
) {
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
  connectPanned(gain, pan);
  source.start(startAt);
  source.stop(endAt + 0.02);
}

function connectPanned(node, pan) {
  const panner = createPannerNode();
  if (panner.pan) panner.pan.value = clamp(Number(pan) || 0, -1, 1);
  node.connect(panner);
  panner.connect(masterGain);
}

function createPannerNode() {
  return typeof context.createStereoPanner === 'function'
    ? context.createStereoPanner()
    : context.createGain();
}

function smoothPan(node, value, time, timeConstant) {
  if (node?.pan) smooth(node.pan, value, time, timeConstant);
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
  if (button.matches('.lot-back, .lot-view-close, .nuke-cancel, .sound-guide-close')) {
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
