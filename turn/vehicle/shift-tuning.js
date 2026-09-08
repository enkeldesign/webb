import { advanceShiftTopSpeedMultiplier } from '../input/shift-toggle.js?revision=r227-shift-feedback';
import { resolveVehiclePerkTuning } from './perk-runtime.js?revision=r233-graduated';

const TRANSITION_KEY = Symbol.for('turn.vehicle.shift-tuning-transition');
const resetReasonSet = new Set([
  'runtime-ready',
  'race-started',
  'race-reset',
  'track-changed',
  'home-open'
]);

function validState(state) {
  return state && (typeof state === 'object' || typeof state === 'function');
}

function publishTuning(state, tuning) {
  state.vehicleTuning = tuning;
  state.vehicleEffectiveTuning = resolveVehiclePerkTuning({ state, tuning });
  globalThis.__turnVehicleTuning = tuning;
}

export function isVehicleShiftResetReason(reason) {
  return resetReasonSet.has(reason);
}

export function clearVehicleShiftTuningTransition(state) {
  if (!validState(state)) return false;
  if (!state[TRANSITION_KEY]) return false;
  delete state[TRANSITION_KEY];
  return true;
}

export function applyVehicleShiftTuning({
  state,
  stats,
  tuning,
  easeTopSpeedReduction = true
} = {}) {
  if (!validState(state) || !stats || !tuning) return false;

  const currentTopSpeed = Number(state.vehicleTuning?.topSpeedMultiplier);
  const targetTopSpeed = Number(tuning.topSpeedMultiplier);
  const loweringTopSpeed = easeTopSpeedReduction === true
    && Number.isFinite(currentTopSpeed)
    && Number.isFinite(targetTopSpeed)
    && targetTopSpeed < currentTopSpeed;
  const appliedTuning = loweringTopSpeed
    ? { ...tuning, topSpeedMultiplier: currentTopSpeed }
    : tuning;

  state.vehicleStats = stats;
  publishTuning(state, appliedTuning);

  if (loweringTopSpeed) {
    state[TRANSITION_KEY] = {
      appliedTuning,
      targetTuning: tuning
    };
  } else {
    delete state[TRANSITION_KEY];
  }
  return true;
}

export function advanceVehicleShiftTuning(state, dt) {
  if (!validState(state)) return false;
  const transition = state[TRANSITION_KEY];
  if (!transition) return false;

  // A newer tuning author may replace the active object between animation
  // ticks. Never let an abandoned SHIFT transition overwrite that result.
  if (state.vehicleTuning !== transition.appliedTuning) {
    delete state[TRANSITION_KEY];
    return false;
  }

  const current = Number(state.vehicleTuning.topSpeedMultiplier);
  const target = Number(transition.targetTuning.topSpeedMultiplier);
  const next = advanceShiftTopSpeedMultiplier(current, target, dt);
  if (Math.abs(next - target) <= 0.000001) {
    publishTuning(state, transition.targetTuning);
    delete state[TRANSITION_KEY];
    return true;
  }

  let appliedTuning = state.vehicleTuning;
  if (Object.isFrozen(appliedTuning)) {
    appliedTuning = { ...appliedTuning };
    transition.appliedTuning = appliedTuning;
  }
  appliedTuning.topSpeedMultiplier = next;
  publishTuning(state, appliedTuning);
  return true;
}
