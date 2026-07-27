const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;

const AUDIO_UPDATE_INTERVAL_MS = 1000 / 30;
const MASTER_GAIN = 0.72;
const RIVAL_NEAR_ENTER_METERS = 10;
const RIVAL_NEAR_EXIT_METERS = 15;
const PACE_NOTE_LEVEL = 0.052;
const PACE_NOTE_DURATION_SECONDS = 0.055;
const PACE_NOTE_STEP_SECONDS = 0.105;
const PACE_NOTE_GROUP_GAP_SECONDS = 0.22;
const DRIVE_BY_EAR_ENABLED = globalThis.__turnDriveByEarEnabled !== false;

let context = null;
let masterGain = null;
let dynamicsBus = null;
let guidanceBus = null;
let routeBus = null;
let worldBus = null;
let safetyBus = null;

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
let driftMix = null;
let driftCenterGain = null;
let driftLeftGain = null;
let driftRightGain = null;

let boostGain = null;
let boostFilter = null;
let boostTone = null;

let sliderGain = null;
let sliderFilter = null;
let sliderPanner = null;
let sliderTone = null;
let sliderHarmonic = null;
let sliderToneMix = null;
let sliderHarmonicMix = null;

let surfaceGain = null;
let surfaceFilter = null;
let surfacePulse = null;
let surfacePulseDepth = null;

