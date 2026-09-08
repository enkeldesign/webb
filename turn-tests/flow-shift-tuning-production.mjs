import assert from 'node:assert/strict';

import {
  deriveVehicleTuningForCar,
  getCarDefinition,
  getVehicleStatTotal
} from '../turn/vehicle/catalog.js';
import {
  installFlowShiftRuntime,
  resolveFlowShiftStats
} from '../turn/vehicle/flow-shift.js';
import {
  advanceVehicleShiftTuning,
  applyVehicleShiftTuning,
  isVehicleShiftResetReason
} from '../turn/vehicle/shift-tuning.js';

const STAT_KEYS = Object.freeze([
  'speed',
  'acceleration',
  'control',
  'drift',
  'boostPower',
  'boostDuration'
]);
const DEFAULT_GAINS = Object.freeze(['speed', 'acceleration', 'boostPower']);
const UP_GAINS = Object.freeze(['control', 'drift', 'boostDuration']);

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  emit(type, detail) {
    for (const listener of this.listeners.get(type) || []) listener({ type, detail });
  }
}

function statVector(stats) {
  return STAT_KEYS.map((key) => Number(stats?.[key]));
}

function assertPublishedState(state, expectedStats, expectedTuning, label, {
  topSpeedMayBeEasing = false
} = {}) {
  assert.deepEqual(statVector(state.vehicleStats), statVector(expectedStats), `${label}: vehicleStats`);
  assert.equal(getVehicleStatTotal(state.vehicleStats), getVehicleStatTotal(expectedStats), `${label}: stat budget`);
  assert.equal(state.vehicleEffectiveTuning, state.vehicleTuning, `${label}: effective tuning publication`);
  assert.equal(globalThis.__turnVehicleTuning, state.vehicleTuning, `${label}: global tuning publication`);

  for (const [key, expected] of Object.entries(expectedTuning)) {
    const actual = Number(state.vehicleTuning?.[key]);
    if (key === 'topSpeedMultiplier' && topSpeedMayBeEasing) {
      assert.ok(actual >= Number(expected), `${label}: easing must approach the authoritative top-speed target from above`);
    } else {
      assert.equal(actual, Number(expected), `${label}: ${key}`);
    }
  }
}

const previousRuntime = globalThis.__turnRuntime;
const previousGlobalTuning = globalThis.__turnVehicleTuning;
const supercar = getCarDefinition('supercar');
const baseStats = supercar.stats;
const baseTuning = supercar.tuning;
const defaultFlowStats = resolveFlowShiftStats({
  baseStats,
  gainKeys: DEFAULT_GAINS,
  greatFlow: true
});
const upFlowStats = resolveFlowShiftStats({
  baseStats,
  gainKeys: UP_GAINS,
  greatFlow: true
});
const carriedDefaultStats = resolveFlowShiftStats({
  baseStats,
  gainKeys: DEFAULT_GAINS,
  greatFlow: false
});
const ordinaryUpStats = resolveFlowShiftStats({
  baseStats,
  gainKeys: UP_GAINS,
  greatFlow: false
});
const defaultFlowTuning = deriveVehicleTuningForCar(supercar.id, defaultFlowStats);
const upFlowTuning = deriveVehicleTuningForCar(supercar.id, upFlowStats);
const carriedDefaultTuning = deriveVehicleTuningForCar(supercar.id, carriedDefaultStats);
const ordinaryUpTuning = deriveVehicleTuningForCar(supercar.id, ordinaryUpStats);

assert.deepEqual(statVector(baseStats), [4, 4, 2, 2, 3, 3]);
assert.deepEqual(statVector(defaultFlowStats), [5, 5, 2, 2, 4, 3]);
assert.deepEqual(statVector(upFlowStats), [4, 4, 3, 3, 3, 4]);
assert.deepEqual(statVector(carriedDefaultStats), [5, 5, 1, 1, 4, 2]);
assert.deepEqual(statVector(ordinaryUpStats), [3, 3, 3, 3, 2, 4]);
assert.equal(getVehicleStatTotal(defaultFlowStats), 21);
assert.equal(getVehicleStatTotal(upFlowStats), 21);

const state = {
  vehicleId: supercar.id,
  vehiclePerkUnlocked: true,
  vehicleStats: baseStats,
  vehicleTuning: baseTuning,
  vehicleEffectiveTuning: baseTuning,
  vehiclePerkProgress: 0,
  shiftActive: false,
  lapActive: true
};
const eventTarget = new EventTargetStub();
globalThis.__turnRuntime = { state };
globalThis.__turnVehicleTuning = baseTuning;
const flowShiftRuntime = installFlowShiftRuntime(eventTarget);

