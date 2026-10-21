// Shared BRAKE outcome for FLOW and RESPONSE TIME. Physics supplies only the
// speed actually removed by BRAKE, so collisions, reverse and taps cannot prime it.
export const BRAKING_MIN_SPEED = 15;
export const BRAKING_MIN_DECELERATION = 5;
export const RESPONSE_WINDOW_SECONDS = 0.7;
export const RESPONSE_DELAY_SECONDS = 0.18;
export const RESPONSE_KICK_SECONDS = 0.65;
export const RESPONSE_ACCELERATION_MULTIPLIER = 1.5;
const trackers = new WeakMap();

export function resetBrakingTechnique(state) {
  const tracker = trackers.get(state);
  if (tracker) {
    tracker.braking = false;
    tracker.start = tracker.removed = tracker.duration = tracker.window = tracker.curve = tracker.delay = 0;
  }
  state.responseTimeRemaining = 0;
}

export function advanceBrakingTechnique(state, dt, deceleration, entrySpeed, driftHeld, responseEnabled) {
  let tracker = trackers.get(state);
  if (!tracker) {
    tracker = { braking: false, start: 0, removed: 0, duration: 0, window: 0, curve: 0, delay: 0 };
    trackers.set(state, tracker);
  }
  const elapsed = Math.max(0, Math.min(0.1, dt));
  state.responseTimeRemaining = Math.max(0, (state.responseTimeRemaining || 0) - elapsed);
  if (state.offRoad || state.collided || state.reverse > 0 || state.lapActive === false) {
    resetBrakingTechnique(state);
    return;
  }
  const braking = state.brake > 0;
  if (braking) {
    if (!tracker.braking) {
      tracker.start = entrySpeed;
      tracker.removed = 0;
      tracker.duration = 0;
    }
    tracker.removed += Math.max(0, deceleration);
    tracker.duration += elapsed;
    tracker.window = tracker.curve = tracker.delay = 0;
    state.responseTimeRemaining = 0;
  } else {
    if (tracker.braking && tracker.start >= BRAKING_MIN_SPEED
      && tracker.removed >= BRAKING_MIN_DECELERATION && tracker.duration >= 0.12) {
      tracker.window = RESPONSE_WINDOW_SECONDS;
      tracker.curve = 1.2;
    }
    if (tracker.curve > 0 && state.speed >= 8 && (Math.abs(state.steering) > 0.15 || driftHeld)) {
      tracker.curve = 0;
      // One semantic outcome, through the existing FLOW event owner; no DOM work.
      if (typeof globalThis.CustomEvent === 'function') globalThis.dispatchEvent?.(new CustomEvent('turn:braking-outcome', {
        detail: { deceleration: tracker.removed }
      }));
    }
    tracker.curve = Math.max(0, tracker.curve - elapsed);
    if (tracker.delay > 0) {
      tracker.delay = Math.max(0, tracker.delay - elapsed);
      if (tracker.delay === 0 && responseEnabled && (state.throttle > 0 || driftHeld)) {
        state.responseTimeRemaining = RESPONSE_KICK_SECONDS;
      }
    } else if (tracker.window > 0 && (state.throttle > 0 || driftHeld)) {
      tracker.window = 0;
      if (responseEnabled) tracker.delay = RESPONSE_DELAY_SECONDS;
    }
    tracker.window = Math.max(0, tracker.window - elapsed);
  }
  tracker.braking = braking;
}
