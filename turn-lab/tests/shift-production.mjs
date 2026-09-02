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
  blockedVehicleShiftReducers,
  isVehicleShiftConfigurationValid,
  loadVehicleShiftProfile,
  requiredVehicleShiftReducers,
  saveVehicleShiftProfile,
  setVehicleShiftProfileEnabled,
  shiftedVehicleStats,
  vehicleStatsSupportShift
} from '../../turn/vehicle/shift-profile.js';
import {
  advanceShiftTopSpeedMultiplier,
  pointerUsesShiftToggle
} from '../../turn/input/shift-toggle.js';
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
assert.deepEqual(shiftedVehicleStats(raceCar.stats, mountainShiftReducers), {
  speed: 4,
  acceleration: 3,
  control: 5,
  drift: 3,
  boostPower: 1,
  boostDuration: 2
});
assert.equal(shiftedVehicleStats(raceCar.stats, ['acceleration', 'control', 'drift']), null,
  'A five-point attribute must donate because SHIFT cannot raise it above five');

const learner = getCarDefinition('classic');
assert.deepEqual(requiredVehicleShiftReducers(learner.stats), ['control', 'drift', 'boostDuration']);
assert.deepEqual(blockedVehicleShiftReducers(learner.stats), ['speed', 'acceleration', 'boostPower']);
assert.deepEqual(shiftedVehicleStats(learner.stats, requiredVehicleShiftReducers(learner.stats)), {
  speed: 2,
  acceleration: 2,
  control: 4,
  drift: 4,
  boostPower: 2,
  boostDuration: 4
});

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

const easedTopSpeed = advanceShiftTopSpeedMultiplier(1.12, 1.06, 0.25);
assert.ok(easedTopSpeed < 1.12 && easedTopSpeed > 1.06,
  'Lowering the top-speed cap must begin gradually instead of snapping');
assert.equal(advanceShiftTopSpeedMultiplier(easedTopSpeed, 1.06, 1), 1.06);
assert.equal(advanceShiftTopSpeedMultiplier(1.06, 1.12, 0.01), 1.12,
  'Raising the top-speed cap may apply immediately');

const [lotShift, lotRuntime, lotStyles, controls, driveStyles, workflow] = await Promise.all([
  fs.readFile(new URL('../../turn/garage/lot-shift.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-enhancement-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-shift.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/drive-pad.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8')
]);

assert.match(lotRuntime, /installLotShift/);
assert.match(lotShift, /Choose three attributes to lower by one/);
assert.match(lotShift, /class="lot-shift-options" role="group"/);
assert.match(lotShift, /setVehicleShiftProfileEnabled/);
assert.match(lotShift, /turn:shift-profile-change/);
assert.match(lotStyles, /\.lot-shift-trigger\.is-active/);
assert.match(lotStyles, /\.lot-shift-dialog::backdrop/);
assert.match(lotStyles, /prefers-reduced-motion: reduce/);

assert.match(controls, /className = 'drive-shift-bubble'/);
assert.match(controls, /setAttribute\('aria-pressed', String\(shiftActive\)\)/);
assert.match(controls, /pointerUsesShiftToggle/);
assert.match(controls, /shiftToggledThisGesture/,
  'A held GAS gesture must toggle SHIFT only once even if the pointer re-enters its bubble');
assert.match(controls, /reason === 'race-started'[\s\S]*syncShiftAvailability\(\{ reset: true \}\)/,
  'Every race must begin in the standard setup');
assert.match(controls, /globalThis\.__turnBoostCharge = boostCharge/,
  'Boost remains normalized as a charge percentage while SHIFT changes tank duration');
assert.match(driveStyles, /\.drive-stack\.is-shift-active \.drive-shift-bubble[\s\S]*#9775fa/);
assert.match(driveStyles, /\.drive-stack\.is-shift-active \.drive-shift-bubble i[\s\S]*opacity: 1/);
assert.match(driveStyles, /\.controls \.drive-shift-bubble \{[\s\S]*pointer-events: none/,
  'A retracted SHIFT button must not intercept the drive surface through the global control-button rule');
assert.match(driveStyles, /turn-left-handed-controls \.drive-shift-bubble/);
assert.match(workflow, /node turn-lab\/tests\/shift-production\.mjs/);

console.log('TURN SHIFT reward, per-car setup, GAS-slide toggle and live tuning contract passed.');
