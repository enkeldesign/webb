import { deriveVehicleTuning } from './catalog.js?revision=r230-vehicle-perks';
import { createDriftAttackScorer } from '../scoring/drift-attack.js';
import { SCORE_FEEDBACK_EVENT } from '../scoring/score-feedback.js';

export const TRACTION_MIN_OFFROAD_PENALTY = 0.22;
export const TRACTION_SHALLOW_DEPTH_RATIO = 0.08;
export const TRACTION_DEEP_DEPTH_RATIO = 0.42;
export const TORQUE_BUILD_SECONDS = 3.2;
export const CARRY_ON_LOCK_DRAG_ADD = 0.07;
export const STANDARD_LOCK_DRAG_ADD = 0.18;
export const FULL_TANK_BUILD_SECONDS = 8;
export const FULL_TANK_MIN_SPEED = 8;
export const DRIFT_DEMON_BUILD_SECONDS = 3.6;
export const DRIFT_DEMON_DECAY_SECONDS = 1.6;
export const GRADUATED_STAGE_SECONDS = 4;
export const GRADUATED_TOTAL_SECONDS = GRADUATED_STAGE_SECONDS * 3;
export const GRADUATED_MIN_SPEED = 8;
export const GRADUATED_MAX_CONTROL_MULTIPLIER = 1.28;
export const GRADUATED_MAX_ACCELERATION_MULTIPLIER = 1.24;
export const GRADUATED_MAX_TOP_SPEED_MULTIPLIER = 1.20;
// CLEAN EXIT (Compact): a clean drift adds CONTROL for a moment. A new clean drift
// restarts the time; the bonus never stacks and never goes past CONTROL 5/5.
export const CLEAN_EXIT_CONTROL_BONUS = 1;
export const CLEAN_EXIT_SECONDS = 3;

const GRADUATED_STAGE_LABELS = Object.freeze([
  '',
  'CONTROL',
  'ACCELERATION',
  'TOP SPEED'
]);

const MAX_ATTRIBUTE_STATS = Object.freeze({
  speed: 5,
  acceleration: 5,
  control: 5,
  drift: 5,
  boostPower: 5,
  boostDuration: 5
});
const MAX_ATTRIBUTE_TUNING = Object.freeze(deriveVehicleTuning(MAX_ATTRIBUTE_STATS));
// CONTROL 1/5 … 5/5 as the handling multiplier every car's stats map to.
const CONTROL_MULTIPLIER_BY_LEVEL = Object.freeze([1, 2, 3, 4, 5].map((control) => (
  deriveVehicleTuning({ ...MAX_ATTRIBUTE_STATS, control }).controlMultiplier
)));
// A clean drift is one DRIFT ATTACK would bank: it ends without a wall hit, a spin,
// leaving the road or stopping, and scores more than a tap. Each car state keeps its
// own scorer, whether or not DRIFT ATTACK is unlocked or shown.
const cleanDriftTrackers = new WeakMap();

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function clampProgress(value) {
  const progress = clamp(value);
  if (progress <= 0.000000001) return 0;
  if (Math.abs(progress - 1 / 3) <= 0.000000001) return 1 / 3;
  if (Math.abs(progress - 2 / 3) <= 0.000000001) return 2 / 3;
  if (progress >= 0.999999999) return 1;
  return progress;
}

function smoothstep(edge0, edge1, value) {
  const amount = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0));
  return amount * amount * (3 - 2 * amount);
}

function runtimeMatchesVehicle(state) {
  return state?.vehiclePerkRuntimeVehicleId === String(state?.vehicleId || '')
    && state?.vehiclePerkRuntimeUnlocked === (state?.vehiclePerkUnlocked === true);
}

function activePerk(state, vehicleId) {
  return state?.vehiclePerkUnlocked === true && String(state?.vehicleId || '') === vehicleId;
}

function graduatedStage(progress) {
  const value = clampProgress(progress);
  if (value >= 1) return 3;
  if (value >= 2 / 3) return 2;
  if (value >= 1 / 3) return 1;
  return 0;
}

function graduatedStageProgress(progress, stageIndex) {
  return clamp(clampProgress(progress) * 3 - stageIndex);
}

export function resolveGraduatedStageFeedback(previousStage, nextStage) {
  const previous = Math.max(0, Math.min(3, Math.floor(Number(previousStage) || 0)));
  const next = Math.max(0, Math.min(3, Math.floor(Number(nextStage) || 0)));
  if (next === previous) return null;
  if (next < previous) return 'GRADUATED · STREAK LOST';
  return `GRADUATED · ${GRADUATED_STAGE_LABELS[next]}`;
}

