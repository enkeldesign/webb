const RECOVERY_UPDATE_INTERVAL_MS = 1000 / 30;
const DEFAULT_AUDIO_BALANCE = 0.5;

const CAPTURED_GRAPH = Object.seal({
  context: null,
  masterGain: null
});

let prepared = false;
let installed = false;
let wrappedAudio = null;
let lastComputedAt = -Infinity;
let cachedOverrides = Object.freeze({});
let wrongWayGain = null;
let wrongWayPanner = null;
let wrongWayRoot = null;
let wrongWayCompanion = null;
let wrongWayHarmonic = null;

export function prepareRecoveryGuidanceCapture() {
  if (prepared) return;
  prepared = true;

  const prototypes = [
    globalThis.AudioContext?.prototype,
    globalThis.webkitAudioContext?.prototype
  ].filter(Boolean);

  for (const prototype of [...new Set(prototypes)]) {
    const currentCreateGain = prototype?.createGain;
    if (typeof currentCreateGain !== 'function') continue;
    if (currentCreateGain.__turnRecoveryGuidancePatched) continue;

    function createCapturedGain(...args) {
      const node = currentCreateGain.apply(this, args);
      if (!CAPTURED_GRAPH.context) {
        CAPTURED_GRAPH.context = this;
        CAPTURED_GRAPH.masterGain = node;
      }
      return node;
    }

    createCapturedGain.__turnRecoveryGuidancePatched = true;
    replacePrototypeMethod(prototype, 'createGain', createCapturedGain);
  }
}

