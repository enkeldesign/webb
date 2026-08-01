import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const catalogSource = await fs.readFile(path.join(turnDir, 'vehicle/catalog.js'), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const expectedIds = [
  'convertible', 'classic', 'vintage-racer', 'toy-racer', 'monster-truck',
  'race-future', 'race', 'sedan-sports', 'sedan', 'suv', 'suv-luxury',
  'hatchback-sports', 'truck-flat', 'truck', 'van'
];

assert.equal(catalog.CAR_CATALOG.length, 15, 'The Lot must contain exactly 15 cars');
assert.deepEqual(catalog.CAR_CATALOG.map((car) => car.id), expectedIds, 'The Lot car order changed unexpectedly');
for (const id of expectedIds) await fs.access(path.join(turnDir, `assets/cars/${id}.glb`));
const brickFiles = (await fs.readdir(path.join(turnDir, 'assets/lot-bricks'))).filter((file) => file.endsWith('.glb'));
assert.equal(brickFiles.length, 9, 'The vendored Kenney Brick Kit subset must remain available');

const sedan = catalog.getCarDefinition('sedan');
const race = catalog.getCarDefinition('race');
const truck = catalog.getCarDefinition('truck');
const monsterTruck = catalog.getCarDefinition('monster-truck');
const trainingCar = catalog.getCarDefinition('classic');
assert.equal(catalog.DEFAULT_VEHICLE_ID, 'classic');
assert.equal(trainingCar.name, 'Training Car');
assert.deepEqual(
  trainingCar.stats,
  { speed: 1, acceleration: 1, control: 5, drift: 5, boostPower: 1, boostDuration: 5 }
);
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
assert.equal(sedan.tuning.boostDurationSeconds, 2);
assert.ok(race.tuning.topSpeedMultiplier > sedan.tuning.topSpeedMultiplier);
assert.ok(race.tuning.accelerationMultiplier > sedan.tuning.accelerationMultiplier);
assert.ok(race.tuning.controlMultiplier > sedan.tuning.controlMultiplier);
assert.ok(race.tuning.driftDragAdd > sedan.tuning.driftDragAdd);
assert.ok(race.tuning.driftStabilityMultiplier < sedan.tuning.driftStabilityMultiplier);
assert.ok(race.tuning.boostDurationSeconds < sedan.tuning.boostDurationSeconds);
assert.ok(truck.tuning.topSpeedMultiplier < sedan.tuning.topSpeedMultiplier);
assert.ok(truck.tuning.accelerationMultiplier < sedan.tuning.accelerationMultiplier);
assert.ok(truck.tuning.driftDragAdd < sedan.tuning.driftDragAdd);
assert.ok(truck.tuning.driftStabilityMultiplier > sedan.tuning.driftStabilityMultiplier);
assert.ok(truck.tuning.boostDurationSeconds > sedan.tuning.boostDurationSeconds);
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
  lotWrapper,
  lotEnhancementRuntime,
  lotLayout,
  lotLayoutCss,
  lotAccessibility,
  originalLot,
  trackIntro,
  trackIntroCss,
  easterEggUi
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
  fs.readFile(path.join(turnDir, 'garage/lot-track-select.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-enhancement-runtime.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-layout-r60.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-layout-r60.css'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-accessibility-r118.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-r10.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/track-intro.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'track-intro.css'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle/sports-sedan-easter-egg.js'), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (filePath) => `${filePath}?build=${release.cacheKey}`;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`\\.\\/garage\\/lot-r10\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`\\.\\/track-intro\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`src="\\.\\/app\\.js\\?build=${release.cacheKey}-browser-consent"`));
assert.equal(imports['./garage/lot-r10.js?build=20260720-r19'], releaseTarget('./garage/lot-track-select.js'));
assert.equal(imports['./ui/track-intro.js?build=20260725-r75'], releaseTarget('./ui/track-intro.js'));
assert.equal(imports['./race/lap-system.js?build=20260720-r19'], releaseTarget('./race/lap-system-r86.js'));

assert.match(app, /lot-layout-r60\.css\?revision=r121-viewer/);
assert.match(app, /installLotEnhancementRuntime/);
assert.match(app, /lot-enhancement-runtime\.js\?revision=r121/);
assert.ok(app.indexOf('installLotEnhancementRuntime()') < app.indexOf("withBuild('./main.js')"));

assert.match(lotWrapper, /showOriginalLot/);
assert.match(lotWrapper, /export async function showEnhancedLot/);
assert.match(lotWrapper, /enhanceLotNow\(\)/);
assert.match(lotWrapper, /await chooseTrackBeforeLot\(\)/);
assert.match(lotWrapper, /track-manager\.js\?build=20260722-r52/);
assert.doesNotMatch(lotWrapper, /installLotLayout|installLotStatLegend|installLotAccessibility/);
assert.match(originalLot, /export function showTheLot/);

assert.match(lotEnhancementRuntime, /ENHANCEMENT_ID = 'enhanced-lot-r121'/);
assert.match(lotEnhancementRuntime, /activeEnhancements = new WeakMap\(\)/);
assert.match(lotEnhancementRuntime, /installLotStatLegend\(scope\)/);
assert.match(lotEnhancementRuntime, /installLotLayout\(scope\)/);
assert.match(lotEnhancementRuntime, /installLotAccessibility\(scope\)/);
assert.match(lotEnhancementRuntime, /new MutationObserver\(sync\)/);
assert.match(lotEnhancementRuntime, /screen\.dataset\.lotEnhancements = ENHANCEMENT_ID/);

assert.match(lotLayout, /viewbox\.appendChild\(colors\)/);
assert.match(lotLayout, /attributesHeading\.replaceChildren\(document\.createTextNode\('ATTRIBUTES'\)\)/);
assert.match(lotLayout, /lot-viewbox-with-paint/);
assert.match(lotLayoutCss, /\.lot-viewbox-with-paint[\s\S]*flex: 1 1 auto/);
assert.match(lotLayoutCss, /min-height: clamp\(150px, 28vh, 230px\)/);
assert.match(lotLayoutCss, /--lot-paint-rail-height: 54px/);
assert.match(lotLayoutCss, /\.lot-viewbox-with-paint \.lot-view-host[\s\S]*inset: 0 0 var\(--lot-paint-rail-height\)/);
assert.match(lotLayoutCss, /\.lot-view-close,[\s\S]*\.lot-view-open[\s\S]*display: none !important/);
assert.match(lotAccessibility, /lot-selected-car-summary/);
assert.match(lotAccessibility, /Choose car/);
assert.match(lotAccessibility, /Choose car colour/);
assert.match(lotAccessibility, /Car information/);

assert.match(home, /activateTrack\(selectedTrackId, runtime\)/);
assert.match(home, /showTheLot\(\{ initialSelection: selectedVehicle\(runtime\) \}\)/);
assert.match(home, /raceSession\.selectVehicle\(selection\)/);
assert.match(home, /showTrackIntro\(selectedTrackId\)/);
assert.match(home, /raceSession\.startGame\(pendingAccess\?\.fullscreenPromise\)/);
assert.ok(home.indexOf('activateTrack(selectedTrackId, runtime)') < home.indexOf('showTheLot({ initialSelection: selectedVehicle(runtime) })'));
assert.ok(home.indexOf('showTheLot({ initialSelection: selectedVehicle(runtime) })') < home.indexOf('raceSession.selectVehicle(selection)'));
assert.ok(home.indexOf('raceSession.selectVehicle(selection)') < home.indexOf('showTrackIntro(selectedTrackId)'));
assert.ok(home.indexOf('showTrackIntro(selectedTrackId)') < home.indexOf('raceSession.startGame(pendingAccess?.fullscreenPromise)'));
assert.doesNotMatch(home, /chooseTrackBeforeLot/);

assert.match(trackIntro, /TRACK_INTRO_HOLD_MS = 2100/);
assert.match(trackIntro, /getTrackDefinition\(trackId\)/);
assert.match(trackIntro, /track-intro-name'\)\.textContent = track\.name/);
assert.match(trackIntro, /aria-live', 'polite'/);
assert.match(trackIntroCss, /pointer-events: none/);
assert.match(trackIntroCss, /prefers-reduced-motion: reduce/);
assert.match(main, /camera\.position\.set\(0, 110, 215\)/);
assert.match(main, /showRaceSetup: showTheLot/);
assert.match(main, /maxSpeed: MAX_SPEED \* state\.vehicleTuning\.topSpeedMultiplier/);
assert.match(main, /vehicleTuning: state\.vehicleTuning/);
assert.doesNotMatch(main, /wayne-wu\/webgpu-crowd-simulation/);

assert.equal(imports['./vehicle/catalog.js?build=20260720-r19'], releaseTarget('./vehicle/catalog.js'));
assert.equal(imports['./vehicle/catalog.js?build=20260720-r20'], releaseTarget('./vehicle/catalog.js'));
assert.equal(imports['./vehicle/car-models.js?build=20260720-r19'], releaseTarget('./vehicle/car-models.js'));
assert.match(app, /installSportsSedanEasterEggUi\(\)/);
assert.match(lapSystem, /carId: state\.vehicleId \|\| 'sedan'/);
assert.match(lapSystem, /carColor: state\.vehicleColor \|\| '#ffd43b'/);
assert.match(lapSystem, /carSecondaryColor: state\.vehicleSecondaryColor \|\| '#f8f9fa'/);
assert.match(lapPolicy, /isSportsSedanEasterEgg/);
assert.match(lapPolicy, /saveGhost: undefined/);
assert.match(rivalStorage, /version: 6/);
assert.match(rivalStorage, /trackRevision: storageTrackId\(activeTrackId\)/);
assert.match(rivalStorage, /normalizeVehicleId\(lap\.carId\)/);
assert.match(rivalStorage, /normalizeVehicleColor\(lap\.carColor\)/);
assert.match(rivalStorage, /normalizeVehicleSecondaryColor\(lap\.carSecondaryColor\)/);
assert.match(controls, /boostDurationSeconds/);
assert.match(catalogSource, /asset: `\.\/assets\/cars\/\$\{id\}\.glb`/);
assert.match(catalogSource, /SPORTS_SEDAN_EASTER_EGG_COLOR = '#666666'/);
assert.match(catalogSource, /MAXED_VEHICLE_STATS/);
assert.match(carModels, /loadCarSource\(car\.id\)/);
assert.match(easterEggUi, /getEffectiveVehicleStats/);
assert.match(easterEggUi, /input\[type="color"\]/);

console.log(`TURN ${release.id} enhanced Lot route, expanded 3D viewer, accessibility and garage setup passed.`);
