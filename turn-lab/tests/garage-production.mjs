import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');

const catalogSource = await fs.readFile(path.join(turnDir, 'vehicle/catalog.js'), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

const expectedIds = [
  'convertible',
  'classic',
  'vintage-racer',
  'toy-racer',
  'monster-truck',
  'race-future',
  'race',
  'sedan-sports',
  'sedan',
  'suv',
  'suv-luxury',
  'hatchback-sports',
  'truck-flat',
  'truck',
  'van'
];

assert.equal(catalog.CAR_CATALOG.length, 15, 'The Lot must contain exactly 15 cars');
assert.deepEqual(catalog.CAR_CATALOG.map((car) => car.id), expectedIds, 'The Lot car order changed unexpectedly');

for (const id of expectedIds) {
  await fs.access(path.join(turnDir, `assets/cars/${id}.glb`));
}

const brickFiles = (await fs.readdir(path.join(turnDir, 'assets/lot-bricks')))
  .filter((file) => file.endsWith('.glb'));
assert.equal(brickFiles.length, 9, 'The Lot should ship with nine compact Brick Kit props');

const sedan = catalog.getCarDefinition('sedan');
const race = catalog.getCarDefinition('race');
const truck = catalog.getCarDefinition('truck');

assert.equal(sedan.tuning.topSpeedMultiplier, 1, 'Sedan top speed must remain the v1.0 baseline');
assert.equal(sedan.tuning.accelerationMultiplier, 1, 'Sedan acceleration must remain the v1.0 baseline');
assert.equal(sedan.tuning.controlMultiplier, 1, 'Sedan control must remain the v1.0 baseline');
assert.equal(sedan.tuning.driftEngineMultiplier, 0.93, 'Sedan drift engine retention must remain the v1.0 baseline');
assert.equal(sedan.tuning.driftDragAdd, 0.085, 'Sedan drift drag must remain the v1.0 baseline');
assert.equal(sedan.tuning.boostPowerMultiplier, 1, 'Sedan boost power must remain the v1.0 baseline');
assert.equal(sedan.tuning.boostSpeedMultiplier, 1.32, 'Sedan boost speed must remain the v1.0 baseline');
assert.equal(sedan.tuning.boostDurationSeconds, 2, 'Sedan boost tank must remain the v1.0 baseline');

assert.ok(race.tuning.topSpeedMultiplier > sedan.tuning.topSpeedMultiplier, 'Race car should have more top speed than Sedan');
assert.ok(race.tuning.accelerationMultiplier > sedan.tuning.accelerationMultiplier, 'Race car should accelerate faster than Sedan');
assert.ok(race.tuning.controlMultiplier > sedan.tuning.controlMultiplier, 'Race car should have more control than Sedan');
assert.ok(race.tuning.driftDragAdd > sedan.tuning.driftDragAdd, 'Race car should pay a larger speed penalty while drifting');
assert.ok(race.tuning.boostPowerMultiplier > sedan.tuning.boostPowerMultiplier, 'Race car should have stronger boost');
assert.ok(race.tuning.boostDurationSeconds < sedan.tuning.boostDurationSeconds, 'Race car should have a shorter boost tank');

assert.ok(truck.tuning.topSpeedMultiplier < sedan.tuning.topSpeedMultiplier, 'Truck should have less top speed than Sedan');
assert.ok(truck.tuning.accelerationMultiplier < sedan.tuning.accelerationMultiplier, 'Truck should accelerate slower than Sedan');
assert.ok(truck.tuning.driftDragAdd < sedan.tuning.driftDragAdd, 'Truck should retain more speed while drifting');
assert.ok(truck.tuning.boostPowerMultiplier < sedan.tuning.boostPowerMultiplier, 'Truck boost should be weaker than Sedan');
assert.ok(truck.tuning.boostDurationSeconds > sedan.tuning.boostDurationSeconds, 'Truck should have a longer boost tank');

const lighterGhost = catalog.makeGhostColor('#ff4fa3');
assert.notEqual(lighterGhost, '#ff4fa3', 'Ghost colour should be a lighter nuance, not the original paint colour');

const [index, main, lapSystem, rivalStorage, controls, carModels] = await Promise.all([
  fs.readFile(path.join(turnDir, 'index.html'), 'utf8'),
  fs.readFile(path.join(turnDir, 'main.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/lap-system.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/rival-storage.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/gameplay-controls.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle/car-models.js'), 'utf8')
]);

assert.match(index, /TURN v1\.1\.2 · Build 2026\.07\.19-r11/);
assert.match(index, /\.\/garage\/lot-r10\.css\?build=20260719-r11/);
assert.match(main, /await showTheLot\(/, 'Start flow must enter The Lot before racing');
assert.match(main, /maxSpeed: MAX_SPEED \* state\.vehicleTuning\.topSpeedMultiplier/, 'Selected top speed must reach physics');
assert.match(main, /vehicleTuning: state\.vehicleTuning/, 'Selected handling profile must reach physics');
assert.doesNotMatch(main, /wayne-wu\/webgpu-crowd-simulation/, 'Production must not depend on the old remote Sedan model');
assert.match(lapSystem, /carId: state\.vehicleId \|\| 'sedan'/, 'Completed laps must remember their car model');
assert.match(lapSystem, /carColor: state\.vehicleColor \|\| '#ffd43b'/, 'Completed laps must remember their paint colour');
assert.match(rivalStorage, /version: 3/, 'Rival storage schema must include vehicle metadata version');
assert.match(rivalStorage, /normalizeVehicleId\(lap\.carId\)/, 'Loaded rivals must normalize stored car ids');
assert.match(rivalStorage, /normalizeVehicleColor\(lap\.carColor\)/, 'Loaded rivals must normalize stored car colours');
assert.match(controls, /boostDurationSeconds/, 'Boost drain must use the selected car boost tank stat');
assert.match(catalogSource, /asset: `\.\/assets\/cars\/\$\{id\}\.glb`/, 'Vehicle catalog must point to vendored local car assets');
assert.match(carModels, /loadCarSource\(car\.id\)/, 'Car model factory must load the catalog-selected vehicle');

const lotR10 = await fs.readFile(path.join(turnDir, 'garage/lot-r10.js'), 'utf8');
const lotR10Css = await fs.readFile(path.join(turnDir, 'garage/lot-r10.css'), 'utf8');
assert.match(main, /garage\/lot-r10\.js/, 'Production must load the r10 Lot module');
assert.match(lotR10, /MUTED_COLOR/, 'Unselected Lot cars must have a muted visual state');
assert.match(lotR10, /selectedColor = DEFAULT_VEHICLE_COLOR/, 'Newly selected cars must return to the default yellow paint');
assert.match(lotR10, /lot-viewbox/, 'The Lot must include a dedicated 3D car viewbox');
assert.match(lotR10, /DRAG TO ROTATE/, 'The 3D car viewer must advertise drag rotation');
assert.match(lotR10Css, /--lot-rail-width/, 'The stats and viewer rail must reserve space beside the parking lot');

const backToLot = await fs.readFile(path.join(turnDir, 'ui/back-to-lot.js'), 'utf8');
assert.match(main, /openLot: openLotFromRace/, 'Race runtime must expose the Back to the Lot action');
assert.match(main, /await showTheLot\(/, 'Back to the Lot must reuse the real Lot selector');
assert.match(backToLot, /Back to the Lot/, 'Race UI must include the Back to the Lot button');
assert.match(backToLot, /insertAdjacentElement\('afterend'/, 'Back to the Lot button must sit next to Reset Car');

console.log('TURN garage production regression passed.');
