import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  deriveVehicleTuningForCar,
  getCarDefinition,
  getVehicleStatTotal
} from '../turn/vehicle/catalog.js';
import {
  FLOW_SHIFT_MIN_MULTIPLIER,
  installFlowShiftRuntime,
  isGreatFlow,
  resolveFlowShiftStats
} from '../turn/vehicle/flow-shift.js';
import {
  advanceVehicleShiftTuning,
  applyVehicleShiftTuning,
  isVehicleShiftResetReason
} from '../turn/vehicle/shift-tuning.js';

const flowShiftSource = await fs.readFile(new URL('../turn/vehicle/flow-shift.js', import.meta.url), 'utf8');
assert.equal(FLOW_SHIFT_MIN_MULTIPLIER, 3, 'FLOW SHIFT must activate at FLOW ×3');
assert.equal(isGreatFlow(2), false, 'FLOW ×2 must remain ordinary SHIFT');
assert.equal(isGreatFlow(3), true, 'FLOW ×3 must activate FLOW SHIFT');
assert.ok(flowShiftSource.includes("showCompactRacePill(nextGreatFlow ? 'FLOW SHIFT ACTIVE' : 'FLOW SHIFT LOST'"),
  'SUPERCAR must announce FLOW SHIFT threshold activation and loss through the compact race pill');
assert.match(flowShiftSource, /perkId: 'flow-shift'/,
  'FLOW SHIFT activation and loss pills wear FLOW SHIFT’s rarity, LEGENDARY yellow (#1273)');

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
  eventTarget.emit('turn:flow-score-event', { type: 'score', multiplier: 3 });
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
    eventTarget.emit('turn:flow-score-event', { type: 'score', multiplier: 3 });
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

// #1172: BOOST is kept in seconds across a SHIFT; a full bar shifting to a smaller tank
// with more BOOST POWER turns what no longer fits into loose OVERCHARGE.
{
  const { BOOST_OVERCHARGE_MAX_SECONDS, transferBoostAcrossShift } = await import('../turn/input/boost-overcharge.js');
  const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} vs ${expected}`);
  const bigger = transferBoostAcrossShift({ charge: 1, fromSeconds: 4, toSeconds: 5, fromPower: 3, toPower: 2, overchargeOn: true });
  near(bigger.charge, 0.8, 'A bigger tank keeps the seconds, so it is part full: SHIFT never tops BOOST up');
  assert.equal(bigger.converted, 0);
  const stronger = transferBoostAcrossShift({ charge: 1, fromSeconds: 5, toSeconds: 4.7, fromPower: 2, toPower: 3, overchargeOn: true });
  near(stronger.charge, 1, 'The smaller tank is full');
  near(stronger.converted, 0.3 / BOOST_OVERCHARGE_MAX_SECONDS, 'What no longer fits becomes OVERCHARGE, 0.6 s to a full one');
  assert.equal(transferBoostAcrossShift({ charge: 1, fromSeconds: 5, toSeconds: 4.7, fromPower: 3, toPower: 3, overchargeOn: true }).converted, 0,
    'No more BOOST POWER: the overflow is lost, as before');
  assert.equal(transferBoostAcrossShift({ charge: 1, fromSeconds: 5, toSeconds: 4.7, fromPower: 2, toPower: 3, overchargeOn: false }).converted, 0,
    'Before OVERCHARGE unlocks (DRIFT ATTACK), nothing converts');
  assert.equal(transferBoostAcrossShift({ charge: 0.99, fromSeconds: 5, toSeconds: 4.7, fromPower: 2, toPower: 3, overchargeOn: true }).converted, 0,
    'Only a full bar converts, the drift build\'s own test');
  near(transferBoostAcrossShift({ charge: 1, fromSeconds: 5, toSeconds: 4.7, fromPower: 2, toPower: 3, overcharge: 0.8, overchargeOn: true }).overcharge, 1,
    'OVERCHARGE caps at full');
  // Shifting back and forth on one bar mints nothing more.
  let charge = 1;
  let overcharge = 0;
  let minted = 0;
  for (let i = 0; i < 6; i += 1) {
    const toSmall = i % 2 === 0;
    const step = transferBoostAcrossShift({
      charge,
      overcharge,
      fromSeconds: toSmall ? 5 : 4.7,
      toSeconds: toSmall ? 4.7 : 5,
      fromPower: toSmall ? 2 : 3,
      toPower: toSmall ? 3 : 2,
      overchargeOn: true
    });
    ({ charge, overcharge } = step);
    minted += step.converted;
  }
  near(minted, 0.3 / BOOST_OVERCHARGE_MAX_SECONDS, 'One conversion per full bar, however often the player shifts');

  const controlsSource = await fs.readFile(new URL('../turn/ui/gameplay-controls.js', import.meta.url), 'utf8');
  assert.match(controlsSource, /applyShiftMode\(!shiftActive, \{ announce, transferBoost: true \}\)/,
    'Only a player SHIFT moves BOOST between tanks, never a reset or a profile change');
  assert.match(controlsSource, /const overchargeNote = shiftOverchargeGain > 0 \? ' \+OVERCHARGE\.' : '';/,
    'The SHIFT announcement names the OVERCHARGE it made');
  assert.match(controlsSource, /boostOverchargePhase = BOOST_OVERCHARGE_PHASE\.DECAYING;\n      previousOverchargeCaughtForOutcome = true;/,
    'Loose like drift-built OVERCHARGE, and not a CATCH of its own');
}

console.log('TURN FLOW SHIFT authoritative tuning transition regression passed.');