export function installRecoveryGuidance() {
  if (installed) return wrappedAudio || globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;

  prepareRecoveryGuidanceCapture();
  installed = true;

  wrappedAudio = Object.freeze({
    unlock: (...args) => baseAudio.unlock(...args),
    update(frame = {}, now = performance.now()) {
      const settings = globalThis.__turnAudioPreferences?.getSettings?.();
      const dbeEnabled = settings?.dbeEnabled !== false
        && globalThis.__turnDriveByEarEnabled !== false;

      if (!dbeEnabled) {
        cachedOverrides = Object.freeze({});
        updateWrongWayTone({ active: false }, settings);
        baseAudio.update(frame, now);
        return;
      }

      if (now - lastComputedAt >= RECOVERY_UPDATE_INTERVAL_MS) {
        cachedOverrides = Object.freeze(
          createRecoveryGuidanceFrame(globalThis.__turnRuntime, frame)
        );
        lastComputedAt = now;
      }

      const nextFrame = { ...frame, ...cachedOverrides };
      updateWrongWayTone(nextFrame, settings);
      baseAudio.update(nextFrame, now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence(...args) {
      updateWrongWayTone({ active: false }, globalThis.__turnAudioPreferences?.getSettings?.());
      return baseAudio.silence(...args);
    },
    get available() {
      return baseAudio.available;
    },
    get state() {
      return baseAudio.state;
    }
  });

  globalThis.__turnAudio = wrappedAudio;
  return wrappedAudio;
}

export function createRecoveryGuidanceFrame(runtime, frame = {}) {
  const state = runtime?.state;
  const samples = runtime?.samples;
  if (!state || !Array.isArray(samples) || samples.length < 2 || !state.position) return {};

  const index = normalizeIndex(state.nearestTrackIndex, samples.length);
  const sample = samples[index];
  if (!sample?.point || !sample?.tangent) return {};

  const forward = normalizedVector(runtime.getForward?.()) || forwardFromHeading(state.heading);
  const right = normalizedVector(runtime.getRight?.()) || rightFromHeading(state.heading);
  const speed = Math.max(0, finiteNumber(state.speed, horizontalLength(state.velocity)));
  const offRoad = Boolean(state.offRoad);
  const headingAlignment = clamp(dot(forward, sample.tangent), -1, 1);
  const wrongWay = !offRoad
    && headingAlignment < -0.42
    && speed > 7
    && finiteNumber(state.brake, 0) < 0.1;

  if (offRoad) {
    return createOffRoadRecoveryFrame({
      samples,
      startIndex: index,
      position: state.position,
      forward,
      right,
      currentSample: sample,
      trackDistance: finiteNumber(
        state.trackDistance,
        horizontalDistance(state.position, sample.point)
      ),
      roadHalfWidth: Math.max(1, finiteNumber(runtime.trackWidth, 27) * 0.5),
      speed
    });
  }

  if (wrongWay) {
    return createWrongWayRecoveryFrame({
      forward,
      right,
      currentSample: sample,
      frame
    });
  }

  return {};
}

function createOffRoadRecoveryFrame({
  samples,
  startIndex,
  position,
  forward,
  right,
  currentSample,
  trackDistance,
  roadHalfWidth,
  speed
}) {
  const outsideDistance = Math.max(0, trackDistance - roadHalfWidth);
  const outsideDepth = clamp(outsideDistance / Math.max(1, roadHalfWidth * 2), 0, 1);

  // First find the road again. Only blend in a modest racing-line lead as the car nears asphalt.
  const entryLookAhead = clamp(speed * 0.12, 0, 6);
  const flowLookAhead = clamp(10 + speed * 0.34, 10, 26);
  const entrySample = sampleAheadByDistance(samples, startIndex, entryLookAhead) || currentSample;
  const flowSample = sampleAheadByDistance(samples, startIndex, flowLookAhead) || entrySample;
  const flowWeight = 0.12 + (1 - outsideDepth) * 0.28;
  const targetPoint = blendPoints(entrySample.point, flowSample.point, flowWeight);
  const targetVector = subtract(targetPoint, position);
  const targetDirection = normalizedVector(targetVector);
  if (!targetDirection) return {};

  const lateral = clamp(dot(targetDirection, right), -1, 1);
  const forwardness = clamp(dot(targetDirection, forward), -1, 1);
  const turnAngle = signedAngle(forward, targetDirection);
  const turnSign = Math.sign(turnAngle) || Math.sign(lateral) || 1;
  const behindAmount = smoothstep(0.05, 0.82, -forwardness);
  const angleAmount = smoothstep(0.02, 0.42, Math.abs(turnAngle) / Math.PI);
  let panMagnitude = Math.max(
    Math.abs(lateral) * 1.18,
    behindAmount * 0.92,
    angleAmount * 0.88
  );
  if (Math.abs(turnAngle) > Math.PI * 0.03) panMagnitude = Math.max(panMagnitude, 0.34);
  const pan = clamp(turnSign * panMagnitude, -0.92, 0.92);

  // Gravel remains a centred surface cue, but it yields when the steering instruction is strong.
  const baseSurfaceAmount = 0.18 + outsideDepth * 0.28;
  const surfaceAmount = clamp(
    baseSurfaceAmount * (1 - Math.abs(pan) * 0.5),
    0.08,
    0.46
  );
  const risk = 0.88 + outsideDepth * 0.12;

  return {
    sliderMode: 'recovery',
    sliderPresence: 1,
    sliderRisk: risk,
    sliderPan: pan,
    sliderValue: clamp(turnAngle / Math.PI, -1, 1),
    surfaceAmount,
    recoveryHeadingError: Math.abs(turnAngle) / Math.PI,
    recoveryTargetDistance: horizontalLength(targetVector),
    predictedTrackOffset: 0,
    predictedTrackDistance: trackDistance,
    offRoad: true,
    wrongWay: false
  };
}

function createWrongWayRecoveryFrame({ forward, right, currentSample, frame }) {
  const headingError = signedAngle(forward, currentSample.tangent);
  const normalSide = currentSample.normal
    ? Math.sign(dot(currentSample.normal, right))
    : 0;
  const turnSign = Math.sign(headingError)
    || Math.sign(Number(frame.headingCorrectionPan))
    || normalSide
    || 1;
  const panMagnitude = clamp(
    Math.max(0.78, Math.abs(headingError) / (Math.PI * 0.72)),
    0.78,
    0.92
  );
  const pan = turnSign * panMagnitude;

  return {
    sliderMode: 'wrong-way',
    sliderPresence: 1,
    sliderRisk: 1,
    sliderPan: pan,
    sliderValue: clamp(headingError / Math.PI, -1, 1),
    surfaceAmount: 0,
    recoveryHeadingError: Math.abs(headingError) / Math.PI,
    recoveryTargetDistance: 0,
    offRoad: false,
    wrongWay: true,
    headingCorrectionPan: pan
  };
}

function updateWrongWayTone(frame, settings = {}) {
  const ready = ensureWrongWayGraph();
  if (!ready) return;

  const context = CAPTURED_GRAPH.context;
  const now = context.currentTime;
  const balance = Number.isFinite(Number(settings?.balance))
    ? clamp(Number(settings.balance), 0, 1)
    : DEFAULT_AUDIO_BALANCE;
  const dbeFactor = balance < DEFAULT_AUDIO_BALANCE
    ? balance / DEFAULT_AUDIO_BALANCE
    : 1;
  const enabled = settings?.audioEnabled !== false
    && settings?.dbeEnabled !== false
    && globalThis.__turnDriveByEarEnabled !== false;
  const active = enabled && Boolean(frame.active) && Boolean(frame.wrongWay);
  const pan = clamp(
    finiteNumber(frame.sliderPan, finiteNumber(frame.headingCorrectionPan, 0)),
    -0.88,
    0.88
  );
  const level = active ? 0.017 * dbeFactor : 0;

  setTarget(wrongWayGain.gain, level, now, active ? 0.07 : 0.11);
  setPannerTarget(wrongWayPanner, pan, now, 0.08);
  setTarget(wrongWayRoot.frequency, 112 + Math.abs(pan) * 10, now, 0.12);
  setTarget(wrongWayCompanion.frequency, 113.4 + Math.abs(pan) * 10, now, 0.12);
  setTarget(wrongWayHarmonic.frequency, 168 + Math.abs(pan) * 15, now, 0.12);
}

function ensureWrongWayGraph() {
  if (wrongWayGain) return true;
  const context = CAPTURED_GRAPH.context;
  const masterGain = CAPTURED_GRAPH.masterGain;
  if (!context || !masterGain) return false;

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 640;
  filter.Q.value = 0.38;

  wrongWayGain = context.createGain();
  wrongWayGain.gain.value = 0;
  wrongWayPanner = createPannerNode(context);

  const rootMix = context.createGain();
  rootMix.gain.value = 0.62;
  const companionMix = context.createGain();
  companionMix.gain.value = 0.32;
  const harmonicMix = context.createGain();
  harmonicMix.gain.value = 0.13;

  const warmWave = makeWarmPeriodicWave(context, [1, 0.2, 0.08, 0.03]);
  wrongWayRoot = context.createOscillator();
  wrongWayRoot.setPeriodicWave(warmWave);
  wrongWayRoot.frequency.value = 112;

  wrongWayCompanion = context.createOscillator();
  wrongWayCompanion.setPeriodicWave(warmWave);
  wrongWayCompanion.frequency.value = 113.4;

  wrongWayHarmonic = context.createOscillator();
  wrongWayHarmonic.type = 'sine';
  wrongWayHarmonic.frequency.value = 168;

  wrongWayRoot.connect(rootMix);
  wrongWayCompanion.connect(companionMix);
  wrongWayHarmonic.connect(harmonicMix);
  rootMix.connect(filter);
  companionMix.connect(filter);
  harmonicMix.connect(filter);
  filter.connect(wrongWayGain);
  wrongWayGain.connect(wrongWayPanner);
  wrongWayPanner.connect(masterGain);

  wrongWayRoot.start();
  wrongWayCompanion.start();
  wrongWayHarmonic.start();
  return true;
}

function createPannerNode(context) {
  if (typeof context.createStereoPanner === 'function') return context.createStereoPanner();
  const panner = context.createPanner();
  panner.panningModel = 'equalpower';
  panner.distanceModel = 'inverse';
  panner.refDistance = 1;
  panner.maxDistance = 2;
  panner.rolloffFactor = 0;
  return panner;
}

function setPannerTarget(panner, value, now, timeConstant) {
  if (panner?.pan) {
    setTarget(panner.pan, value, now, timeConstant);
    return;
  }
  if (panner?.positionX) {
    setTarget(panner.positionX, value, now, timeConstant);
    setTarget(panner.positionZ, 1 - Math.abs(value) * 0.25, now, timeConstant);
    return;
  }
  panner?.setPosition?.(value, 0, 1 - Math.abs(value) * 0.25);
}

function setTarget(parameter, value, now, timeConstant) {
  if (!parameter) return;
  try {
    parameter.setTargetAtTime(value, now, timeConstant);
  } catch (_) {
    try {
      parameter.value = value;
    } catch (_) {}
  }
}

function sampleAheadByDistance(samples, startIndex, targetDistance) {
  let travelled = 0;
  let previous = samples[normalizeIndex(startIndex, samples.length)];
  if (!previous?.point) return null;

  if (targetDistance <= 0) return previous;

  for (let step = 1; step < samples.length; step += 1) {
    const sample = samples[normalizeIndex(startIndex + step, samples.length)];
    if (!sample?.point) continue;
    travelled += horizontalDistance(previous.point, sample.point);
    if (travelled >= targetDistance) return sample;
    previous = sample;
  }

  return previous;
}

function makeWarmPeriodicWave(context, harmonics) {
  const real = new Float32Array(harmonics.length + 1);
  const imaginary = new Float32Array(harmonics.length + 1);
  harmonics.forEach((amount, index) => {
    imaginary[index + 1] = amount;
  });
  return context.createPeriodicWave(real, imaginary, { disableNormalization: false });
}

function blendPoints(from, to, amount) {
  const t = clamp(amount, 0, 1);
  return {
    x: finiteNumber(from?.x, 0) + (finiteNumber(to?.x, 0) - finiteNumber(from?.x, 0)) * t,
    y: finiteNumber(from?.y, 0) + (finiteNumber(to?.y, 0) - finiteNumber(from?.y, 0)) * t,
    z: finiteNumber(from?.z, 0) + (finiteNumber(to?.z, 0) - finiteNumber(from?.z, 0)) * t
  };
}

function subtract(a, b) {
  return {
    x: finiteNumber(a?.x, 0) - finiteNumber(b?.x, 0),
    y: finiteNumber(a?.y, 0) - finiteNumber(b?.y, 0),
    z: finiteNumber(a?.z, 0) - finiteNumber(b?.z, 0)
  };
}

function dot(a, b) {
  return finiteNumber(a?.x, 0) * finiteNumber(b?.x, 0)
    + finiteNumber(a?.z, 0) * finiteNumber(b?.z, 0);
}

function horizontalLength(vector) {
  return Math.hypot(finiteNumber(vector?.x, 0), finiteNumber(vector?.z, 0));
}

function horizontalDistance(a, b) {
  return Math.hypot(
    finiteNumber(a?.x, 0) - finiteNumber(b?.x, 0),
    finiteNumber(a?.z, 0) - finiteNumber(b?.z, 0)
  );
}

function normalizedVector(vector) {
  const length = horizontalLength(vector);
  if (length < 0.0001) return null;
  return {
    x: finiteNumber(vector?.x, 0) / length,
    y: 0,
    z: finiteNumber(vector?.z, 0) / length
  };
}

function forwardFromHeading(heading) {
  const angle = finiteNumber(heading, 0);
  return { x: Math.sin(angle), y: 0, z: Math.cos(angle) };
}

function rightFromHeading(heading) {
  const angle = finiteNumber(heading, 0);
  return { x: Math.cos(angle), y: 0, z: -Math.sin(angle) };
}

function signedAngle(from, to) {
  const cross = finiteNumber(from?.z, 0) * finiteNumber(to?.x, 0)
    - finiteNumber(from?.x, 0) * finiteNumber(to?.z, 0);
  return Math.atan2(cross, dot(from, to));
}

function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function normalizeIndex(value, length) {
  const index = Math.round(finiteNumber(value, 0));
  return ((index % length) + length) % length;
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function replacePrototypeMethod(prototype, name, replacement) {
  try {
    prototype[name] = replacement;
    if (prototype[name] === replacement) return true;
  } catch (_) {}

  try {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    Object.defineProperty(prototype, name, {
      ...descriptor,
      configurable: true,
      writable: true,
      value: replacement
    });
    return prototype[name] === replacement;
  } catch (_) {
    return false;
  }
}
