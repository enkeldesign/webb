import { deriveVehicleTuning, getCarDefinition } from './catalog.js?revision=r230-vehicle-perks';
import { getVehiclePerk, originalVehiclePerk } from './perks.js';
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
// Canonical tier spacing, reused for conditional effects. A tier above the visible
// ceiling continues its last step, as existing beyond-ceiling perk tuning does.
const TIER_TUNING = Object.freeze([1, 2, 3, 4, 5].map((level) => Object.freeze(deriveVehicleTuning({
  speed: level, acceleration: level, control: level, drift: level, boostPower: level, boostDuration: level
}))));
const STAT_TUNING_KEYS = Object.freeze({
  speed: ['topSpeedMultiplier'],
  acceleration: ['accelerationMultiplier'],
  control: ['controlMultiplier'],
  drift: ['driftEngineMultiplier', 'driftDragAdd', 'driftSpeedMultiplier', 'driftStabilityMultiplier']
});
// CONTROL 1/5 … 5/5 as the handling multiplier every car's stats map to.
const CONTROL_MULTIPLIER_BY_LEVEL = Object.freeze([1, 2, 3, 4, 5].map((control) => (
  deriveVehicleTuning({ ...MAX_ATTRIBUTE_STATS, control }).controlMultiplier
)));
// A clean drift is one DRIFT ATTACK would bank: it ends without a wall hit, a spin,
// leaving the road or stopping, and scores more than a tap. Each car state keeps its
// own scorer, whether or not DRIFT ATTACK is unlocked or shown.
const cleanDriftTrackers = new WeakMap();

// Perks are known by their stable ids (perks.js), never by the car they come from. A car
// runs its ORIGINAL perk once unlocked and at most one INSTALLED perk (#1219). Each has a
// slot of its own: the original perk's state stays in vehiclePerkProgress and
// vehiclePerkStage, the installed perk's is vehicleInstalledPerkProgress.
const TRACTION = 'traction';
const CARRY_ON = 'carry-on';
const TORQUE = 'torque';
const FULL_TANK = 'full-tank';
const DRIFT_DEMON = 'drift-demon';
const GRADUATED = 'graduated';
const CLEAN_EXIT = 'clean-exit';
// The perks that change tuning as they build.
const LIVE_TUNING_PERKS = new Set([TORQUE, FULL_TANK, DRIFT_DEMON, GRADUATED, CLEAN_EXIT]);
const DRIFT_DEMON_TUNING_KEYS = Object.freeze([
  'driftEngineMultiplier',
  'driftDragAdd',
  'driftSpeedMultiplier',
  'driftStabilityMultiplier'
]);
// When two perks change the same value they never add up: the stronger change applies.
// Stronger is lower for these, the way a perk pushes them; higher for every other value.
const LOWER_IS_STRONGER = new Set(['driftDragAdd', 'lockDragAdd', 'driftGripMultiplier']);
const NO_PERKS = Object.freeze([]);
const ORIGINAL_PERK_IDS = new Map();
// One physics step's inputs, reused so a step allocates nothing.
const perkStep = {
  elapsed: 0,
  driftHeld: false,
  offRoad: false,
  collided: false,
  speed: 0,
  overcharge: 0,
  boostActive: false,
  slipAngle: 0
};

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

function strongerValue(key, current, candidate) {
  if (typeof current !== 'number' || Number.isNaN(current)) return candidate;
  if (LOWER_IS_STRONGER.has(key)) return candidate < current ? candidate : current;
  return candidate > current ? candidate : current;
}

function applyStronger(tuning, key, candidate) {
  tuning[key] = strongerValue(key, tuning[key], candidate);
}

// The perks a car runs with when nothing is installed: its own, once unlocked.
export function vehiclePerkIdsFor(vehicleId, perkUnlocked = false) {
  const perk = originalVehiclePerk(vehicleId);
  if (!perk || perkUnlocked !== true) return NO_PERKS;
  let ids = ORIGINAL_PERK_IDS.get(perk.id);
  if (!ids) {
    ids = Object.freeze([perk.id]);
    ORIGINAL_PERK_IDS.set(perk.id, ids);
  }
  return ids;
}

// The perk installed on a car, when it may run there: an installable perk that is not
// the car's own, so no perk ever runs twice.
function installedPerkId(state, originalId) {
  const perk = getVehiclePerk(state?.vehicleInstalledPerkId);
  return perk?.installable === true && perk.id !== originalId ? perk.id : '';
}