function publishOrdinaryShift({ active, stats, gainKeys }) {
  state.shiftActive = active;
  const tuning = active ? ordinaryUpTuning : baseTuning;
  assert.equal(applyVehicleShiftTuning({ state, stats, tuning }), true);
  eventTarget.emit('turn:shift-change', {
    active,
    available: true,
    intentional: true,
    gainKeys,
    lossKeys: STAT_KEYS.filter((key) => !gainKeys.includes(key)),
    amount: 1
  });
}

function finishTuningTransition(expectedStats, expectedTuning, label) {
  let updates = 0;
  while (advanceVehicleShiftTuning(state, 0.25)) {
    updates += 1;
    assert.ok(updates < 100, `${label}: tuning transition must settle`);
    assertPublishedState(state, expectedStats, expectedTuning, label, {
      topSpeedMayBeEasing: true
    });
  }
  assert.ok(updates > 0, `${label}: expected a gradual top-speed reduction`);
  assertPublishedState(state, expectedStats, expectedTuning, `${label} settled`);
}

try {
  eventTarget.emit('turn:flow-score-event', { type: 'score', multiplier: 2 });
  publishOrdinaryShift({ active: false, stats: baseStats, gainKeys: DEFAULT_GAINS });
  assertPublishedState(state, defaultFlowStats, defaultFlowTuning, 'FLOW SHIFT default');

  publishOrdinaryShift({ active: true, stats: ordinaryUpStats, gainKeys: UP_GAINS });
  assert.ok(
    ordinaryUpTuning.topSpeedMultiplier < upFlowTuning.topSpeedMultiplier,
    'The ordinary SHIFT target must be observably lower than the FLOW SHIFT target in this regression'
  );
  assert.ok(
    state.vehicleTuning.topSpeedMultiplier > upFlowTuning.topSpeedMultiplier,
    'FLOW SHIFT must retain gradual top-speed reduction while replacing the stale ordinary target'
  );
  finishTuningTransition(upFlowStats, upFlowTuning, 'FLOW SHIFT UP');

  publishOrdinaryShift({ active: false, stats: baseStats, gainKeys: DEFAULT_GAINS });
  assert.equal(advanceVehicleShiftTuning(state, 1), false,
    'Raising to the complementary FLOW SHIFT orientation must leave no stale transition');
  assertPublishedState(state, defaultFlowStats, defaultFlowTuning, 'FLOW SHIFT default restored');

  eventTarget.emit('turn:flow-score-event', { type: 'chain-expired', multiplier: 1 });
  assert.equal(advanceVehicleShiftTuning(state, 1), false,
    'FLOW loss must replace any earlier target with its carried ordinary state');
  assertPublishedState(state, carriedDefaultStats, carriedDefaultTuning, 'carried SHIFT after FLOW loss');

  publishOrdinaryShift({ active: true, stats: ordinaryUpStats, gainKeys: UP_GAINS });
  finishTuningTransition(ordinaryUpStats, ordinaryUpTuning, 'next ordinary SHIFT');

  publishOrdinaryShift({ active: false, stats: baseStats, gainKeys: DEFAULT_GAINS });
  assert.equal(advanceVehicleShiftTuning(state, 1), false);
  assertPublishedState(state, baseStats, baseTuning, 'ordinary SHIFT returned to base');

  eventTarget.addEventListener('turn:ui-state-change', (event) => {
    if (!isVehicleShiftResetReason(event.detail?.reason)) return;
    state.shiftActive = false;
    applyVehicleShiftTuning({
      state,
      stats: baseStats,
      tuning: baseTuning,
      easeTopSpeedReduction: false
    });
  });

  for (const reason of ['runtime-ready', 'race-started', 'race-reset', 'track-changed', 'home-open']) {
    eventTarget.emit('turn:flow-score-event', { type: 'score', multiplier: 2 });
    publishOrdinaryShift({ active: false, stats: baseStats, gainKeys: DEFAULT_GAINS });
    publishOrdinaryShift({ active: true, stats: ordinaryUpStats, gainKeys: UP_GAINS });
    assert.ok(state.vehicleTuning.topSpeedMultiplier > upFlowTuning.topSpeedMultiplier,
      `${reason}: fixture must begin with a pending FLOW SHIFT transition`);

    eventTarget.emit('turn:ui-state-change', { reason });
    assert.equal(advanceVehicleShiftTuning(state, 1), false,
      `${reason}: reset must clear the pending transition`);
    assert.equal(state.flowMultiplier, 1, `${reason}: reset must clear Great FLOW`);
    assert.equal(state.flowShiftGainKeys, null, `${reason}: reset must clear the carried orientation`);
    assert.equal(state.shiftActive, false, `${reason}: reset must return ordinary SHIFT to base`);
    assertPublishedState(state, baseStats, baseTuning, `${reason} reset`);
  }
} finally {
  flowShiftRuntime?.cleanup();
  globalThis.__turnRuntime = previousRuntime;
  globalThis.__turnVehicleTuning = previousGlobalTuning;
}

console.log('TURN FLOW SHIFT authoritative tuning transition regression passed.');