let lastUpdateAt = -Infinity;
let lastBoostActive = false;
let rivalNearLatched = false;
let wrongWayStartedAt = null;
let lastWrongWayCueAt = -Infinity;
let routeDuckUntil = -Infinity;
let safetyMode = 'none';
let offRoadLatched = false;
let lotOpen = false;
let installed = false;
const cueTimes = new Map();
const activePaceNoteSources = new Set();

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
  if (DRIVE_BY_EAR_ENABLED) {
    window.addEventListener('turn:pace-note', handlePaceNoteAudio);
    window.addEventListener('turn:pace-note-silence', stopPaceNoteSources);
  }

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
  const nearestRivalPan = DRIVE_BY_EAR_ENABLED
    ? clamp(Number(frame.nearestRivalPan) || 0, -1, 1)
    : 0;
  const audioNow = context.currentTime;

  const offRoad = DRIVE_BY_EAR_ENABLED && active && Boolean(frame.offRoad);
  const wrongWay = DRIVE_BY_EAR_ENABLED && active && Boolean(frame.wrongWay);
  const nextSafetyMode = wrongWay ? 'wrong-way' : 'none';
  if (nextSafetyMode !== safetyMode) {
    safetyMode = nextSafetyMode;
    if (safetyMode !== 'none') stopPaceNoteSources();
  }
  if (offRoad && !offRoadLatched) stopPaceNoteSources();
  offRoadLatched = offRoad;

  const sliderPresence = DRIVE_BY_EAR_ENABLED
    ? clamp(Number(frame.sliderPresence) || 0, 0, 1)
    : 0;
  const sliderRisk = DRIVE_BY_EAR_ENABLED
    ? clamp(Number(frame.sliderRisk) || 0, 0, 1)
    : 0;
  const sliderMode = frame.sliderMode === 'recovery' ? 'recovery' : 'road';
  const sliderActive = active && !wrongWay && sliderPresence > 0.01;
  const routeActive = audioNow < routeDuckUntil && !offRoad && !wrongWay;

  const sliderDuck = sliderActive ? 0.82 - sliderRisk * 0.22 : 1;
  const routeDuck = routeActive ? 0.7 : 1;
  const safetyDuck = wrongWay ? 0.36 : 1;
  smooth(dynamicsBus.gain, Math.min(sliderDuck, routeDuck, safetyDuck), audioNow, 0.06);
  smooth(guidanceBus.gain, wrongWay ? 0 : 1, audioNow, 0.045);
  smooth(routeBus.gain, offRoad || wrongWay ? 0 : 1, audioNow, 0.03);
  smooth(worldBus.gain, wrongWay ? 0.42 : (offRoad ? 0.62 : 1), audioNow, 0.06);
  smooth(safetyBus.gain, wrongWay ? 1 : 0, audioNow, 0.025);

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

  // DRIFT describes loss of grip without issuing a second left/right instruction.
  // More slip widens the centred tyre image rather than moving it to one ear.
  const driftWidth = driftHeld
    ? 0.32 + strongSlip * 0.68
    : slipIntent * 0.18;
  smooth(driftCenterGain.gain, 1 - driftWidth * 0.68, audioNow, 0.07);
  smooth(driftLeftGain.gain, driftWidth * 0.34, audioNow, 0.07);
  smooth(driftRightGain.gain, driftWidth * 0.34, audioNow, 0.07);

  const boostLevel = boostActive ? 0.024 : 0;
  smooth(boostGain.gain, boostLevel, audioNow, boostActive ? 0.055 : 0.12);
  smooth(boostFilter.frequency, 1150 + speedRatio * 1450, audioNow, 0.07);
  smooth(boostTone.frequency, 430 + speedRatio * 430, audioNow, 0.06);

  if (DRIVE_BY_EAR_ENABLED) {
    const recoveryRibbon = sliderMode === 'recovery';
    const sliderLevel = sliderActive
      ? sliderPresence * (0.016 + sliderRisk * 0.023 + (recoveryRibbon ? 0.006 : 0))
      : 0;
    const sliderFundamental = recoveryRibbon
      ? 326 + sliderRisk * 52
      : 388 + sliderRisk * 72;
    smooth(sliderGain.gain, sliderLevel, audioNow, 0.095);
    smooth(sliderTone.frequency, sliderFundamental, audioNow, 0.12);
    smooth(sliderHarmonic.frequency, sliderFundamental * 1.5, audioNow, 0.12);
    smooth(sliderToneMix.gain, recoveryRibbon ? 0.72 : 0.78, audioNow, 0.12);
    smooth(sliderHarmonicMix.gain, recoveryRibbon ? 0.23 : 0.14 + sliderRisk * 0.035, audioNow, 0.12);
    smooth(sliderFilter.frequency, recoveryRibbon ? 880 + sliderRisk * 160 : 980 + sliderRisk * 250, audioNow, 0.12);
    smoothPan(sliderPanner, clamp(Number(frame.sliderPan) || 0, -1, 1), audioNow, 0.075);

    const surfaceAmount = clamp(Number(frame.surfaceAmount) || 0, 0, 1);
    const surfaceActive = active && offRoad && surfaceAmount > 0.01;
    const surfaceLevel = surfaceActive
      ? 0.011 + surfaceAmount * 0.017 + speedRatio * 0.006
      : 0;
    smooth(surfaceGain.gain, surfaceLevel, audioNow, surfaceActive ? 0.055 : 0.11);
    smooth(surfaceFilter.frequency, 260 + speedRatio * 190 + surfaceAmount * 110, audioNow, 0.09);
    smooth(surfacePulse.frequency, 4.2 + speedRatio * 7.2, audioNow, 0.12);
    smooth(surfacePulseDepth.gain, surfaceActive ? 0.002 + surfaceAmount * 0.004 : 0, audioNow, 0.09);
  }

  if (boostActive && !lastBoostActive && safetyMode === 'none') playCueNow('boost-start');
  lastBoostActive = boostActive;

  updateRivalProximity(active && !offRoad && !wrongWay, nearestRivalDistance, nearestRivalPan);
  if (DRIVE_BY_EAR_ENABLED) updateDrivingSafety(frame, { active, wrongWay, now: audioNow });
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
  if (sliderGain) hardMute(sliderGain.gain, now);
  if (surfaceGain) hardMute(surfaceGain.gain, now);
  if (DRIVE_BY_EAR_ENABLED) stopPaceNoteSources();
  lastBoostActive = false;
  rivalNearLatched = false;
  resetSafetyState();
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

  dynamicsBus = makeBus(1);
  guidanceBus = makeBus(1);
  routeBus = makeBus(1);
  worldBus = makeBus(1);
  safetyBus = makeBus(0);

  installEngineGraph();
  installDriftGraph();
  installBoostGraph();
  if (DRIVE_BY_EAR_ENABLED) installDbeGraphs();
}

function makeBus(initialValue) {
  const bus = context.createGain();
  bus.gain.value = initialValue;
  bus.connect(masterGain);
  return bus;
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
  engineGain.connect(dynamicsBus);

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

  driftMix = context.createGain();
  driftCenterGain = context.createGain();
  driftLeftGain = context.createGain();
  driftRightGain = context.createGain();
  const leftPanner = createPannerNode();
  const rightPanner = createPannerNode();
  if (leftPanner.pan) leftPanner.pan.value = -0.72;
  if (rightPanner.pan) rightPanner.pan.value = 0.72;

  const driftNoise = context.createBufferSource();
  driftNoise.buffer = makeNoiseBuffer(context, 1.6, 0.86);
  driftNoise.loop = true;
  driftNoise.connect(driftFilter);
  driftFilter.connect(driftGain);
  driftGain.connect(driftMix);

  const gritNoise = context.createBufferSource();
  gritNoise.buffer = makeNoiseBuffer(context, 1.7, 0.95);
  gritNoise.loop = true;
  gritNoise.connect(gritFilter);
  gritFilter.connect(gritGain);
  gritGain.connect(driftMix);

  skidTone = context.createOscillator();
  skidTone.type = 'triangle';
  skidTone.frequency.value = 820;
  skidTone.connect(skidFilter);
  skidFilter.connect(skidGain);
  skidGain.connect(driftMix);

  driftMix.connect(driftCenterGain);
  driftMix.connect(driftLeftGain);
  driftMix.connect(driftRightGain);
  driftCenterGain.connect(dynamicsBus);
  driftLeftGain.connect(leftPanner);
  driftRightGain.connect(rightPanner);
  leftPanner.connect(dynamicsBus);
  rightPanner.connect(dynamicsBus);

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
  boostGain.connect(dynamicsBus);

  boostNoise.start();
  boostTone.start();
}