function runtimeMatchesVehicle(state) {
  return state?.vehiclePerkRuntimeVehicleId === String(state?.vehicleId || '')
    && state?.vehiclePerkRuntimeUnlocked === (state?.vehiclePerkUnlocked === true)
    && state?.vehiclePerkRuntimeInstalled === String(state?.vehicleInstalledPerkId || '');
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
  const original = originalVehiclePerk(state.vehicleId);
  const unlocked = state.vehiclePerkUnlocked === true;
  const originalId = unlocked && original ? original.id : '';
  const installedId = installedPerkId(state, original?.id);
  state.vehiclePerkRuntimeVehicleId = String(state.vehicleId || '');
  state.vehiclePerkRuntimeUnlocked = unlocked;
  state.vehiclePerkRuntimeInstalled = String(state.vehicleInstalledPerkId || '');
  state.vehiclePerkRuntimeOriginalId = originalId;
  state.vehiclePerkRuntimeInstalledId = installedId;
  state.vehiclePerkIds = installedId
    ? Object.freeze(originalId ? [originalId, installedId] : [installedId])
    : vehiclePerkIdsFor(state.vehicleId, unlocked);
  state.vehiclePerkProgress = 0;
  state.vehicleInstalledPerkProgress = 0;
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

// The perks a car runs with right now, its original perk first.
export function activeVehiclePerkIds(state) {
  if (!state) return NO_PERKS;
  return syncVehiclePerkRuntimeState(state).vehiclePerkIds || NO_PERKS;
}

export function resolveVehicleOffRoadPenalty({
  vehicleId = '',
  perkUnlocked = false,
  perkIds = vehiclePerkIdsFor(vehicleId, perkUnlocked),
  offRoad = false,
  trackDistance = 0,
  trackWidth = 1
} = {}) {
  if (!offRoad) return 0;
  if (!perkIds.includes(TRACTION)) return 1;

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
  perkIds = vehiclePerkIdsFor(vehicleId, perkUnlocked),
  perkLockDragAdd = CARRY_ON_LOCK_DRAG_ADD
} = {}) {
  if (!perkIds.includes(CARRY_ON)) return STANDARD_LOCK_DRAG_ADD;
  return clamp(perkLockDragAdd, 0.01, STANDARD_LOCK_DRAG_ADD);
}

// One step of a perk that builds, from its slot's progress to the next.
function advancePerkProgress(state, perkId, progress, {
  elapsed,
  driftHeld,
  offRoad,
  collided,
  speed,
  overcharge,
  boostActive,
  slipAngle
}) {
  if (perkId === TORQUE) {
    if ((Number(overcharge) || 0) > 0) {
      return clampProgress(progress + elapsed / TORQUE_BUILD_SECONDS);
    }
    // If OVERCHARGE is spent through BOOST, keep the built tank for that continuous
    // BOOST use. Leaking/ending OVERCHARGE or releasing BOOST restores the active
    // STANDARD/SHIFT baseline immediately.
    return boostActive !== true ? 0 : progress;
  }
  if (perkId === FULL_TANK) {
    if (offRoad || collided) return 0;
    if ((Number(speed) || 0) < FULL_TANK_MIN_SPEED) return progress;
    // Clean driving also fills the BOOST TANK, at the same rate it builds. The fill
    // accrues in race time here (only while the race runs, with every physics substep)
    // and the BOOST loop takes it each frame.
    state.vehiclePerkBoostRefill = (Number(state.vehiclePerkBoostRefill) || 0) + elapsed / FULL_TANK_BUILD_SECONDS;
    return clampProgress(progress + elapsed / FULL_TANK_BUILD_SECONDS);
  }
  if (perkId === DRIFT_DEMON) {
    const delta = driftHeld
      ? elapsed / DRIFT_DEMON_BUILD_SECONDS
      : -elapsed / DRIFT_DEMON_DECAY_SECONDS;
    return clampProgress(progress + delta);
  }
  if (perkId === GRADUATED) {
    if (offRoad || collided) return 0;
    if ((Number(speed) || 0) < GRADUATED_MIN_SPEED) return progress;
    return clampProgress(progress + elapsed / GRADUATED_TOTAL_SECONDS);
  }
  if (perkId === CLEAN_EXIT) {
    // Progress is the CLEAN EXIT time left: full after a clean drift, then running out.
    const tracker = cleanDriftTracker(state);
    tracker.clockMs += elapsed * 1000;
    tracker.banked = false;
    tracker.scorer.advance(elapsed, tracker.clockMs, speed, slipAngle, offRoad, collided, true);
    return tracker.banked
      ? 1
      : clampProgress(progress - elapsed / CLEAN_EXIT_SECONDS);
  }
  return 0;
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

  const original = state.vehiclePerkRuntimeOriginalId;
  const installed = state.vehiclePerkRuntimeInstalledId;
  perkStep.elapsed = clamp(dt, 0, 0.1);
  perkStep.driftHeld = driftHeld;
  perkStep.offRoad = offRoad;
  perkStep.collided = collided;
  perkStep.speed = speed;
  perkStep.overcharge = overcharge;
  perkStep.boostActive = boostActive;
  perkStep.slipAngle = slipAngle;
  if (original !== FULL_TANK && installed !== FULL_TANK) state.vehiclePerkBoostRefill = 0;
  state.vehiclePerkProgress = advancePerkProgress(state, original, state.vehiclePerkProgress, perkStep);
  state.vehicleInstalledPerkProgress = installed
    ? advancePerkProgress(state, installed, state.vehicleInstalledPerkProgress, perkStep)
    : 0;
  state.vehiclePerkStage = original === GRADUATED
    ? graduatedStage(state.vehiclePerkProgress)
    : 0;
  return state.vehiclePerkProgress;
}

