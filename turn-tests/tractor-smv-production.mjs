import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const physicsSource = await fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8');
const catalogSource = await fs.readFile(new URL('../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const lotSource = await fs.readFile(new URL('../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8');
const shiftSource = await fs.readFile(new URL('../turn/vehicle/shift-profile.js', import.meta.url), 'utf8');

assert.match(catalogSource, /\['tractor', 'Tractor', 'car', \{ speed: 1, acceleration: 1, control: 5, drift: 1, boostPower: 5, boostDuration: 5 \}/);
assert.match(catalogSource, /tractor: Object\.freeze\(\{[\s\S]*title: 'SMV'[\s\S]*blank screen and non-visual driving practice/);
assert.match(catalogSource, /tractor: Object\.freeze\(\{ fallback: '#4f7f36' \}\)/);
assert.match(catalogSource, /tractor: Object\.freeze\(\{ fallback: '#ffcc00'/);
assert.match(lotSource, /'sedan-sports',[\s\S]*'tractor',[\s\S]*'race',[\s\S]*'vintage-racer'/);
assert.match(physicsSource, /drift: 50,[\s\S]*gas: 75,[\s\S]*boost: 100/);
assert.match(physicsSource, /getSmvPropulsiveSpeedLimit/);
assert.match(physicsSource, /Math\.max\(0, smvPropulsiveLimit - Math\.max\(0, forwardSpeed\)\)/,
  'SMV must limit added propulsion without clamping away existing momentum');
assert.match(physicsSource, /Math\.min\(propulsionStep, availablePropulsion\)/);
assert.match(shiftSource, /const SHIFT_AMOUNT = 1/);

const tractorBase = [1, 1, 5, 1, 5, 5];
const shifted = tractorBase.map((value, index) => index === 0 || index === 1 || index === 3 ? value + 1 : value - 1);
assert.deepEqual(shifted, [2, 2, 4, 2, 4, 4], 'Tractor generic SHIFT step must produce the intended intermediate difficulty profile');
assert.equal(shifted.reduce((sum, value) => sum + value, 0), 18);

console.log('TURN Tractor SMV catalog, Lot order, propulsion ceilings and SHIFT profile checks passed.');
