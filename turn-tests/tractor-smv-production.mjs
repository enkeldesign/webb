import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  SMV_SHIFT_SPEED_LIMITS_KMH,
  SMV_SPEED_LIMITS_KMH,
  getSmvPropulsiveSpeedLimit
} from '../turn/vehicle/physics.js';
import { shiftedVehicleStats } from '../turn/vehicle/shift-profile.js';

const catalogSource = await fs.readFile(new URL('../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const lotSource = await fs.readFile(new URL('../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8');
const trophyOrderSource = await fs.readFile(new URL('../turn/garage/lot-trophy-order.js', import.meta.url), 'utf8');
const physicsSource = await fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8');

assert.match(catalogSource, /\['tractor', 'Tractor', 'car', \{ speed: 1, acceleration: 1, control: 5, drift: 1, boostPower: 5, boostDuration: 5 \}/);
assert.match(catalogSource, /tractor: Object\.freeze\(\{[\s\S]*title: 'SMV'[\s\S]*blank screen and non-visual driving practice/);
assert.match(catalogSource, /tractor: Object\.freeze\(\{ fallback: '#4f7f36' \}\)/);
assert.match(catalogSource, /tractor: Object\.freeze\(\{ fallback: '#666000' \}\)/);
assert.match(lotSource, /'classic',[\s\S]*'tractor',[\s\S]*'truck'/);
assert.match(trophyOrderSource, /'classic',[\s\S]*'tractor',[\s\S]*'truck'/,
  'The enhanced Trophy Road order must keep Learner Car first and Tractor second');

assert.deepEqual(SMV_SPEED_LIMITS_KMH, { drift: 40, gas: 60, boost: 80 });
assert.deepEqual(SMV_SHIFT_SPEED_LIMITS_KMH, { drift: 50, gas: 70, boost: 90 });

const smvLimit = (input = {}) => getSmvPropulsiveSpeedLimit({
  vehicleId: 'tractor',
  perkUnlocked: true,
  ...input
});
const approximately = (actual, expected, message) => {
  assert.ok(
    Math.abs(actual - expected) < 1e-12,
    message + ': expected ' + expected + ', got ' + actual
  );
};

approximately(smvLimit({ driftHeld: true }), 40 / 2.9, 'Base DRIFT ceiling');
approximately(smvLimit({ throttle: 1 }), 60 / 2.9, 'Base GAS ceiling');
approximately(smvLimit({ boostActive: true, throttle: 1 }), 80 / 2.9, 'Base BOOST ceiling');
approximately(smvLimit({ driftHeld: true, shiftActive: true }), 50 / 2.9, 'SHIFT DRIFT ceiling');
approximately(smvLimit({ throttle: 1, shiftActive: true }), 70 / 2.9, 'SHIFT GAS ceiling');
approximately(smvLimit({ boostActive: true, throttle: 1, shiftActive: true }), 90 / 2.9, 'SHIFT BOOST ceiling');
assert.equal(getSmvPropulsiveSpeedLimit({ vehicleId: 'tractor', perkUnlocked: false, throttle: 1 }), Infinity,
  'SMV ceilings must be perk-owned');
assert.equal(getSmvPropulsiveSpeedLimit({ vehicleId: 'classic', perkUnlocked: true, throttle: 1 }), Infinity,
  'SMV ceilings must not affect other vehicles');
assert.equal(smvLimit(), Infinity, 'Coasting must not impose an SMV speed clamp');

const tractorBaseStats = Object.freeze({
  speed: 1,
  acceleration: 1,
  control: 5,
  drift: 1,
  boostPower: 5,
  boostDuration: 5
});
assert.deepEqual(
  shiftedVehicleStats(tractorBaseStats, ['control', 'boostPower', 'boostDuration']),
  { speed: 2, acceleration: 2, control: 4, drift: 2, boostPower: 4, boostDuration: 4 },
  'Tractor generic SHIFT must produce the intended intermediate difficulty profile'
);

assert.match(physicsSource, /Math\.max\(0, smvPropulsiveLimit - Math\.max\(0, forwardSpeed\)\)/,
  'SMV must limit only newly added propulsion when already above the ceiling');
assert.match(physicsSource, /Math\.min\(propulsionStep, availablePropulsion\)/,
  'SMV propulsion must stop at the available ceiling without clamping existing momentum');

console.log('TURN Tractor SMV catalog, ordering, direct speed-limit and SHIFT behavior checks passed.');