// A value as the car runs it before any perk builds: its own, which holds its original
// perk's fixed values (catalog.js), or the installed perk's fixed value where stronger.
function configuredValue(baseTuning, installedTuning, key) {
  const value = baseTuning[key];
  const installedValue = installedTuning?.[key];
  return installedValue === undefined ? value : strongerValue(key, value, installedValue);
}

// What a building perk does to the tuning, at its progress, from the configured values.
function applyLivePerk(effective, baseTuning, installedTuning, perkId, progress) {
  if (perkId === TORQUE || perkId === FULL_TANK) {
    const from = configuredValue(baseTuning, installedTuning, 'boostDurationSeconds');
    applyStronger(effective, 'boostDurationSeconds', lerp(
      Number(from) || MAX_ATTRIBUTE_TUNING.boostDurationSeconds,
      MAX_ATTRIBUTE_TUNING.boostDurationSeconds,
      progress
    ));
  } else if (perkId === DRIFT_DEMON) {
    for (const key of DRIFT_DEMON_TUNING_KEYS) {
      applyStronger(effective, key, lerp(
        Number(configuredValue(baseTuning, installedTuning, key)) || MAX_ATTRIBUTE_TUNING[key],
        MAX_ATTRIBUTE_TUNING[key],
        progress
      ));
    }
  } else if (perkId === GRADUATED) {
    applyStronger(effective, 'controlMultiplier', lerp(
      Number(configuredValue(baseTuning, installedTuning, 'controlMultiplier')) || 1,
      GRADUATED_MAX_CONTROL_MULTIPLIER,
      graduatedStageProgress(progress, 0)
    ));
    applyStronger(effective, 'accelerationMultiplier', lerp(
      Number(configuredValue(baseTuning, installedTuning, 'accelerationMultiplier')) || 1,
      GRADUATED_MAX_ACCELERATION_MULTIPLIER,
      graduatedStageProgress(progress, 1)
    ));
    applyStronger(effective, 'topSpeedMultiplier', lerp(
      Number(configuredValue(baseTuning, installedTuning, 'topSpeedMultiplier')) || 1,
      GRADUATED_MAX_TOP_SPEED_MULTIPLIER,
      graduatedStageProgress(progress, 2)
    ));
  } else if (perkId === CLEAN_EXIT) {
    applyStronger(effective, 'controlMultiplier', resolveControlMultiplierBonus(
      configuredValue(baseTuning, installedTuning, 'controlMultiplier')
    ));
  }
}

function applyStatBonus(effective, state, stat, points, capAtFive = false) {
  const stats = state.vehicleStats || getCarDefinition(state.vehicleId)?.stats;
  const base = Math.max(1, Math.min(5, Math.round(Number(stats?.[stat]) || 3)));
  const level = capAtFive ? Math.min(5, base + points) : base + points;
  for (const key of STAT_TUNING_KEYS[stat]) {
    const value = level <= 5 ? TIER_TUNING[level - 1][key]
      : TIER_TUNING[4][key] + (TIER_TUNING[4][key] - TIER_TUNING[3][key]) * (level - 5);
    applyStronger(effective, key, value);
  }
}

export function resolveVehiclePerkTuning({ state, tuning } = {}) {
  const baseTuning = tuning || state?.vehicleTuning || null;
  if (!state || !baseTuning) return baseTuning;
  syncVehiclePerkRuntimeState(state);

  const original = state.vehiclePerkRuntimeOriginalId;
  const installed = state.vehiclePerkRuntimeInstalledId;
  const originalProgress = clamp(state.vehiclePerkProgress);
  const installedProgress = clamp(state.vehicleInstalledPerkProgress);
  const installedTuning = installed ? getVehiclePerk(installed).tuning || null : null;
  const originalBuilds = originalProgress > 0 && LIVE_TUNING_PERKS.has(original);
  const installedBuilds = installedProgress > 0 && LIVE_TUNING_PERKS.has(installed);
  const lockedIn = installed === 'locked-in' && Number(state.flowScoreMultiplier) > 2;
  if (!installedTuning && !originalBuilds && !installedBuilds && !lockedIn) {
    state.vehicleEffectiveTuning = baseTuning;
    return baseTuning;
  }

  const effective = state.vehicleEffectiveTuning === baseTuning
    || !state.vehicleEffectiveTuning
    || Object.isFrozen(state.vehicleEffectiveTuning)
    ? { ...baseTuning }
    : Object.assign(state.vehicleEffectiveTuning, baseTuning);
  if (installedTuning) {
    for (const key in installedTuning) applyStronger(effective, key, installedTuning[key]);
  }
  if (originalBuilds) applyLivePerk(effective, baseTuning, installedTuning, original, originalProgress);
  if (installedBuilds) applyLivePerk(effective, baseTuning, installedTuning, installed, installedProgress);
  if (lockedIn) {
    applyStatBonus(effective, state, 'control', 1);
    applyStatBonus(effective, state, 'acceleration', 1);
    applyStatBonus(effective, state, 'drift', 1);
  }
  state.vehicleEffectiveTuning = effective;
  return effective;
}