function installDbeGraphs() {
  sliderGain = context.createGain();
  sliderGain.gain.value = 0;
  sliderFilter = context.createBiquadFilter();
  sliderFilter.type = 'lowpass';
  sliderFilter.frequency.value = 1050;
  sliderFilter.Q.value = 0.42;
  sliderPanner = createPannerNode();
  sliderToneMix = context.createGain();
  sliderToneMix.gain.value = 0.78;
  sliderHarmonicMix = context.createGain();
  sliderHarmonicMix.gain.value = 0.14;

  // A soft tonal pair replaces the former continuous noise hiss.
  // The fifth keeps the cue easy to localise without pushing energy into a sharp band.
  sliderTone = context.createOscillator();
  sliderTone.type = 'sine';
  sliderTone.frequency.value = 390;
  sliderTone.connect(sliderToneMix);

  sliderHarmonic = context.createOscillator();
  sliderHarmonic.type = 'triangle';
  sliderHarmonic.frequency.value = 585;
  sliderHarmonic.connect(sliderHarmonicMix);

  sliderToneMix.connect(sliderFilter);
  sliderHarmonicMix.connect(sliderFilter);
  sliderFilter.connect(sliderGain);
  sliderGain.connect(sliderPanner);
  sliderPanner.connect(guidanceBus);
  sliderTone.start();
  sliderHarmonic.start();

  // Off-road surface is deliberately centred. It describes gravel and bumps,
  // while the panned ribbon remains the only steering instruction.
  surfaceGain = context.createGain();
  surfaceGain.gain.value = 0;
  surfaceFilter = context.createBiquadFilter();
  surfaceFilter.type = 'bandpass';
  surfaceFilter.frequency.value = 320;
  surfaceFilter.Q.value = 0.55;

  const surfaceNoise = context.createBufferSource();
  surfaceNoise.buffer = makeNoiseBuffer(context, 2.4, 0.95);
  surfaceNoise.loop = true;
  surfaceNoise.connect(surfaceFilter);
  surfaceFilter.connect(surfaceGain);
  surfaceGain.connect(guidanceBus);

  surfacePulse = context.createOscillator();
  surfacePulse.type = 'sine';
  surfacePulse.frequency.value = 5;
  surfacePulseDepth = context.createGain();
  surfacePulseDepth.gain.value = 0;
  surfacePulse.connect(surfacePulseDepth);
  surfacePulseDepth.connect(surfaceGain.gain);

  surfaceNoise.start();
  surfacePulse.start();
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

function updateDrivingSafety(frame, { active, wrongWay, now }) {
  if (!active) {
    resetSafetyState();
    return;
  }

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
}

function playWrongWayCue(correctionPan, now) {
  playTone(310, 170, 0.16, 0.028, 'square', now, 0, safetyBus);
  playTone(280, 145, 0.16, 0.025, 'square', now + 0.19, 0, safetyBus);
  if (Math.abs(correctionPan) > 0.08) {
    playTone(360, 520, 0.11, 0.018, 'triangle', now + 0.39, correctionPan, safetyBus);
  }
}

function resetSafetyState() {
  wrongWayStartedAt = null;
  lastWrongWayCueAt = -Infinity;
  safetyMode = 'none';
  offRoadLatched = false;
}

function handlePaceNoteAudio(event) {
  const groups = Array.isArray(event.detail?.groups) ? event.detail.groups : [];
  if (!groups.length || safetyMode !== 'none' || offRoadLatched) return;

  void unlock().then((ready) => {
    if (ready) schedulePaceNoteGroups(groups);
  });
}

function schedulePaceNoteGroups(groups) {
  if (!context || context.state !== 'running' || !routeBus || safetyMode !== 'none' || offRoadLatched) return;
  let cursor = context.currentTime + 0.012;

  groups.forEach((group, groupIndex) => {
    const direction = Math.sign(Number(group?.direction) || 0);
    const severity = clamp(Math.round(Number(group?.severity) || 1), 1, 3);
    const pan = direction < 0 ? -0.96 : 0.96;

    for (let index = 0; index < severity; index += 1) {
      schedulePaceNoteBeep(cursor, pan, severity);
      cursor += PACE_NOTE_STEP_SECONDS;
    }

    if (groupIndex < groups.length - 1) {
      cursor += PACE_NOTE_GROUP_GAP_SECONDS - PACE_NOTE_STEP_SECONDS;
    }
  });

  routeDuckUntil = Math.max(routeDuckUntil, cursor + 0.05);
}

function schedulePaceNoteBeep(startAt, pan, severity) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const panner = createPannerNode();
  const endAt = startAt + PACE_NOTE_DURATION_SECONDS;
  const baseFrequency = 650 + severity * 38;

  oscillator.type = 'triangle';
  oscillator.frequency.setValueAtTime(baseFrequency, startAt);
  oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.13, endAt);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(PACE_NOTE_LEVEL, startAt + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

  if (panner.pan) panner.pan.setValueAtTime(pan, startAt);
  oscillator.connect(gain);
  gain.connect(panner);
  panner.connect(routeBus);

  const record = { oscillator, gain, panner };
  activePaceNoteSources.add(record);
  oscillator.addEventListener('ended', () => {
    activePaceNoteSources.delete(record);
    oscillator.disconnect();
    gain.disconnect();
    panner.disconnect();
  }, { once: true });

  oscillator.start(startAt);
  oscillator.stop(endAt + 0.01);
}