function cleanDriftTracker(state) {
  let tracker = cleanDriftTrackers.get(state);
  if (!tracker) {
    tracker = { clockMs: 0, banked: false };
    tracker.scorer = createDriftAttackScorer({
      onEvent(type) {
        if (type === SCORE_FEEDBACK_EVENT.BANK) tracker.banked = true;
      }
    });
    cleanDriftTrackers.set(state, tracker);
  }
  return tracker;
}

// The CONTROL multiplier one or more points up, never past 5/5.
export function resolveControlMultiplierBonus(controlMultiplier, points = CLEAN_EXIT_CONTROL_BONUS) {
  const base = Number(controlMultiplier) || 1;
  let level = 0;
  CONTROL_MULTIPLIER_BY_LEVEL.forEach((value, index) => {
    if (Math.abs(value - base) < Math.abs(CONTROL_MULTIPLIER_BY_LEVEL[level] - base)) level = index;
  });
  const raised = CONTROL_MULTIPLIER_BY_LEVEL[Math.min(CONTROL_MULTIPLIER_BY_LEVEL.length - 1, level + points)];
  return Math.max(base, raised);
}

export function resetVehiclePerkRuntimeState(state) {
  if (!state) return null;
  cleanDriftTrackers.delete(state);
  state.vehiclePerkRuntimeVehicleId = String(state.vehicleId || '');
  state.vehiclePerkRuntimeUnlocked = state.vehiclePerkUnlocked === true;
  state.vehiclePerkProgress = 0;
  state.vehiclePerkStage = 0;
  state.vehiclePerkBoostRefill = 0;
  state.vehicleEffectiveTuning = state.vehicleTuning || null;
  state.vehicleEffectiveMaxSpeed = 0;
  return state;
}

export function syncVehiclePerkRuntimeState(state) {
  if (!state) return null;
  if (!runtimeMatchesVehicle(state)) resetVehiclePerkRuntimeState(state);
  return state;
}

export function resolveVehicleOffRoadPenalty({
  vehicleId = '',
  perkUnlocked = false,
  offRoad = false,
  trackDistance = 0,
  trackWidth = 1
} = {}) {
  if (!offRoad) return 0;
  if (vehicleId !== 'convertible' || perkUnlocked !== true) return 1;

  const width = Math.max(0.001, Number(trackWidth) || 1);
  const roadEdge = width * 0.58;
  const depth = Math.max(0, (Number(trackDistance) || 0) - roadEdge);
  const shallowDepth = width * TRACTION_SHALLOW_DEPTH_RATIO;
  const deepDepth = width * TRACTION_DEEP_DEPTH_RATIO;
  const depthMix = smoothstep(shallowDepth, deepDepth, depth);
  return lerp(TRACTION_MIN_OFFROAD_PENALTY, 1, depthMix);
}

export function resolveVehicleLockDragAdd({
  vehicleId = '',
  perkUnlocked = false,
  perkLockDragAdd = CARRY_ON_LOCK_DRAG_ADD
} = {}) {
  if (vehicleId !== 'van' || perkUnlocked !== true) return STANDARD_LOCK_DRAG_ADD;
  return clamp(perkLockDragAdd, 0.01, STANDARD_LOCK_DRAG_ADD);
}

