import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const catalogSource = await fs.readFile(path.join(turnDir, 'vehicle/catalog.js'), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const expectedIds = [
  'convertible', 'classic', 'vintage-racer', 'toy-racer', 'monster-truck',
  'race-future', 'race', 'sedan-sports', 'compact', 'tractor', 'sedan', 'suv', 'firetruck',
  'police', 'ambulance', 'truck', 'van', 'supercar'
];

assert.equal(catalog.CAR_CATALOG.length, 18, 'The Lot must contain exactly 18 cars');
assert.deepEqual(catalog.CAR_CATALOG.map((car) => car.id), expectedIds, 'The Lot car order changed unexpectedly');
for (const car of catalog.CAR_CATALOG) {
  if (car.id === 'supercar') {
    await fs.access(path.join(turnDir, 'assets/cars/supercar-model-data.js'));
    for (let chunk = 1; chunk <= 5; chunk += 1) {
      await fs.access(path.join(turnDir, `assets/cars/supercar-data-${chunk}.js`));
    }
    continue;
  }
  await fs.access(path.join(turnDir, car.asset.replace(/^\.\//, '')));
}
const brickFiles = (await fs.readdir(path.join(turnDir, 'assets/lot-bricks'))).filter((file) => file.endsWith('.glb'));
assert.equal(brickFiles.length, 9, 'The vendored Kenney Brick Kit subset must remain available');

const sedan = catalog.getCarDefinition('sedan');
const race = catalog.getCarDefinition('race');
const truck = catalog.getCarDefinition('truck');
const monsterTruck = catalog.getCarDefinition('monster-truck');
const vintageRacer = catalog.getCarDefinition('vintage-racer');
const rallyRacer = catalog.getCarDefinition('toy-racer');
const futureRacer = catalog.getCarDefinition('race-future');
const learnerCar = catalog.getCarDefinition('classic');
const tractor = catalog.getCarDefinition('tractor');
const supercar = catalog.getCarDefinition('supercar');
assert.equal(catalog.DEFAULT_VEHICLE_ID, 'classic');
assert.equal(learnerCar.name, 'Learner Car');
assert.equal(learnerCar.pack, 'car');
assert.equal(learnerCar.asset, './assets/cars/training-car.glb');
assert.equal(learnerCar.surfaceProfileId, 'training-car');
assert.equal(learnerCar.defaultColor, '#ffcc00');
assert.equal(learnerCar.defaultSecondaryColor, '#222222');
assert.equal(tractor.name, 'Tractor');
assert.equal(tractor.pack, 'car');
assert.equal(tractor.asset, './assets/cars/tractor.glb');
assert.equal(tractor.surfaceProfileId, 'tractor');
assert.equal(tractor.defaultColor, '#4f7f36');
assert.equal(tractor.defaultSecondaryColor, '#666000');
assert.equal(tractor.perk?.title, 'SMV');
assert.equal(
  tractor.perk?.description,
  'A Slow-Moving Vehicle that’s not much to look at. Which makes it ideal for blank screen and non-visual driving practice.'
);
assert.deepEqual(
  tractor.stats,
  { speed: 1, acceleration: 1, control: 5, drift: 1, boostPower: 5, boostDuration: 5 }
);
assert.equal(vintageRacer.name, 'Vintage Racer');
assert.equal(vintageRacer.perk?.title, 'DRIFTAGE');
assert.equal(rallyRacer.id, 'toy-racer', 'Rally Racer must preserve the Toy Racer stable storage/ghost id');
assert.equal(rallyRacer.name, 'Rally Racer');
assert.equal(rallyRacer.perk?.title, 'TWITCHY TURNY');
assert.equal(monsterTruck.perk?.title, 'OVERSIZED');
assert.equal(futureRacer.perk?.title, 'OVERDRIVE');
assert.equal(supercar.name, 'Supercar');
assert.equal(supercar.pack, 'cosmo');
assert.equal(supercar.perk?.title, 'FLOW SHIFT');
assert.deepEqual(
  supercar.stats,
  { speed: 4, acceleration: 4, control: 2, drift: 2, boostPower: 3, boostDuration: 3 }
);
for (const id of ['firetruck', 'police', 'ambulance']) {
  assert.equal(catalog.getCarDefinition(id).perk?.title, 'SIRENS');
}
assert.deepEqual(
  learnerCar.stats,
  { speed: 1, acceleration: 1, control: 5, drift: 5, boostPower: 1, boostDuration: 5 }
);
assert.deepEqual(
  truck.stats,
  { speed: 3, acceleration: 2, control: 4, drift: 4, boostPower: 2, boostDuration: 3 }
);
assert.equal(race.defaultColor, '#5d503f');
assert.equal(race.defaultColorP3, null);
assert.equal(truck.defaultColor, '#b93632');
assert.deepEqual(truck.defaultColorP3, [0.72, 0.12, 0.12]);
assert.equal(monsterTruck.visualScale, 0.83);
assert.equal(sedan.tuning.topSpeedMultiplier, 1);
assert.equal(sedan.tuning.accelerationMultiplier, 1);
assert.equal(sedan.tuning.controlMultiplier, 1);
assert.equal(sedan.tuning.driftEngineMultiplier, 0.86);
assert.equal(sedan.tuning.driftDragAdd, 0.1);
assert.equal(sedan.tuning.driftSpeedMultiplier, 0.84);
assert.equal(sedan.tuning.driftStabilityMultiplier, 1);
assert.equal(sedan.tuning.boostPowerMultiplier, 1);
assert.equal(sedan.tuning.boostSpeedMultiplier, 1.32);
assert.equal(sedan.tuning.boostDurationSeconds, 2.3);
assert.ok(race.tuning.topSpeedMultiplier > sedan.tuning.topSpeedMultiplier);
assert.ok(race.tuning.accelerationMultiplier > sedan.tuning.accelerationMultiplier);
assert.ok(race.tuning.controlMultiplier > sedan.tuning.controlMultiplier);
assert.ok(race.tuning.driftDragAdd > sedan.tuning.driftDragAdd);
assert.ok(race.tuning.driftStabilityMultiplier < sedan.tuning.driftStabilityMultiplier);
assert.ok(race.tuning.boostDurationSeconds < sedan.tuning.boostDurationSeconds);
assert.equal(truck.tuning.topSpeedMultiplier, sedan.tuning.topSpeedMultiplier);
assert.ok(truck.tuning.accelerationMultiplier < sedan.tuning.accelerationMultiplier);
assert.ok(truck.tuning.controlMultiplier > sedan.tuning.controlMultiplier);
assert.ok(truck.tuning.driftDragAdd < sedan.tuning.driftDragAdd);
assert.ok(truck.tuning.driftStabilityMultiplier > sedan.tuning.driftStabilityMultiplier);
assert.ok(truck.tuning.boostPowerMultiplier < sedan.tuning.boostPowerMultiplier);
assert.equal(truck.tuning.boostDurationSeconds, sedan.tuning.boostDurationSeconds);
assert.notEqual(catalog.makeGhostColor('#ff4fa3'), '#ff4fa3');

const easterEggSelection = {
  carId: 'sedan-sports',
  color: '#ffd43b',
  secondaryColor: '#666'
};
assert.equal(catalog.normalizeVehicleSecondaryColor('#666'), '#666666');
assert.equal(catalog.isSportsSedanEasterEgg(easterEggSelection), true);
assert.equal(catalog.isSportsSedanEasterEgg({ ...easterEggSelection, carId: 'sedan' }), false);
assert.equal(catalog.isSportsSedanEasterEgg({ ...easterEggSelection, secondaryColor: '#666667' }), false);
assert.deepEqual(catalog.getEffectiveVehicleStats(easterEggSelection), catalog.MAXED_VEHICLE_STATS);
const hiddenTuning = catalog.getEffectiveVehicleTuning(easterEggSelection);
const regularSportSedan = catalog.CAR_CATALOG.find((car) => car.id === 'sedan-sports');
assert.ok(hiddenTuning.topSpeedMultiplier > regularSportSedan.tuning.topSpeedMultiplier);
assert.ok(hiddenTuning.accelerationMultiplier > regularSportSedan.tuning.accelerationMultiplier);
assert.ok(hiddenTuning.controlMultiplier > regularSportSedan.tuning.controlMultiplier);
assert.ok(hiddenTuning.driftStabilityMultiplier > regularSportSedan.tuning.driftStabilityMultiplier);
assert.ok(hiddenTuning.boostPowerMultiplier > regularSportSedan.tuning.boostPowerMultiplier);
assert.ok(hiddenTuning.boostDurationSeconds > regularSportSedan.tuning.boostDurationSeconds);
assert.equal(hiddenTuning.enginePitch, regularSportSedan.tuning.enginePitch);

const originalLocalStorage = globalThis.localStorage;
const vehicleStorage = new Map();
globalThis.localStorage = {
  getItem(key) { return vehicleStorage.has(key) ? vehicleStorage.get(key) : null; },
  setItem(key, value) { vehicleStorage.set(key, String(value)); },
  removeItem(key) { vehicleStorage.delete(key); }
};
try {
  assert.equal(catalog.loadVehicleSelection().carId, 'classic');
  const savedRally = catalog.saveVehicleSelection({ carId: 'toy-racer' });
  assert.equal(savedRally.carId, 'toy-racer');
  assert.equal(catalog.getCarDefinition(savedRally.carId).name, 'Rally Racer');
  const savedEgg = catalog.saveVehicleSelection(easterEggSelection);
  assert.equal(savedEgg.secondaryColor, '#666666');
  assert.deepEqual(catalog.getCarDefinition('sedan-sports').stats, catalog.MAXED_VEHICLE_STATS);
  assert.equal(catalog.getCarDefinition('sedan-sports').tuning, hiddenTuning);
  catalog.saveVehicleSelection({ ...easterEggSelection, secondaryColor: '#777777' });
  assert.deepEqual(catalog.getCarDefinition('sedan-sports').stats, regularSportSedan.stats);
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

const [
  index,
  releaseSource,
  app,
  main,
  home,
  lapSystem,
  lapPolicy,
  rivalStorage,
  controls,
  carModels,
  garage,
  trackIntro,
  trackIntroCss
] = await Promise.all([
  fs.readFile(path.join(turnDir, 'index.html'), 'utf8'),
  fs.readFile(path.join(turnDir, 'release.json'), 'utf8'),
  fs.readFile(path.join(turnDir, 'app.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'main.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'm8-home.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/lap-system.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/lap-system-r86.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/rival-storage.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/gameplay-controls.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle/car-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/garage.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/track-intro.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'track-intro.css'), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (filePath) => `${filePath}?build=${release.cacheKey}`;
const vehicleCatalogTarget = `/turn/vehicle/catalog.js?build=${release.cacheKey}`;
const carModelBridgeTarget = `/turn/vehicle/emergency-livery-models.js?revision=r223-training-car-taxi&build=${release.cacheKey}`;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.doesNotMatch(index, /lot-r10\.css|lot-layout-r60\.css|lot-stat-legend\.css/, 'The Lot stylesheets are retired');
assert.match(index, new RegExp(`\\.\\/track-intro\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`src="\\.\\/app\\.js\\?build=${release.cacheKey}-browser-consent(?:-[^"]+)?"`));
assert.equal(imports['./ui/track-intro.js?build=20260725-r75'], releaseTarget('/turn/ui/track-intro.js'));
assert.ok(
  imports['./race/lap-system.js?build=20260720-r19']?.startsWith(releaseTarget('./race/lap-system-r86.js')),
  'Production must route lap completion through the current Super Sedan policy'
);

// GARAGE replaces The Lot: app.js installs no Lot runtime; main.js and ROADBOOK open GARAGE.
assert.doesNotMatch(app, /lot-layout-r60|sports-sedan-easter-egg|installLotEnhancementRuntime|lot-enhancement-runtime/);
assert.match(main, /const \[\{ prepareGarage, showGarage \}, \{ TRACK_CATALOG \}, \{ trackIconMarkup \}\] = await Promise\.all\(\[\s*import\('\/turn\/garage\/garage\.js'\)/);
// Changing car mid-race (TURN NEXT keeps this route) shows the current track in the
// dock, and Back returns to the race.
assert.match(main, /const track = TRACK_CATALOG\.find\(\(entry\) => entry\.id === state\.trackId\)/);
assert.match(main, /backLabel: options\.entry === 'race' \? 'RACE' : 'BACK'/);
const orchestrator = await fs.readFile(path.join(turnDir, 'race/session-orchestrator.js'), 'utf8');
assert.match(orchestrator, /initialSelection: selectedVehicle\(state\),\s*entry: 'race'/);
assert.match(home, /import\('\/turn\/garage\/garage\.js'\)/);
assert.match(garage, /export function prepareGarage\(/);
assert.match(garage, /export function showGarage\(/);
assert.match(garage, /createGarageSelection\(/, 'GARAGE keeps the saved car, the choice and a locked preview apart');
assert.match(garage, /const reward = rewardForVehicle\(carId\);/, 'Car locks come from Trophy Road');
assert.match(garage, /showTrophyUnlockNotice\(\{ reward: carLock\(car\.id\), itemName: car\.name \}\)/,
  'RACE on a locked car explains its Trophy Road reward');
assert.match(garage, /rewardForVehiclePerk\(car\.id\)/, 'A perk has its own entitlement, separate from the car');
assert.match(garage, /type="color"/);
assert.doesNotMatch(garage, /NAMED_COLOR_PRESETS|color-preset|showPicker\(|label\.click\(/);

assert.match(home, /activateTrack\(trackId, runtime\)/);
assert.match(home, /garageModule\.showGarage\(\{\s*initialSelection: selectedVehicle\(runtime\),/);
assert.match(home, /raceSession\.selectVehicle\(selection\)/);
assert.match(home, /showTrackIntro\(trackId\)/);
assert.match(home, /raceSession\.startGame\(pendingAccess\?\.fullscreenPromise\)/);
assert.match(
  home,
  /await Promise\.all\(\[\s*raceSession\.selectVehicle\(selection\),\s*showTrackIntro\(trackId\)\s*\]\);/
);
assert.ok(home.indexOf('activateTrack(trackId, runtime)') < home.indexOf('garageModule.showGarage({'));
assert.ok(home.indexOf('garageModule.showGarage({') < home.indexOf('raceSession.selectVehicle(selection)'));
assert.ok(home.indexOf('raceSession.selectVehicle(selection)') < home.indexOf('showTrackIntro(trackId)'));
assert.ok(home.indexOf('showTrackIntro(trackId)') < home.indexOf('raceSession.startGame(pendingAccess?.fullscreenPromise)'));
assert.doesNotMatch(home, /chooseTrackBeforeLot/);

assert.match(trackIntro, /TRACK_INTRO_HOLD_MS = 2100/);
assert.match(trackIntro, /getTrackDefinition\(trackId\)/);
assert.match(trackIntro, /track-intro-name'\)\.textContent = track\.name/);
assert.match(trackIntro, /aria-live', 'polite'/);
assert.match(trackIntroCss, /pointer-events: none/);
assert.match(trackIntroCss, /prefers-reduced-motion: reduce/);
assert.match(main, /camera\.position\.set\(0, 110, 215\)/);
assert.match(main, /showRaceSetup: showGarageSetup/);
assert.match(main, /maxSpeed: MAX_SPEED \* state\.vehicleTuning\.topSpeedMultiplier/);
assert.match(main, /vehicleTuning: state\.vehicleTuning/);
assert.doesNotMatch(main, /wayne-wu\/webgpu-crowd-simulation/);

assert.equal(imports['./vehicle/catalog.js?build=20260720-r19'], vehicleCatalogTarget);
assert.equal(imports['./vehicle/catalog.js?build=20260720-r20'], vehicleCatalogTarget);
assert.equal(imports['./vehicle/car-models.js?build=20260720-r19'], carModelBridgeTarget);
assert.equal(imports['./vehicle/car-models.js?build=20260720-r22'], carModelBridgeTarget);
assert.match(lapSystem, /carId: paint\.carId/);
assert.match(lapSystem, /carColor: paint\.color/);
assert.match(lapSystem, /carSecondaryColor: paint\.secondaryColor/);
assert.match(lapSystem, /factoryPaint: paint\.factoryPaint/);
assert.match(lapPolicy, /isSportsSedanEasterEgg/);
assert.match(lapPolicy, /const ranked = !isSportsSedanEasterEgg/);
assert.match(lapPolicy, /saveGhost: ranked \? options\?\.saveGhost : undefined/);
assert.match(rivalStorage, /RIVAL_STORAGE_VERSION = 8/);
assert.match(rivalStorage, /trackRevision: storageTrackId\(activeTrackId\)/);
assert.match(rivalStorage, /normalizeStoredVehiclePaint\(/);
assert.match(rivalStorage, /migrateReplacedFactoryPaint: sourceVersion < RIVAL_STORAGE_VERSION/);
assert.match(controls, /boostDurationSeconds/);
assert.match(controls, /driftBoostRechargeMultiplier/);
assert.match(catalogSource, /MODEL_ASSET_BY_ID\[id\] \|\| `\.\/assets\/cars\/\$\{id\}\.glb`/);
assert.equal(monsterTruck.pack, 'toy', 'Monster Truck must use the retained Kenney Toy Car Kit model');
assert.equal(monsterTruck.asset, './assets/cars/monster-truck.glb');
assert.doesNotMatch(catalogSource, /monster-truck-rgsdev\.glb/,
  'The retired RGSDev Monster Truck must no longer override the Kenney asset');
assert.match(catalogSource, /SPORTS_SEDAN_EASTER_EGG_COLOR = '#666666'/);
assert.match(catalogSource, /MAXED_VEHICLE_STATS/);
assert.match(catalogSource, /'toy-racer', 'Rally Racer'/);
assert.match(catalogSource, /title: 'DRIFTAGE'/);
assert.match(catalogSource, /title: 'TWITCHY TURNY'/);
assert.match(catalogSource, /title: 'SMV'/);
assert.match(carModels, /loadCarSource\(car\.id\)/);
// The secret Sports Car: maxed stats, named, explained beside RACE, never ranked.
assert.match(garage, /getEffectiveVehicleStats\(effectiveSelection\(\)\)/);
assert.match(garage, /isSportsSedanEasterEgg\(selection\.state\(\)\.choice\)/);
assert.match(garage, /SECRET UNLOCKED/);
assert.match(garage, /color code #666/);
assert.match(garage, /Lap results with this secret car are not saved/);
assert.match(garage, /<section class="garage-secret" role="status" aria-live="polite" hidden>/);
assert.match(garage, /raceButton\.setAttribute\('aria-label', `Race \$\{titleCase\(displayName\)\}`\)/,
  'RACE names the secret car too');

console.log(`TURN ${release.id} GARAGE route, Vintage/Rally Trophy Road gating, car-owned perks, native paint and garage setup passed.`);
