import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getAchievement as getProductionAchievement } from '../../turn/achievements/catalog-chromatic-r183.js';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const catalogSource = await fs.readFile(path.join(turnDir, 'vehicle/catalog.js'), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

const expected = new Map([
  ['firetruck', { name: 'Fire Truck', stats: { speed: 2, acceleration: 2, control: 4, drift: 4, boostPower: 1, boostDuration: 5 } }],
  ['police', { name: 'Police Car', stats: { speed: 4, acceleration: 3, control: 3, drift: 2, boostPower: 1, boostDuration: 5 } }],
  ['ambulance', { name: 'Ambulance', stats: { speed: 3, acceleration: 2, control: 3, drift: 4, boostPower: 1, boostDuration: 5 } }]
]);

for (const retired of ['suv-luxury', 'hatchback-sports', 'truck-flat']) {
  assert.equal(catalog.CAR_CATALOG.some((car) => car.id === retired), false, `${retired} must be retired from The Lot`);
}

for (const [id, contract] of expected) {
  const car = catalog.CAR_CATALOG.find((candidate) => candidate.id === id);
  assert.ok(car, `${contract.name} must be in The Lot`);
  assert.equal(car.name, contract.name);
  assert.deepEqual(car.stats, contract.stats);
  assert.equal(catalog.getVehicleStatTotal(car.stats), catalog.VEHICLE_STAT_BUDGET);
  assert.equal(car.stats.boostDuration, 5, `${contract.name} needs a full emergency-service boost tank`);
  assert.equal(car.emergencyService, id);
  assert.equal(car.fixedLivery, true);
  const glb = await fs.readFile(path.join(turnDir, `assets/cars/${id}.glb`));
  assert.equal(glb.toString('utf8', 0, 4), 'glTF');
  assert.ok(glb.length > 10_000, `${id}.glb must contain the vendored Kenney model`);
}

assert.equal(catalog.normalizeVehicleId('suv-luxury'), 'firetruck');
assert.equal(catalog.normalizeVehicleId('hatchback-sports'), 'police');
assert.equal(catalog.normalizeVehicleId('truck-flat'), 'ambulance');

const mayday = getProductionAchievement('golden-hour');
assert.equal(mayday?.title, 'MAYDAY!');
assert.equal(mayday?.hidden, true);
assert.equal(mayday?.category, 'racing');
assert.equal(mayday?.trophies, 100);
assert.match(mayday?.description || '', /Ambulance/);
assert.match(mayday?.description || '', /30 seconds/);

const [
  carModels,
  emergencyLiveries,
  lot,
  lotCss,
  lotTrackSelect,
  controls,
  audio,
  maydayAudio,
  airportEmergency,
  airportWorldR56,
  trackRegistry,
  license,
  index,
  nextIndex,
  releaseSource
] = await Promise.all([
  fs.readFile(path.join(turnDir, 'vehicle/car-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle/emergency-livery-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-r10.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-r10.css'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-track-select.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/gameplay-controls.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'audio/audio-system.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'audio/mayday-audio-r491.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-r491.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-world-r56.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/registry.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'assets/cars/KENNEY-CAR-KIT.md'), 'utf8'),
  fs.readFile(path.join(turnDir, 'index.html'), 'utf8'),
  fs.readFile(path.join(root, 'turn-next/index.html'), 'utf8'),
  fs.readFile(path.join(turnDir, 'release.json'), 'utf8')
]);
const release = JSON.parse(releaseSource);

assert.match(carModels, /!car\.fixedLivery/);
assert.match(carModels, /installEmergencyLightRig/);
assert.match(carModels, /THREE\.AdditiveBlending/);
assert.match(carModels, /new THREE\.PointLight\(0xffffff, 0, lightDistance, 2\)/);
assert.match(carModels, /setThreeColor\(pointLight\.color, colorSpec\)/,
  'Emergency point lights should use Display P3 when the renderer supports it');
assert.match(carModels, /makeWideGamutSpec\('#ff3158'\)/);
assert.match(carModels, /makeWideGamutSpec\('#2ab7ff'\)/);
assert.match(carModels, /record\.wideHalo\.visible = active && !rig\.reducedMotion && on/);
assert.match(carModels, /record\.haloMaterial\.opacity = active && on \? \(rig\.reducedMotion \? 0\.42 : 0\.68\) : 0/);
assert.match(carModels, /record\.pointLight\.intensity = active && on \? \(rig\.reducedMotion \? 70 : 110\) : 0/);
assert.match(carModels, /prefers-reduced-motion: reduce/);
assert.match(carModels, /periodMs = reducedMotion \? 1400/);
assert.match(carModels, /globalThis\.__turnBoostActive/);

assert.match(emergencyLiveries, /police:[\s\S]*primary: makeWideGamutSpec\('#0b0d10'[\s\S]*secondary: makeWideGamutSpec\('#f8f9fa'/);
assert.match(emergencyLiveries, /ambulance:[\s\S]*primary: makeWideGamutSpec\('#f8f9fa'[\s\S]*secondary: makeWideGamutSpec\('#d92d20'[\s\S]*accent: 'rear-side-stripe'/);
assert.match(emergencyLiveries, /firetruck:[\s\S]*primary: makeWideGamutSpec\('#d92d20'[\s\S]*secondary: makeWideGamutSpec\('#ffcc00'/);
assert.match(emergencyLiveries, /applyFixedEmergencyLivery/);
assert.match(emergencyLiveries, /turnEmergencyLiveryAccent/);
assert.match(emergencyLiveries, /length: size\.z \* 0\.52/);
assert.match(emergencyLiveries, /createBaseCarVisual/);
assert.match(emergencyLiveries, /installLotUnselectedTint/,
  'Unselected Lot vehicles should retain a subtle hint of their factory colour');
assert.doesNotMatch(emergencyLiveries, /turnEmergencyLightRig|PointLight|AdditiveBlending/);

assert.match(lot, /if \(car\.fixedLivery\)[\s\S]*colors\.replaceChildren\(\)[\s\S]*colors\.setAttribute\('aria-hidden', 'true'\)/,
  'The Lot renderer itself must leave fixed-livery paint empty and non-interactive');
assert.doesNotMatch(lot, /SERVICE LIVERY|lot-fixed-livery/,
  'Fixed-livery vehicles should not need a placeholder control that another script removes');
assert.doesNotMatch(lotCss, /\.lot-fixed-livery/,
  'There should be no dead fixed-livery placeholder styling');
assert.doesNotMatch(lotTrackSelect, /installFixedLiveryUiGuard|lot-fixed-livery-ui/,
  'The route wrapper must not install a fixed-livery DOM observer');
assert.doesNotMatch(index, /syncFixedLiveryRail|emergencyVehicleNames/,
  'Production index must not contain another fixed-livery DOM observer');

assert.match(airportWorldR56, /airport-world-r53\.js/,
  'The MAYDAY layer must preserve the current real-aircraft Airport world');
assert.match(airportWorldR56, /airport-emergency-r491\.js/);
assert.match(trackRegistry, /airport-world-r56\.js/,
  'Production Airport must route through the MAYDAY playtest-fix wrapper');
assert.match(trackRegistry, /airport\(\{ scene, samples, trackWidth, runtime \}\)/,
  'Airport world installation must receive the live TURN runtime');
assert.match(airportEmergency, /export const AIRPORT_EMERGENCY_CONFIG/);
assert.match(airportEmergency, /vehicleId: AMBULANCE_ID/);
assert.match(airportEmergency, /TRANSFER_LIMIT_MS = 30_000/);
assert.match(airportEmergency, /MEDICAL_RADIUS = 42/,
  'The terminal medical bay should be broad enough to trigger around either responder');
assert.match(airportEmergency, /crashActive !== true/,
  'The Airport crash should happen only once per page session');
assert.match(airportEmergency, /trackId === AIRPORT_TRACK_ID/,
  'The crash trigger must remain Airport-only');
assert.match(airportEmergency, /vehicleId === AMBULANCE_ID/,
  'No other car may trigger the Airport crash');
assert.match(airportEmergency, /detail\?\.valid === true/,
  'Only a valid completed lap may trigger the crash');
assert.match(airportEmergency, /globalThis\.__turnBoostActive === true/,
  'The pickup action must require the Ambulance siren\/Boost to be active near the crash');
assert.match(airportEmergency, /signalSecretAchievement\('golden-hour'/);
assert.match(airportEmergency, /WRECK_TARGET_LENGTH = 62/,
  'The wreck should reuse the real B787 at full aircraft scale');
assert.match(airportEmergency, /world\.getObjectByName\(OVERFLIGHT_NAME\)/,
  'The plane seen in the sky should become the physical wreck rather than a substitute');
assert.match(airportEmergency, /aircraftMount\.rotation\.x = THREE\.MathUtils\.degToRad\(-20\)/);
assert.match(airportEmergency, /aircraftMount\.rotation\.y = Math\.PI/,
  'The wreck nose-tail direction must be reversed from the r490 playtest');
assert.match(airportEmergency, /aircraftMount\.rotation\.z = THREE\.MathUtils\.degToRad\(20\)/);
assert.match(airportEmergency, /makeFlameTongue/,
  'The crash fire should use layered bent flame geometry instead of two large cones');
assert.match(airportEmergency, /THREE\.AdditiveBlending/);
assert.match(airportEmergency, /\[7\.0, 65, 2\.0, 4\.9\]/,
  'The smoke column should stay tall above the full-scale wreck');
assert.match(airportEmergency, /preloadCarModels\(\['firetruck', 'ambulance'\]\)/,
  'Airport + Ambulance should prewarm both medical responder models before lap one finishes');
assert.match(airportEmergency, /requestIdleCallback/,
  'Responder preparation should move away from the finish-line critical path');
assert.match(airportEmergency, /playMaydayCrashSound\(\);[\s\S]*session\.crashActive = true/,
  'The impact must be requested before any crash-scene or responder work');
assert.match(airportEmergency, /carId: 'firetruck'/,
  'The medical bay needs a Fire Truck responder');
assert.match(airportEmergency, /carId: 'ambulance'/,
  'The medical bay needs an Ambulance responder too');
assert.match(airportEmergency, /horizontalDistanceSquared\(position, placement\.firetruckPoint\)/);
assert.match(airportEmergency, /horizontalDistanceSquared\(position, placement\.ambulancePoint\)/,
  'Approaching either responder must count as reaching the medical bay');
assert.match(airportEmergency, /pulseMaydayResponderSiren/,
  'The medical responders must provide positioned audible sirens');
assert.match(airportEmergency, /pulseMaydayFire/,
  'The crash site must retain positioned audible fire guidance');
assert.match(airportEmergency, /#message\.turn-mayday-message[\s\S]*31vh/,
  'MAYDAY instructions must sit below the top lap HUD');
assert.match(airportEmergency, /marker\.textContent = kind === 'medical' \? 'H' : '🔥'/,
  'The minimap must switch from the crash marker to the terminal medical marker during transport');
assert.match(airportEmergency, /sessionPersistent: true/);
assert.match(airportEmergency, /clearsOnPageReload: true/);
assert.doesNotMatch(airportEmergency, /localStorage|sessionStorage/,
  'The crash must persist only for the current page session and reset when TURN starts again');

assert.match(maydayAudio, /export function playMaydayCrashSound/);
assert.match(maydayAudio, /export function pulseMaydayResponderSiren/);
assert.match(maydayAudio, /createStereoPanner/,
  'MAYDAY responder audio should preserve left\/right direction when supported');
assert.match(maydayAudio, /__turnAudioPreferences\?\.getSettings/,
  'The supplemental rescue audio must respect TURN audio-off preferences');

const escapedBuild = release.cacheKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
for (const html of [index, nextIndex]) {
  assert.match(
    html,
    new RegExp(`"\\.\\/vehicle\\/car-models\\.js\\?build=20260720-r19": "\\.\\/vehicle\\/emergency-livery-models\\.js\\?build=${escapedBuild}"`)
  );
  assert.match(
    html,
    new RegExp(`"\\.\\/vehicle\\/car-models\\.js\\?build=20260720-r22": "\\.\\/vehicle\\/emergency-livery-models\\.js\\?build=${escapedBuild}"`)
  );
}

assert.match(controls, /vehicleId: runtimeState\?\.vehicleId/);
assert.match(audio, /EMERGENCY_SERVICE_BY_VEHICLE_ID/);
assert.match(audio, /installEmergencySirenGraph/);
assert.match(audio, /emergencySirenFrequency/);
assert.match(audio, /sirenActive = boostActive/);
assert.match(license, /Creative Commons CC0 1\.0 Universal/);

console.log('TURN emergency vehicles and MAYDAY playtest fixes passed.');