export function advanceVehiclePerkRuntimeState({
  state,
  dt = 0,
  driftHeld = false,
  offRoad = false,
  collided = false,
  speed = state?.speed || 0,
  overcharge = 0,
  boostActive = false,
  slipAngle = state?.driftSlipAngle || 0
} = {}) {
  if (!state) return 0;
  syncVehiclePerkRuntimeState(state);

  const elapsed = clamp(dt, 0, 0.1);
  state.vehiclePerkBoostRefill = 0;
  if (activePerk(state, 'truck')) {
    if ((Number(overcharge) || 0) > 0) {
      state.vehiclePerkProgress = clampProgress(
        state.vehiclePerkProgress + elapsed / TORQUE_BUILD_SECONDS
      );
    } else if (boostActive !== true) {
      // If OVERCHARGE is spent through BOOST, keep the built tank for that
      // continuous BOOST use. Leaking/ending OVERCHARGE or releasing BOOST
      // restores the active STANDARD/SHIFT baseline immediately.
      state.vehiclePerkProgress = 0;
    }
  } else if (activePerk(state, 'suv')) {
    if (offRoad || collided) {
      state.vehiclePerkProgress = 0;
    } else if ((Number(speed) || 0) >= FULL_TANK_MIN_SPEED) {
      state.vehiclePerkProgress = clampProgress(
        state.vehiclePerkProgress + elapsed / FULL_TANK_BUILD_SECONDS
      );
      // Clean driving also fills the BOOST TANK, at the same rate it builds.
      state.vehiclePerkBoostRefill = 1 / FULL_TANK_BUILD_SECONDS;
    }
  } else if (activePerk(state, 'sedan-sports')) {
    const delta = driftHeld
      ? elapsed / DRIFT_DEMON_BUILD_SECONDS
      : -elapsed / DRIFT_DEMON_DECAY_SECONDS;
    state.vehiclePerkProgress = clampProgress(state.vehiclePerkProgress + delta);
  } else if (activePerk(state, 'classic')) {
    if (offRoad || collided) {
      state.vehiclePerkProgress = 0;
    } else if ((Number(speed) || 0) >= GRADUATED_MIN_SPEED) {
      state.vehiclePerkProgress = clampProgress(
        state.vehiclePerkProgress + elapsed / GRADUATED_TOTAL_SECONDS
      );
    }
  } else if (activePerk(state, 'compact')) {
    // Progress is the CLEAN EXIT time left: full after a clean drift, then running out.
    const tracker = cleanDriftTracker(state);
    tracker.clockMs += elapsed * 1000;
    tracker.banked = false;
    tracker.scorer.advance(elapsed, tracker.clockMs, speed, slipAngle, offRoad, collided, true);
    state.vehiclePerkProgress = tracker.banked
      ? 1
      : clampProgress(state.vehiclePerkProgress - elapsed / CLEAN_EXIT_SECONDS);
  } else {
    state.vehiclePerkProgress = 0;
  }
  state.vehiclePerkStage = activePerk(state, 'classic')
    ? graduatedStage(state.vehiclePerkProgress)
    : 0;
  return state.vehiclePerkProgress;
}

export function resolveVehiclePerkTuning({ state, tuning } = {}) {
  const baseTuning = tuning || state?.vehicleTuning || null;
  if (!state || !baseTuning) return baseTuning;
  syncVehiclePerkRuntimeState(state);

  const progress = clamp(state.vehiclePerkProgress);
  const torqueActive = activePerk(state, 'truck');
  const fullTankActive = activePerk(state, 'suv');
  const driftDemonActive = activePerk(state, 'sedan-sports');
  const graduatedActive = activePerk(state, 'classic');
  const cleanExitActive = activePerk(state, 'compact');
  if (progress <= 0 || (!torqueActive && !fullTankActive && !driftDemonActive && !graduatedActive && !cleanExitActive)) {
    state.vehicleEffectiveTuning = baseTuning;
    return baseTuning;
  }

  const effective = state.vehicleEffectiveTuning === baseTuning
    || !state.vehicleEffectiveTuning
    || Object.isFrozen(state.vehicleEffectiveTuning)
    ? { ...baseTuning }
    : Object.assign(state.vehicleEffectiveTuning, baseTuning);
  if (torqueActive) {
    effective.boostDurationSeconds = lerp(
      Number(baseTuning.boostDurationSeconds) || MAX_ATTRIBUTE_TUNING.boostDurationSeconds,
      MAX_ATTRIBUTE_TUNING.boostDurationSeconds,
      progress
    );
  }
  if (fullTankActive) {
    effective.boostDurationSeconds = lerp(
      Number(baseTuning.boostDurationSeconds) || MAX_ATTRIBUTE_TUNING.boostDurationSeconds,
      MAX_ATTRIBUTE_TUNING.boostDurationSeconds,
      progress
    );
  }
  if (driftDemonActive) {
    for (const key of [
      'driftEngineMultiplier',
      'driftDragAdd',
      'driftSpeedMultiplier',
      'driftStabilityMultiplier'
    ]) {
      effective[key] = lerp(
        Number(baseTuning[key]) || MAX_ATTRIBUTE_TUNING[key],
        MAX_ATTRIBUTE_TUNING[key],
        progress
      );
    }
  }
  if (graduatedActive) {
    effective.controlMultiplier = lerp(
      Number(baseTuning.controlMultiplier) || 1,
      GRADUATED_MAX_CONTROL_MULTIPLIER,
      graduatedStageProgress(progress, 0)
    );
    effective.accelerationMultiplier = lerp(
      Number(baseTuning.accelerationMultiplier) || 1,
      GRADUATED_MAX_ACCELERATION_MULTIPLIER,
      graduatedStageProgress(progress, 1)
    );
    effective.topSpeedMultiplier = lerp(
      Number(baseTuning.topSpeedMultiplier) || 1,
      GRADUATED_MAX_TOP_SPEED_MULTIPLIER,
      graduatedStageProgress(progress, 2)
    );
  }
  if (cleanExitActive) {
    effective.controlMultiplier = resolveControlMultiplierBonus(baseTuning.controlMultiplier);
  }
  state.vehicleEffectiveTuning = effective;
  return effective;
}
