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
  maydayPolish,
  maydayHud,
  maydayFinal,
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
  fs.readFile(path.join(turnDir, 'audio/mayday-audio-r493.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-r493.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-r494.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-r496.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'tracks/airport-emergency-r497.js'), 'utf8'),
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
assert.match(airportWorldR56, /airport-emergency-r497\.js\?revision=r497-depth-fire-cache/,
  'The r497 playtest must cache-bust the final wreck/fire calibration layer');
assert.match(airportWorldR56, /removeMedicalBayJetBridge\(world\)/,
  'The jet bridge in front of the medical H sign must remain removed');
assert.match(airportWorldR56, /nearly\(node\.position\?\.x, -52\)/);
assert.match(airportWorldR56, /nearly\(node\.position\?\.z, -32\)/);
assert.match(trackRegistry, /airport-world-r56\.js\?build=20260815-r497/,
  'Production Airport must cache-bust the r497 MAYDAY layer');
assert.match(trackRegistry, /airport\(\{ scene, samples, trackWidth, runtime \}\)/,
  'Airport world installation must receive the live TURN runtime');

assert.match(airportEmergency, /export const AIRPORT_EMERGENCY_CONFIG/);
assert.match(airportEmergency, /vehicleId: AMBULANCE_ID/);
assert.match(airportEmergency, /TRANSFER_LIMIT_MS = 30_000/);
assert.match(airportEmergency, /MEDICAL_RADIUS = 42/,
  'The medical bay should remain forgiving');
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
  'The wreck should retain full aircraft scale');
assert.match(airportEmergency, /aircraftMount\.rotation\.x = THREE\.MathUtils\.degToRad\(-20\)/);
assert.match(airportEmergency, /aircraftMount\.rotation\.y = Math\.PI/);
assert.match(airportEmergency, /aircraftMount\.rotation\.z = THREE\.MathUtils\.degToRad\(20\)/);
assert.match(airportEmergency, /makeFlameTongue/,
  'The improved layered crash fire must remain in place');
assert.match(airportEmergency, /THREE\.AdditiveBlending/);
assert.match(airportEmergency, /\[7\.0, 65, 2\.0, 4\.9\]/,
  'The smoke column should stay tall above the full-scale wreck');

assert.match(airportEmergency, /preloadCarModels\(\['firetruck', 'ambulance'\]\)/,
  'Ambulance Airport runs should preload both medical responder models');
assert.doesNotMatch(airportEmergency, /globalThis\.requestIdleCallback\s*\(/,
  'iOS must not defer responder preparation until the finish line');
assert.match(airportEmergency, /wreckAircraft = aircraft\.clone\(true\)/,
  'The B787 wreck must be cloned and prepared before the finish instead of reparenting the live plane then');
assert.match(airportEmergency, /startWreckPrewarm\(\)/,
  'The B787 wreck preparation should start during the first lap');
assert.match(airportEmergency, /renderer\.compileAsync\(staging, camera\)/,
  'MAYDAY-only materials should be asynchronously shader-warmed before the crash reveal');
assert.match(airportEmergency, /setTimeout\(revealCrashVisuals, 120\)/,
  'The prepared crash scene should still reveal after the lap-transition frame');
assert.doesNotMatch(airportEmergency, /aircraftMount\.add\(aircraft\)/,
  'The finish path must not reparent the live overflight B787');
assert.match(airportEmergency, /WRECK_GROUND_Y - bounds\.min\.y/,
  'The tilted wreck must first be fitted to measured geometry before deliberate penetration');
assert.match(airportEmergency, /playMaydayCrashSound\(\);[\s\S]*session\.crashActive = true/,
  'The impact must be requested before crash-state work');
assert.match(airportEmergency, /maydayInfoPlate\(\);[\s\S]*prepareMaydayAudio\(\)/,
  'The MAYDAY info plate should be created before the finish line to avoid first-use DOM work');

assert.match(airportEmergency, /carId: 'firetruck'/,
  'The medical bay needs a Fire Truck responder');
assert.match(airportEmergency, /carId: 'ambulance'/,
  'The medical bay needs an Ambulance responder too');
assert.match(airportEmergency, /const medicalPoint = ambulancePoint\.clone\(\)/,
  'The medical trigger must remain centred on the responder Ambulance');
assert.match(airportEmergency, /function isInsideMedicalBay\(position\)[\s\S]*placement\.medicalPoint/);
assert.match(airportEmergency, /renderScene\.onBeforeRender = function airportEmergencyFrame/,
  'MAYDAY logic must keep running after the wreck leaves the camera frustum');

assert.match(airportEmergency, /PATIENT ON BOARD · MEDICAL BAY · 30 SECONDS/);
assert.doesNotMatch(airportEmergency, /FOLLOW THE SIRENS/);
assert.match(airportEmergency, /\.turn-mayday-info-plate[\s\S]*top: max\(16px, calc\(env\(safe-area-inset-top\) \+ 10px\)\)[\s\S]*border: 3px solid #08090a[\s\S]*box-shadow: 5px 5px 0 #08090a/,
  'The base MAYDAY info plate should retain the established card treatment');
assert.match(airportEmergency, /new THREE\.BoxGeometry\(10\.4, 6\.4, 0\.65\)/,
  'The terminal H plate should cover the window it occupies');
assert.match(airportEmergency, /sign\.position\.set\(0, 8\.7, 12\.72\)/);

assert.match(airportEmergency, /runtime\?\.getRight\?\.\(\)/);
assert.match(airportEmergency, /updateMaydayFire\(\{[\s\S]*placement\.crashPoint/,
  'The continuous fire source must point at the exact crash trigger');
assert.match(airportEmergency, /updateMaydayResponderSiren\(\{[\s\S]*placement\.medicalPoint/,
  'The responder siren source must point at the exact medical trigger');
assert.doesNotMatch(airportEmergency, /const source = firetruckTurn/,
  'The guide siren must not alternate between visual responder positions');
assert.match(airportEmergency, /marker\.textContent = kind === 'medical' \? 'H' : '🔥'/);
assert.match(airportEmergency, /sessionPersistent: true/);
assert.match(airportEmergency, /clearsOnPageReload: true/);
assert.doesNotMatch(airportEmergency, /localStorage|sessionStorage/);

assert.match(maydayPolish, /airport-emergency-r493\.js\?revision=r493/,
  'The corrected stereo and medical-door layer must remain underneath r496/r497');
assert.match(maydayPolish, /cameraRight\.set\(1, 0, 0\)\.applyQuaternion\(camera\.quaternion\)/,
  'Stereo direction must keep using actual camera screen-right');
assert.match(maydayPolish, /-Number\(physicsRight\.x \|\| 0\)/,
  'The no-camera fallback must retain corrected screen-relative handedness');
assert.match(maydayPolish, /const WRECK_PENETRATION_Y = 4\.40/,
  'The final calibration should build from the corrected r494 baseline rather than rewrite it');
assert.match(maydayPolish, /mount\.position\.y -= WRECK_PENETRATION_Y/);
assert.match(maydayPolish, /Airport MAYDAY medical entrance/,
  'The medical bay needs a permanent facade entrance beside the H sign');
assert.match(maydayPolish, /const MEDICAL_WINDOW_X = 12\.5/,
  'The medical entrance should use the actual adjacent window centreline');
assert.match(maydayPolish, /const MEDICAL_WINDOW_Z = 12\.25/);
assert.match(maydayPolish, /const replacedWindow = terminal\.children\.find/,
  'The door should replace the existing terminal window instead of overlaying it');
assert.match(maydayPolish, /terminal\.remove\(replacedWindow\)/);
assert.match(maydayPolish, /new THREE\.BoxGeometry\(6\.8, 7\.4, 0\.72\)/,
  'The medical entrance should keep the approved playtest proportions');
assert.match(maydayPolish, /entrance\.position\.set\(MEDICAL_WINDOW_X, 0, 12\.68\)/,
  'The door should align exactly with the window bay it replaces');

assert.match(maydayHud, /airport-emergency-r494\.js\?revision=r496-hud-depth/,
  'r496 must explicitly cache-bust its calibrated parent layer');
assert.match(maydayHud, /const TARGET_WRECK_PENETRATION_Y = 10\.5/,
  'r497 should build from the tested r496 wreck depth');
assert.match(maydayHud, /mount\.position\.y -= EXTRA_WRECK_PENETRATION_Y/,
  'r496 must apply only the additional depth beyond the r494 baseline');
assert.match(maydayHud, /var\(--turn-action-danger, #ff6b6b\)/,
  'MAYDAY instructions and unlock toast must use the danger design token');
assert.match(maydayHud, /bottom: calc\(clamp\(92px, 20vh, 150px\) \+ 38px\)/,
  'MAYDAY messages should sit immediately above the boost HUD');
assert.match(maydayHud, /turn:achievements-updated/);
assert.match(maydayHud, /unlocked\.includes\('golden-hour'\)/,
  'Only the MAYDAY unlock should receive the danger achievement-toast treatment');

assert.match(maydayFinal, /airport-emergency-r496\.js\?revision=r497-depth-fire/,
  'r497 must preserve and cache-bust the approved r496 HUD behavior');
assert.match(maydayFinal, /const TARGET_WRECK_PENETRATION_Y = 12\.0/,
  'The latest playtest should lower the B787 a modest final 1.5 world units');
assert.match(maydayFinal, /const FIRE_SCALE = 1\.7/,
  'The crash fire should be materially larger against the full-scale B787');
assert.match(maydayFinal, /fire\.scale\.setScalar\(FIRE_SCALE\)/,
  'The larger fire should reuse the existing layered animated fire group');
assert.match(maydayFinal, /mount\.position\.y -= EXTRA_WRECK_PENETRATION_Y/,
  'The final wreck calibration should layer only the additional 1.5-unit correction');

assert.match(maydayAudio, /export function playMaydayCrashSound/);
assert.match(maydayAudio, /playDistortedNoise\(now \+ 0\.015, 3\.05/,
  'The aircraft impact should last about three seconds');
assert.match(maydayAudio, /export function updateMaydayFire/);
assert.match(maydayAudio, /fireSource\.loop = true/,
  'Crash fire guidance must be a continuous loop with no pulse gaps');
assert.match(maydayAudio, /export function updateMaydayResponderSiren/);
assert.match(maydayAudio, /Math\.floor\(now \/ 0\.58\) % 2 === 0 \? 430 : 570/,
  'The medical guide must use TURN\'s existing Fire Truck 430\/570 Hz siren skid');
assert.match(maydayAudio, /responderSirenTone\.type = 'triangle'/);
assert.match(maydayAudio, /responderSirenHarmonic\.type = 'sine'/);
assert.match(maydayAudio, /responderSirenFilter\.frequency\.value = 1800/);
assert.match(maydayAudio, /createStereoPanner/,
  'MAYDAY world audio should preserve left/right direction when supported');
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

console.log('TURN emergency vehicles and MAYDAY r497 depth/fire calibration passed.');
