const UPDATE_INTERVAL_MS = 1000 / 30;

let installed = false;
let wrappedAudio = null;
let lastComputedAt = -Infinity;
let cachedOverride = Object.freeze({});

export function installOffroadEarDirection() {
  if (installed) return wrappedAudio || globalThis.__turnAudio;
  const baseAudio = globalThis.__turnAudio;
  if (!baseAudio) return null;

  installed = true;
  wrappedAudio = Object.freeze({
    unlock: (...args) => baseAudio.unlock(...args),
    update(frame = {}, now = performance.now()) {
      const settings = globalThis.__turnAudioPreferences?.getSettings?.();
      const enabled = settings?.dbeEnabled !== false
        && globalThis.__turnDriveByEarEnabled !== false;

      if (!enabled) {
        cachedOverride = Object.freeze({});
        baseAudio.update(frame, now);
        return;
      }

      if (now - lastComputedAt >= UPDATE_INTERVAL_MS) {
        cachedOverride = Object.freeze(
          createOffroadEarDirectionFrame(globalThis.__turnRuntime, frame)
        );
        lastComputedAt = now;
      }

      baseAudio.update({ ...frame, ...cachedOverride }, now);
    },
    cue: (...args) => baseAudio.cue(...args),
    silence: (...args) => baseAudio.silence(...args),
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

export function createOffroadEarDirectionFrame(runtime, frame = {}) {
  const state = runtime?.state;
  const samples = runtime?.samples;
  if (!state || !Array.isArray(samples) || samples.length < 2 || !state.position) return {};
  if (!Boolean(state.offRoad || frame.offRoad)) return {};

  const index = normalizeIndex(state.nearestTrackIndex, samples.length);
  const sample = samples[index];
  if (!sample?.point) return {};

  const right = normalizedVector(runtime.getRight?.()) || rightFromHeading(state.heading);
  const optimalRouteVector = subtract(sample.point, state.position);
  const optimalRouteDirection = normalizedVector(optimalRouteVector);
  if (!right || !optimalRouteDirection) return {};

  // One rule on asphalt and beyond it: the ribbon belongs to the ear on the side
  // of the optimal route. TURN's established on-road mixer convention uses the
  // inverse numeric pan sign, so crossing the road edge must not flip the cue.
  const optimalRouteSide = clamp(dot(optimalRouteDirection, right), -1, 1);
  if (Math.abs(optimalRouteSide) < 0.025) return {};

  const existingPan = clamp(Number(frame.sliderPan) || 0, -1, 1);
  const geometricStrength = 0.58
    + smoothstep(0.06, 0.82, Math.abs(optimalRouteSide)) * 0.38;
  const magnitude = clamp(
    Math.max(Math.abs(existingPan), geometricStrength),
    0.58,
    0.96
  );

  return {
    sliderPan: -Math.sign(optimalRouteSide) * magnitude
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

function normalizedVector(vector) {
  const length = Math.hypot(
    finiteNumber(vector?.x, 0),
    finiteNumber(vector?.z, 0)
  );
  if (length < 0.0001) return null;
  return {
    x: finiteNumber(vector?.x, 0) / length,
    y: 0,
    z: finiteNumber(vector?.z, 0) / length
  };
}

function rightFromHeading(heading) {
  const angle = finiteNumber(heading, 0);
  return { x: Math.cos(angle), y: 0, z: -Math.sin(angle) };
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