function stopPaceNoteSources() {
  for (const record of activePaceNoteSources) {
    try {
      record.oscillator.stop();
    } catch (_) {}
  }
  activePaceNoteSources.clear();
  routeDuckUntil = -Infinity;
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
      playTone(260, 980, 0.18, 0.038, 'sine', now, 0, dynamicsBus);
      playTone(86, 54, 0.085, 0.05, 'triangle', now + 0.015, 0, dynamicsBus);
      playNoiseBurst(now + 0.025, 0.23, 0.045, 520, 3200, 0.84, 0, dynamicsBus);
      playTone(620, 1080, 0.19, 0.018, 'triangle', now + 0.035, 0, dynamicsBus);
      break;
    case 'boost-empty':
      playTone(860, 230, 0.2, 0.034, 'sine', now, 0, dynamicsBus);
      playNoiseBurst(now + 0.025, 0.15, 0.035, 1300, 340, 0.91, 0, dynamicsBus);
      playTone(105, 62, 0.09, 0.04, 'triangle', now + 0.045, 0, dynamicsBus);
      break;
    case 'boost-full':
      playTone(470, 760, 0.08, 0.028, 'triangle', now, 0, dynamicsBus);
      playTone(760, 1120, 0.1, 0.021, 'sine', now + 0.07, 0, dynamicsBus);
      playNoiseBurst(now + 0.045, 0.07, 0.012, 900, 2100, 0.88, 0, dynamicsBus);
      break;
    case 'overtake': {
      const places = clamp(Number(options.places) || 1, 1, 4);
      const lift = 1 + (places - 1) * 0.06;
      playTone(240 * lift, 590 * lift, 0.16, 0.038, 'triangle', now, 0, worldBus);
      playNoiseBurst(now + 0.025, 0.18, 0.028, 420, 1900, 0.88, 0, worldBus);
      break;
    }
    case 'car-near': {
      const intensity = clamp(Number(options.intensity) || 0.5, 0.25, 1);
      const pan = clamp(Number(options.pan) || 0, -1, 1);
      playTone(150, 360 + intensity * 140, 0.14, 0.014 + intensity * 0.012, 'triangle', now, pan, worldBus);
      playNoiseBurst(now, 0.16, 0.012 + intensity * 0.012, 300, 1200, 0.9, pan, worldBus);
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

function playTone(startHz, endHz, duration, level, type, startAt, pan = 0, output = masterGain) {
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
  connectPanned(gain, pan, output);
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
  pan = 0,
  output = masterGain
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
  connectPanned(gain, pan, output);
  source.start(startAt);
  source.stop(endAt + 0.02);
}

function connectPanned(node, pan, output = masterGain) {
  const panner = createPannerNode();
  if (panner.pan) panner.pan.value = clamp(Number(pan) || 0, -1, 1);
  node.connect(panner);
  panner.connect(output || masterGain);
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
