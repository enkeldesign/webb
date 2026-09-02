import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  CAR_CATALOG,
  deriveVehicleTuningForCar,
  getCarDefinition,
  getVehicleStatTotal
} from '../../turn/vehicle/catalog.js';
import {
  VEHICLE_SHIFT_FEATURE_ID,
  VEHICLE_SHIFT_STAT_KEYS,
  VEHICLE_SHIFT_STORAGE_KEY,
  blockedVehicleShiftReceivers,
  blockedVehicleShiftReducers,
  isVehicleShiftConfigurationValid,
  loadVehicleShiftProfile,
  requiredVehicleShiftReceivers,
  requiredVehicleShiftReducers,
  saveVehicleShiftProfile,
  setVehicleShiftProfileEnabled,
  shiftedVehicleStats,
  shiftedVehicleStatsFromReceivers,
  vehicleShiftReceiversForReducers,
  vehicleShiftReducersForReceivers,
  vehicleStatsSupportShift
} from '../../turn/vehicle/shift-profile.js';
import {
  advanceShiftTopSpeedMultiplier,
  enteredShiftToggle,
  pointerUsesShiftToggle
} from '../../turn/input/shift-toggle.js';
import {
  VEHICLE_SHIFT_LEVER_STATES,
  resolveVehicleShiftGearbox
} from '../../turn/garage/lot-shift-gearbox.js';
import {
  getTrophyRoadReward,
  isFeatureUnlocked,
  rewardForFeature,
  rewardIdsForTrophies
} from '../../turn/progression/trophy-road.js';
import {
  TROPHY_ROAD_REWARDS as PRODUCTION_TROPHY_ROAD_REWARDS
} from '../../turn/progression/trophy-road-perks-r164.js';

