import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const catalogSource = await fs.readFile(path.join(turnDir, 'vehicle/catalog.js'), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const expectedIds = ['convertible','classic','vintage-racer','toy-racer','monster-truck','race-future','race','sedan-sports','sedan','suv','suv-luxury','hatchback-sports','truck-flat','truck','van'];

assert.equal(catalog.CAR_CATALOG.length, 15, 'The Lot must contain exactly 15 cars');
assert.deepEqual(catalog.CAR_CATALOG.map((car) => car.id), expectedIds, 'The Lot car order changed unexpectedly');
for (const id of expectedIds) await fs.access(path.join(turnDir, `assets/cars/${id}.glb`));
const brickFiles = (await fs.readdir(path.join(turnDir, 'assets/lot-bricks'))).filter((file) => file.endsWith('.glb'));
assert.equal(brickFiles.length, 9, 'The vendored Kenney Brick Kit subset should remain available even though The Lot no longer renders it');

const sedan = catalog.getCarDefinition('sedan');
const race = catalog.getCarDefinition('race');
const truck = catalog.getCarDefinition('truck');
const monsterTruck = catalog.getCarDefinition('monster-truck');
const trainingCar = catalog.getCarDefinition('classic');
assert.equal(catalog.DEFAULT_VEHICLE_ID, 'classic', 'New players must enter The Lot with the Training Car selected');
assert.equal(trainingCar.name, 'Training Car', 'The repurposed Classic model must clearly advertise its learning role');
assert.deepEqual(
  trainingCar.stats,
  { speed: 1, acceleration: 1, control: 5, drift: 5, boostPower: 1, boostDuration: 5 },
  'Training Car must stay slow, forgiving and fully equipped for soundscape testing'
);
assert.equal(monsterTruck.visualScale, 0.83, 'Monster Truck must stay at the reduced visual scale so it fits the shared 3D viewer and race field');
assert.equal(sedan.tuning.topSpeedMultiplier, 1, 'Sedan top speed must remain the v1.0 baseline');
assert.equal(sedan.tuning.accelerationMultiplier, 1, 'Sedan acceleration must remain the v1.0 baseline');
assert.equal(sedan.tuning.controlMultiplier, 1, 'Sedan control must remain the v1.0 baseline');
assert.equal(sedan.tuning.driftEngineMultiplier, 0.86, 'Sedan must retain the agreed r59 engine penalty while drifting');
assert.equal(sedan.tuning.driftDragAdd, 0.1, 'Sedan must retain the agreed r59 drift drag');
assert.equal(sedan.tuning.driftSpeedMultiplier, 0.84, 'Sedan DRIFT must cap at 84% of its corresponding GAS speed limit');
assert.equal(sedan.tuning.driftStabilityMultiplier, 1, 'Sedan must remain the neutral DRIFT stability baseline');
assert.equal(sedan.tuning.boostPowerMultiplier, 1, 'Sedan boost power must remain the v1.0 baseline');
assert.equal(sedan.tuning.boostSpeedMultiplier, 1.32, 'Sedan boost speed must remain the v1.0 baseline');
assert.equal(sedan.tuning.boostDurationSeconds, 2, 'Sedan boost tank must remain the v1.0 baseline');
assert.ok(race.tuning.topSpeedMultiplier > sedan.tuning.topSpeedMultiplier, 'Race car should have more top speed than Sedan');
assert.ok(race.tuning.accelerationMultiplier > sedan.tuning.accelerationMultiplier, 'Race car should accelerate faster than Sedan');
assert.ok(race.tuning.controlMultiplier > sedan.tuning.controlMultiplier, 'Race car should have more control than Sedan');
assert.ok(race.tuning.driftDragAdd > sedan.tuning.driftDragAdd, 'Race car should pay a larger speed penalty while drifting');
assert.ok(race.tuning.driftStabilityMultiplier < sedan.tuning.driftStabilityMultiplier, 'Race car should be less settled in DRIFT than Sedan');
assert.ok(race.tuning.boostPowerMultiplier >= sedan.tuning.boostPowerMultiplier, 'Race car boost should not be weaker than Sedan');
assert.ok(race.tuning.boostDurationSeconds < sedan.tuning.boostDurationSeconds, 'Race car should have a shorter boost tank');
assert.ok(truck.tuning.topSpeedMultiplier < sedan.tuning.topSpeedMultiplier, 'Truck should have less top speed than Sedan');
assert.ok(truck.tuning.accelerationMultiplier < sedan.tuning.accelerationMultiplier, 'Truck should accelerate slower than Sedan');
assert.ok(truck.tuning.driftDragAdd < sedan.tuning.driftDragAdd, 'Truck should retain more speed while drifting');
assert.ok(truck.tuning.driftStabilityMultiplier > sedan.tuning.driftStabilityMultiplier, 'Truck should settle more cleanly in DRIFT than Sedan');
assert.ok(truck.tuning.boostPowerMultiplier < sedan.tuning.boostPowerMultiplier, 'Truck boost should be weaker than Sedan');
assert.ok(truck.tuning.boostDurationSeconds > sedan.tuning.boostDurationSeconds, 'Truck should have a longer boost tank');
assert.notEqual(catalog.makeGhostColor('#ff4fa3'), '#ff4fa3', 'Ghost colour should be a lighter nuance, not the original paint colour');

const easterEggSelection = {
  carId: 'sedan-sports',
  color: '#ffd43b',
  secondaryColor: '#666'
};
assert.equal(catalog.normalizeVehicleSecondaryColor('#666'), '#666666', 'The three-digit spoiler code must canonicalize to its browser colour value');
assert.equal(catalog.isSportsSedanEasterEgg(easterEggSelection), true, 'Only the Sport Sedan spoiler code should unlock the hidden setup');
assert.equal(catalog.isSportsSedanEasterEgg({ ...easterEggSelection, carId: 'sedan' }), false, 'The same colour on another car must do nothing');
assert.equal(catalog.isSportsSedanEasterEgg({ ...easterEggSelection, secondaryColor: '#666667' }), false, 'Near-miss colours must not unlock the setup');
assert.deepEqual(catalog.getEffectiveVehicleStats(easterEggSelection), catalog.MAXED_VEHICLE_STATS, 'Every displayed hidden stat must reach 5/5');
const hiddenTuning = catalog.getEffectiveVehicleTuning(easterEggSelection);
const regularSportSedan = catalog.CAR_CATALOG.find((car) => car.id === 'sedan-sports');
assert.ok(hiddenTuning.topSpeedMultiplier > regularSportSedan.tuning.topSpeedMultiplier, 'The hidden setup must raise top speed');
assert.ok(hiddenTuning.accelerationMultiplier > regularSportSedan.tuning.accelerationMultiplier, 'The hidden setup must raise acceleration');
assert.ok(hiddenTuning.controlMultiplier > regularSportSedan.tuning.controlMultiplier, 'The hidden setup must raise control');
assert.ok(hiddenTuning.driftStabilityMultiplier > regularSportSedan.tuning.driftStabilityMultiplier, 'The hidden setup must raise drift stability');
assert.ok(hiddenTuning.boostPowerMultiplier > regularSportSedan.tuning.boostPowerMultiplier, 'The hidden setup must raise boost power');
assert.ok(hiddenTuning.boostDurationSeconds > regularSportSedan.tuning.boostDurationSeconds, 'The hidden setup must raise boost duration');
assert.equal(hiddenTuning.enginePitch, regularSportSedan.tuning.enginePitch, 'The easter egg must not replace the car audio identity');

const originalLocalStorage = globalThis.localStorage;
const vehicleStorage = new Map();
globalThis.localStorage = {
  getItem(key) { return vehicleStorage.has(key) ? vehicleStorage.get(key) : null; },
  setItem(key, value) { vehicleStorage.set(key, String(value)); },
  removeItem(key) { vehicleStorage.delete(key); }
};
try {
  assert.equal(catalog.loadVehicleSelection().carId, 'classic', 'An empty profile must select Training Car without overwriting future player choices');
  const savedEgg = catalog.saveVehicleSelection(easterEggSelection);
  assert.equal(savedEgg.secondaryColor, '#666666');
  assert.deepEqual(catalog.getCarDefinition('sedan-sports').stats, catalog.MAXED_VEHICLE_STATS, 'The saved hidden selection must feed maxed stats into the unchanged game core');
  assert.equal(catalog.getCarDefinition('sedan-sports').tuning, hiddenTuning, 'The saved hidden selection must feed maxed tuning into physics');
  catalog.saveVehicleSelection({ ...easterEggSelection, secondaryColor: '#777777' });
  assert.deepEqual(catalog.getCarDefinition('sedan-sports').stats, regularSportSedan.stats, 'Changing the spoiler colour must restore the canonical Sport Sedan immediately');
} finally {
  if (originalLocalStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = originalLocalStorage;
}

const [index, releaseSource, app, main, lapSystem, lapPolicy, rivalStorage, controls, carModels, lotWrapper, trackIntro, trackIntroCss, easterEggUi] = await Promise.all([
  fs.readFile(path.join(turnDir, 'index.html'), 'utf8'),
  fs.readFile(path.join(turnDir, 'release.json'), 'utf8'),
  fs.readFile(path.join(turnDir, 'app.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'main.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/lap-system.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/lap-system-r86.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'race/rival-storage.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/gameplay-controls.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle/car-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-track-select.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/track-intro.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'track-intro.css'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle/sports-sedan-easter-egg.js'), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;
const releaseTarget = (path) => `${path}?build=${release.cacheKey}`;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\.')} · Build ${release.id.replaceAll('.', '\.')}`));
assert.match(index, new RegExp(`\.\/garage\/lot-r10\.css\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`\.\/track-intro\.css\?build=${release.cacheKey}`), 'The track intro styling must be published with the active release');
assert.equal(imports['./garage/lot-r10.js?build=20260720-r19'], releaseTarget('./garage/lot-track-select.js'), 'The current release must place the compact track-first wrapper in front of the stable Lot implementation');
assert.equal(imports['./ui/track-intro.js?build=20260725-r75'], releaseTarget('./ui/track-intro.js'), 'The current release must publish the track intro module');
assert.equal(imports['./race/lap-system.js?build=20260720-r19'], releaseTarget('./race/lap-system-r86.js'), 'The current release must publish the unranked lap policy');
assert.match(lotWrapper, /showOriginalLot/, 'The track-first wrapper must still delegate car selection to the verified Lot implementation');
assert.match(lotWrapper, /await chooseTrackBeforeLot\(\)/, 'The driver must pick a track before choosing the car');
assert.match(lotWrapper, /installLotLayout\(\)/, 'The compact panel arrangement must be installed after The Lot mounts');
assert.match(lotWrapper, /track-manager\.js\?build=20260722-r52/, 'The wrapper must preserve the verified Airport run-off runtime');
assert.match(lotWrapper, /if \(selection\) await showTrackIntro\(trackId\)/, 'RACE THIS CAR must hold the aerial preview before gameplay starts');
assert.match(trackIntro, /TRACK_INTRO_HOLD_MS = 2100/, 'The track overview must remain visible for a little over two seconds');
assert.match(trackIntro, /getTrackDefinition\(trackId\)/, 'The intro must use the selected track definition');
assert.match(trackIntro, /track-intro-name'\)\.textContent = track\.name/, 'The selected track name must be shown over the overview');
assert.match(trackIntro, /aria-live', 'polite'/, 'The transient track title must be announced without interrupting other speech');
assert.match(trackIntroCss, /pointer-events: none/, 'The title presentation must never trap gameplay input');
assert.match(trackIntroCss, /prefers-reduced-motion: reduce/, 'The intro must respect reduced-motion preferences');
assert.match(main, /camera\.position\.set\(0, 110, 215\)/, 'The existing aerial preview camera must remain the track-intro view');
assert.equal(imports['./vehicle/catalog.js?build=20260720-r19'], releaseTarget('./vehicle/catalog.js'), 'The current release must publish the shared vehicle stat definitions in the main runtime');
assert.equal(imports['./vehicle/catalog.js?build=20260720-r20'], releaseTarget('./vehicle/catalog.js'), 'The current release must publish the same handling model inside The Lot');
assert.equal(imports['./vehicle/car-models.js?build=20260720-r19'], releaseTarget('./vehicle/car-models.js'), 'The current release must publish the stable outline module');
assert.match(app, /installSportsSedanEasterEggUi\(\)/, 'The Lot stat reveal must install before the game runtime starts');
assert.match(main, /await showTheLot\(/, 'Start flow must enter the track-first Lot wrapper before racing');
assert.match(main, /maxSpeed: MAX_SPEED \* state\.vehicleTuning\.topSpeedMultiplier/, 'Selected top speed must reach physics');
assert.match(main, /vehicleTuning: state\.vehicleTuning/, 'Selected handling profile must reach physics');
assert.doesNotMatch(main, /wayne-wu\/webgpu-crowd-simulation/, 'Production must not depend on the old remote Sedan model');
assert.match(lapSystem, /carId: state\.vehicleId \|\| 'sedan'/, 'Completed laps must remember their car model');
assert.match(lapSystem, /carColor: state\.vehicleColor \|\| '#ffd43b'/, 'Completed laps must remember their paint colour');
assert.match(lapSystem, /carSecondaryColor: state\.vehicleSecondaryColor \|\| '#f8f9fa'/, 'Completed laps must remember secondary paint');
assert.match(lapPolicy, /isSportsSedanEasterEgg/, 'The record policy must recognize the hidden setup');
assert.match(lapPolicy, /saveGhost: undefined/, 'The record policy must suppress persistent storage for the hidden setup');
assert.match(rivalStorage, /version: 6/, 'Rival storage schema must preserve track identity, geometry revision and secondary paint metadata');
assert.match(rivalStorage, /trackRevision: storageTrackId\(activeTrackId\)/, 'Rival storage must identify geometry revisions');
assert.match(rivalStorage, /normalizeVehicleId\(lap\.carId\)/, 'Loaded rivals must normalize stored car ids');
assert.match(rivalStorage, /normalizeVehicleColor\(lap\.carColor\)/, 'Loaded rivals must normalize stored car colours');
assert.match(rivalStorage, /normalizeVehicleSecondaryColor\(lap\.carSecondaryColor\)/, 'Loaded rivals must normalize secondary paint');
assert.match(controls, /boostDurationSeconds/, 'Boost drain must use the selected car boost tank stat');
assert.match(catalogSource, /asset: `\.\/assets\/cars\/\$\{id\}\.glb`/, 'Vehicle catalog must point to vendored local car assets');
assert.match(catalogSource, /SPORTS_SEDAN_EASTER_EGG_COLOR = '#666666'/, 'The hidden spoiler trigger must remain exact');
assert.match(catalogSource, /MAXED_VEHICLE_STATS/, 'The hidden setup must use one shared max-stat definition');
assert.match(carModels, /loadCarSource\(car\.id\)/, 'Car model factory must load the catalog-selected vehicle');
assert.match(easterEggUi, /getEffectiveVehicleStats/, 'The Lot must render effective rather than canonical stats');
assert.match(easterEggUi, /input\[type="color"\]/, 'The hidden setup must react to the native spoiler picker');
assert.match(easterEggUi, /MutationObserver/, 'The stat reveal must follow The Lot lifecycle without polling');
assert.doesNotMatch(easterEggUi, /setInterval|requestAnimationFrame|setAnimationLoop/, 'The easter egg UI must add no animation loop');

const lotR10 = await fs.readFile(path.join(turnDir, 'garage/lot-r10.js'), 'utf8');
const lotR10Css = await fs.readFile(path.join(turnDir, 'garage/lot-r10.css'), 'utf8');
assert.match(main, /garage\/lot-r10\.js/, 'The game core must continue to request the stable r10 Lot module contract');
assert.match(lotR10, /UNSELECTED_COLOR = new THREE\.Color\(0x313131\)/, 'Unselected Lot cars must use #313131');
assert.match(lotR10, /car-models\.js\?build=20260720-r22/, 'The Lot must keep the r22 outline implementation');
assert.match(lotR10, /if \(selected \|\| record\.outline\)/, 'Unselected Lot cars must preserve their original outline materials');
assert.match(lotR10, /material\.transparent = false/, 'Unselected Lot car surfaces must remain opaque');
assert.match(lotR10, /material\.opacity = 1/, 'Unselected Lot car surfaces must render at full opacity');
assert.match(lotR10, /material\.depthWrite = true/, 'Unselected Lot car surfaces must write depth');
assert.doesNotMatch(lotR10, /material\.opacity = 0\.46/, 'The retired translucent unselected-car presentation must stay removed');
assert.match(lotR10, /function makeParkingPad\(\) \{\s*return new THREE\.Group\(\);\s*\}/, 'The Lot parking pad must not render a coloured floor fill');
assert.match(lotR10, /function setParkingPadSelected\(\) \{\}/, 'Selecting a car must not reintroduce the teal parking pad');
assert.doesNotMatch(lotR10, /new THREE\.PlaneGeometry\(6\.7, 5\.9\)/, 'The retired parking pad fill geometry must stay removed');
assert.doesNotMatch(lotR10, /GLTFLoader/, 'The clean Lot must not load decorative scenery assets');
assert.doesNotMatch(lotR10, /installBrickScenery/, 'The brick wall must remain removed');
assert.doesNotMatch(lotR10, /InstancedMesh/, 'The retired brick wall geometry must remain removed');
assert.match(lotR10Css, /word-spacing: 0\.16em/, 'THE LOT must keep the increased word spacing');
assert.match(lotR10, /selectedColor = selection\.color/, 'The Lot must restore the selected native body colour');
assert.match(lotR10, /selectedSecondaryColor = selection\.secondaryColor/, 'The Lot must restore secondary paint');
assert.match(lotR10, /lot-viewbox/, 'The Lot must include a dedicated 3D car viewbox');
assert.match(lotR10, /DRAG TO ROTATE/, 'The 3D car viewer must advertise drag rotation');
assert.match(lotR10Css, /--lot-rail-width/, 'The stats and viewer rail must reserve space beside the parking lot');

const backToLot = await fs.readFile(path.join(turnDir, 'ui/back-to-lot.js'), 'utf8');
assert.match(main, /openLot: openLotFromRace/, 'Race runtime must expose the Back to the Lot action');
assert.match(main, /await showTheLot\(/, 'Back to the Lot must reuse the track-first car-selection flow');
assert.match(backToLot, /Back to Lot/, 'Race UI must include the Back to Lot button');
assert.match(backToLot, /back-to-lot-button/, 'Back to Lot must expose its menu hook');

console.log(`TURN ${release.id} garage, Training Car default, hidden Sports Sedan setup and aerial intro passed.`);