function createMemoryStorage(initial = {}) {
  const memory = new Map(Object.entries(initial));
  return {
    getItem(key) { return memory.get(key) ?? null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
  };
}

function reducerCombinations() {
  const combinations = [];
  for (let first = 0; first < VEHICLE_SHIFT_STAT_KEYS.length - 2; first += 1) {
    for (let second = first + 1; second < VEHICLE_SHIFT_STAT_KEYS.length - 1; second += 1) {
      for (let third = second + 1; third < VEHICLE_SHIFT_STAT_KEYS.length; third += 1) {
        combinations.push([
          VEHICLE_SHIFT_STAT_KEYS[first],
          VEHICLE_SHIFT_STAT_KEYS[second],
          VEHICLE_SHIFT_STAT_KEYS[third]
        ]);
      }
    }
  }
  return combinations;
}

assert.equal(VEHICLE_SHIFT_FEATURE_ID, 'vehicle-shift');
assert.equal(rewardForFeature(VEHICLE_SHIFT_FEATURE_ID)?.id, 'shift');
assert.equal(getTrophyRoadReward('shift')?.threshold, 1500);
assert.equal(PRODUCTION_TROPHY_ROAD_REWARDS.find(({ id }) => id === 'shift')?.threshold, 1500);
assert.equal(rewardIdsForTrophies(1499).includes('shift'), false);
assert.equal(rewardIdsForTrophies(1500).includes('shift'), true);

const lockedStorage = createMemoryStorage();
const unlockedStorage = createMemoryStorage({
  'turn-achievements-v1': JSON.stringify({
    version: 6,
    unlocked: {},
    seen: [],
    progress: { tracks: [], blankTracks: [] },
    rewards: { unlocked: ['shift'], seen: [] }
  })
});
assert.equal(isFeatureUnlocked(VEHICLE_SHIFT_FEATURE_ID, lockedStorage), false);
assert.equal(isFeatureUnlocked(VEHICLE_SHIFT_FEATURE_ID, unlockedStorage), true);

const combinations = reducerCombinations();
assert.equal(combinations.length, 20, 'Six attributes must yield exactly twenty complementary SHIFT setups');
for (const car of CAR_CATALOG) {
  assert.equal(vehicleStatsSupportShift(car.stats), true, `${car.name} must use the legal 18-point scale`);
  const legal = combinations.filter((reducedStats) => isVehicleShiftConfigurationValid(car.stats, reducedStats));
  assert.ok(legal.length > 0, `${car.name} must have at least one legal SHIFT setup`);
  for (const reducedStats of legal) {
    const shifted = shiftedVehicleStats(car.stats, reducedStats);
    assert.equal(getVehicleStatTotal(shifted), 18, `${car.name} SHIFT must preserve the 18-point budget`);
    assert.ok(VEHICLE_SHIFT_STAT_KEYS.every((key) => shifted[key] >= 1 && shifted[key] <= 5));
  }
}

const raceCar = getCarDefinition('race');
const mountainShiftReducers = ['speed', 'acceleration', 'boostPower'];
const mountainShiftReceivers = ['control', 'drift', 'boostDuration'];
assert.deepEqual(shiftedVehicleStats(raceCar.stats, mountainShiftReducers), {
  speed: 4,
  acceleration: 3,
  control: 5,
  drift: 3,
  boostPower: 1,
  boostDuration: 2
});
assert.deepEqual(vehicleShiftReceiversForReducers(mountainShiftReducers), mountainShiftReceivers);
assert.deepEqual(vehicleShiftReducersForReceivers(mountainShiftReceivers), mountainShiftReducers);
assert.deepEqual(
  shiftedVehicleStatsFromReceivers(raceCar.stats, mountainShiftReceivers),
  shiftedVehicleStats(raceCar.stats, mountainShiftReducers),
  'Choosing the three +1 attributes must produce the complementary saved reducer profile'
);
assert.equal(shiftedVehicleStats(raceCar.stats, ['acceleration', 'control', 'drift']), null,
  'A five-point attribute must donate because SHIFT cannot raise it above five');

const learner = getCarDefinition('classic');
assert.deepEqual(requiredVehicleShiftReducers(learner.stats), ['control', 'drift', 'boostDuration']);
assert.deepEqual(blockedVehicleShiftReducers(learner.stats), ['speed', 'acceleration', 'boostPower']);
assert.deepEqual(requiredVehicleShiftReceivers(learner.stats), ['speed', 'acceleration', 'boostPower']);
assert.deepEqual(blockedVehicleShiftReceivers(learner.stats), ['control', 'drift', 'boostDuration']);
assert.deepEqual(shiftedVehicleStats(learner.stats, requiredVehicleShiftReducers(learner.stats)), {
  speed: 2,
  acceleration: 2,
  control: 4,
  drift: 4,
  boostPower: 2,
  boostDuration: 4
});

const gearboxExample = {
  speed: 2,
  acceleration: 4,
  control: 1,
  drift: 5,
  boostPower: 2,
  boostDuration: 4
};
const defaultGearbox = resolveVehicleShiftGearbox(gearboxExample);
assert.equal(defaultGearbox?.complete, false);
assert.deepEqual(defaultGearbox?.selectedReceivers, ['control']);
assert.deepEqual(defaultGearbox?.levers.map(({ state }) => state), [
  VEHICLE_SHIFT_LEVER_STATES.NEUTRAL,
  VEHICLE_SHIFT_LEVER_STATES.NEUTRAL,
  VEHICLE_SHIFT_LEVER_STATES.GAIN,
  VEHICLE_SHIFT_LEVER_STATES.LOSS,
  VEHICLE_SHIFT_LEVER_STATES.NEUTRAL,
  VEHICLE_SHIFT_LEVER_STATES.NEUTRAL
], 'One-point and five-point attributes must begin in their forced lever positions');
assert.deepEqual(defaultGearbox?.levers.map(({ displayValue }) => displayValue), [
  '2', '4', '1→2', '5→4', '2', '4'
]);

const partialGearbox = resolveVehicleShiftGearbox(gearboxExample, ['control', 'speed']);
assert.equal(partialGearbox?.complete, false);
assert.deepEqual(partialGearbox?.selectedReceivers, ['speed', 'control']);
assert.equal(partialGearbox?.levers.find(({ key }) => key === 'speed')?.displayValue, '2→3');
assert.equal(partialGearbox?.levers.find(({ key }) => key === 'boostPower')?.state,
  VEHICLE_SHIFT_LEVER_STATES.NEUTRAL,
  'Undetermined levers must remain centered while fewer than three gains are set');

const completeGearbox = resolveVehicleShiftGearbox(
  gearboxExample,
  ['control', 'speed', 'acceleration']
);
assert.equal(completeGearbox?.complete, true);
assert.deepEqual(completeGearbox?.shiftedStats, {
  speed: 3,
  acceleration: 5,
  control: 2,
  drift: 4,
  boostPower: 1,
  boostDuration: 3
});
assert.deepEqual(completeGearbox?.levers.map(({ state }) => state), [
  VEHICLE_SHIFT_LEVER_STATES.GAIN,
  VEHICLE_SHIFT_LEVER_STATES.GAIN,
  VEHICLE_SHIFT_LEVER_STATES.GAIN,
  VEHICLE_SHIFT_LEVER_STATES.LOSS,
  VEHICLE_SHIFT_LEVER_STATES.LOSS,
  VEHICLE_SHIFT_LEVER_STATES.LOSS
], 'The third upward lever must move every remaining neutral lever down automatically');
assert.deepEqual(completeGearbox?.levers.map(({ displayValue }) => displayValue), [
  '3', '5', '2', '4', '1', '3'
], 'A determined gearbox must show the six final attribute values');
assert.equal(completeGearbox?.levers.find(({ key }) => key === 'boostPower')?.automaticallyLoses, true);
assert.equal(completeGearbox?.levers.find(({ key }) => key === 'boostPower')?.interactive, false);

const revertedGearbox = resolveVehicleShiftGearbox(gearboxExample, ['control', 'speed']);
assert.equal(revertedGearbox?.complete, false);
assert.equal(revertedGearbox?.levers.find(({ key }) => key === 'boostPower')?.state,
  VEHICLE_SHIFT_LEVER_STATES.NEUTRAL,
  'Removing one chosen gain must reset automatically determined losses to neutral');
assert.equal(revertedGearbox?.levers.find(({ key }) => key === 'drift')?.state,
  VEHICLE_SHIFT_LEVER_STATES.LOSS,
  'Removing one chosen gain must preserve a maximum attribute\'s forced loss');

const profileStorage = createMemoryStorage();
const savedRaceShift = saveVehicleShiftProfile({
  vehicleId: raceCar.id,
  stats: raceCar.stats,
  reducedStats: mountainShiftReducers,
  storage: profileStorage
});
assert.equal(savedRaceShift?.enabled, true);
assert.deepEqual(savedRaceShift?.reducedStats, mountainShiftReducers);
assert.deepEqual(loadVehicleShiftProfile(raceCar.id, raceCar.stats, profileStorage), savedRaceShift);
assert.equal(loadVehicleShiftProfile('sedan', getCarDefinition('sedan').stats, profileStorage), null,
  'SHIFT profiles must be saved independently for each car');
const deactivatedRaceShift = setVehicleShiftProfileEnabled(raceCar.id, raceCar.stats, false, profileStorage);
assert.equal(deactivatedRaceShift?.enabled, false);
assert.deepEqual(deactivatedRaceShift?.reducedStats, mountainShiftReducers,
  'Deactivating SHIFT must preserve the saved setup for later reactivation');
assert.match(profileStorage.getItem(VEHICLE_SHIFT_STORAGE_KEY) || '', /"race"/);

const malformedStorage = createMemoryStorage({
  [VEHICLE_SHIFT_STORAGE_KEY]: '{not json'
});
assert.equal(loadVehicleShiftProfile(raceCar.id, raceCar.stats, malformedStorage), null);
const failingStorage = {
  getItem() { return null; },
  setItem() { throw new Error('quota unavailable'); }
};
assert.equal(saveVehicleShiftProfile({
  vehicleId: raceCar.id,
  stats: raceCar.stats,
  reducedStats: mountainShiftReducers,
  storage: failingStorage
}), null, 'SHIFT must not claim a profile was saved when storage rejected the write');

const shiftedRaceTuning = deriveVehicleTuningForCar(
  raceCar.id,
  shiftedVehicleStats(raceCar.stats, mountainShiftReducers)
);
assert.equal(shiftedRaceTuning.overchargeControlMultiplier, raceCar.tuning.overchargeControlMultiplier,
  'SHIFT must retain a car-specific perk while changing its six shared attributes');
assert.ok(shiftedRaceTuning.topSpeedMultiplier < raceCar.tuning.topSpeedMultiplier);
assert.ok(shiftedRaceTuning.controlMultiplier > raceCar.tuning.controlMultiplier);

const rally = getCarDefinition('toy-racer');
const shiftedRallyTuning = deriveVehicleTuningForCar(
  rally.id,
  shiftedVehicleStats(rally.stats, ['speed', 'acceleration', 'drift'])
);
assert.equal(shiftedRallyTuning.driftBoostRechargeMultiplier, 3.6,
  'Rally Racer must keep TWITCHY TURNY in both standard and SHIFT setups');

const leftGeometry = {
  available: true,
  gasActive: true,
  padLeft: 100,
  padRight: 300,
  padTop: 50,
  padHeight: 200,
  bubbleWidth: 60,
  pointerY: 150,
  shiftSide: 'left'
};
assert.equal(pointerUsesShiftToggle({ ...leftGeometry, pointerX: 50 }), true);
assert.equal(pointerUsesShiftToggle({ ...leftGeometry, pointerX: 105 }), false);
assert.equal(pointerUsesShiftToggle({ ...leftGeometry, pointerX: 50, gasActive: false }), false);
assert.equal(pointerUsesShiftToggle({ ...leftGeometry, pointerX: 50, available: false }), false);
assert.equal(pointerUsesShiftToggle({ ...leftGeometry, pointerX: 50, pointerY: 90 }), false);
assert.equal(pointerUsesShiftToggle({ ...leftGeometry, pointerX: 350, shiftSide: 'right' }), true);
assert.equal(pointerUsesShiftToggle({ ...leftGeometry, pointerX: 295, shiftSide: 'right' }), false);

let wasInsideShift = false;
let shiftEntries = 0;
for (const isInsideShift of [false, true, true, false, true]) {
  if (enteredShiftToggle(wasInsideShift, isInsideShift)) shiftEntries += 1;
  wasInsideShift = isInsideShift;
}
assert.equal(shiftEntries, 2,
  'Returning to GAS and crossing into SHIFT again must toggle a second time without lifting the pointer');

const easedTopSpeed = advanceShiftTopSpeedMultiplier(1.12, 1.06, 0.25);
assert.ok(easedTopSpeed < 1.12 && easedTopSpeed > 1.06,
  'Lowering the top-speed cap must begin gradually instead of snapping');
assert.equal(advanceShiftTopSpeedMultiplier(easedTopSpeed, 1.06, 1), 1.06);
assert.equal(advanceShiftTopSpeedMultiplier(1.06, 1.12, 0.01), 1.12,
  'Raising the top-speed cap may apply immediately');

const [lotShift, lotGearbox, lotRuntime, lotStyles, controls, driveStyles, workflow] = await Promise.all([
  fs.readFile(new URL('../../turn/garage/lot-shift.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-shift-gearbox.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-shift.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

assert.match(lotRuntime, /installLotShift/);
assert.match(lotShift, /Move three attribute levers up by 1/);
assert.match(lotShift, /class="lot-shift-options" role="group"/);
assert.match(lotShift, /document\.createElement\('button'\)/,
  'SHIFT attributes must be presented as direct toggle buttons');
assert.match(lotShift, /class="lot-shift-lever"/);
assert.match(lotShift, /dataset\.leverState/,
  'Each SHIFT button must expose its resolved lever position to the rendered interface');
assert.match(lotShift, /selectedReceivers/,
  'The setup interaction must select the attributes receiving +1');
assert.match(lotGearbox, /automaticallyLoses/);
assert.match(lotGearbox, /displayValue/);
assert.match(lotShift, /setVehicleShiftProfileEnabled/);
assert.match(lotShift, /turn:shift-profile-change/);
assert.match(lotStyles, /\.lot-shift-trigger\.is-active/);
assert.match(lotStyles, /\.lot-shift-dialog::backdrop/);
assert.match(lotStyles, /grid-template-columns: repeat\(6/,
  'The landscape gearbox must keep all six levers in one row');
assert.match(lotStyles, /\.lot-shift-option\.is-gain \.lot-shift-lever-knob/);
assert.match(lotStyles, /\.lot-shift-option\.is-loss \.lot-shift-lever-knob/);
assert.match(lotStyles, /background: #4dabf7/,
  'Neutral levers must have a distinct blue middle state');
assert.match(lotStyles, /background: #69db7c/,
  'Upward levers must have a distinct green state');
assert.match(lotStyles, /background: #ff8787/,
  'Downward levers must have a distinct red state');
assert.match(lotStyles, /prefers-reduced-motion: reduce/);

assert.match(controls, /className = 'drive-shift-bubble'/);
assert.match(controls, /shiftBubble\.innerHTML = '<span>SHIFT<i aria-hidden="true">●<\/i><\/span>'/,
  'SHIFT and its active dot must share one centered label');
assert.match(controls, /setAttribute\('aria-pressed', String\(shiftActive\)\)/);
assert.match(controls, /pointerUsesShiftToggle/);
assert.match(controls, /enteredShiftToggle\(shiftPointerInside, input\.shiftRequested\)/,
  'Every new GAS-to-SHIFT crossing must toggle the setup');
assert.doesNotMatch(controls, /shiftToggledThisGesture/,
  'SHIFT must not stay locked out until finger-up');
assert.match(controls, /reason === 'race-started'[\s\S]*syncShiftAvailability\(\{ reset: true \}\)/,
  'Every race must begin in the standard setup');
assert.match(controls, /globalThis\.__turnBoostCharge = boostCharge/,
  'Boost remains normalized as a charge percentage while SHIFT changes tank duration');
assert.match(driveStyles, /\.controls \.drive-shift-bubble[\s\S]*background: #8ce99a/,
  'The ready SHIFT bubble must be green');
assert.match(driveStyles, /\.drive-stack\.is-shift-active \.drive-shift-bubble[\s\S]*#51cf66/,
  'The active SHIFT bubble must be darker green');
assert.match(driveStyles, /\.drive-stack\.is-shift-active \.drive-shift-bubble i[\s\S]*opacity: 1/);
assert.match(driveStyles, /\.drive-shift-bubble span \{[\s\S]*display: inline-flex;[\s\S]*justify-content: center;/,
  'The vertical SHIFT label must stay centered inside its attached bubble');
assert.match(driveStyles, /\.controls \.drive-shift-bubble \{[\s\S]*pointer-events: none/,
  'A retracted SHIFT button must not intercept the drive surface through the global control-button rule');
assert.match(driveStyles, /turn-left-handed-controls \.drive-shift-bubble/);
assert.match(workflow, /node turn-lab\/tests\/shift-production\.mjs/);

console.log('TURN SHIFT gearbox, per-car setup, GAS-slide toggle and live tuning contract passed.');
