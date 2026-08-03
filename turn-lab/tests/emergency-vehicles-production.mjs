import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

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

const [
  carModels,
  emergencyLiveries,
  lot,
  lotCss,
  fixedLiveryUi,
  lotTrackSelect,
  controls,
  audio,
  license,
  index,
  nextIndex
] = await Promise.all([
  fs.readFile(path.join(turnDir, 'vehicle/car-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle/emergency-livery-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-r10.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-r10.css'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-fixed-livery-ui.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'garage/lot-track-select.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'ui/gameplay-controls.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'audio/audio-system.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'assets/cars/KENNEY-CAR-KIT.md'), 'utf8'),
  fs.readFile(path.join(turnDir, 'index.html'), 'utf8'),
  fs.readFile(path.join(root, 'turn-next/index.html'), 'utf8')
]);

assert.match(carModels, /!car\.fixedLivery/);
assert.match(carModels, /installEmergencyLightRig/);
assert.match(carModels, /THREE\.AdditiveBlending/);
assert.match(carModels, /new THREE\.PointLight\(color, 0, lightDistance, 2\)/);
assert.match(carModels, /record\.wideHalo\.visible = active && !rig\.reducedMotion && on/);
assert.match(carModels, /record\.haloMaterial\.opacity = active && on \? \(rig\.reducedMotion \? 0\.42 : 0\.68\) : 0/);
assert.match(carModels, /record\.pointLight\.intensity = active && on \? \(rig\.reducedMotion \? 70 : 110\) : 0/);
assert.match(carModels, /prefers-reduced-motion: reduce/);
assert.match(carModels, /periodMs = reducedMotion \? 1400/);
assert.match(carModels, /globalThis\.__turnBoostActive/);

assert.match(emergencyLiveries, /police:[\s\S]*primary: 0x0b0d10[\s\S]*secondary: 0xf8f9fa/);
assert.match(emergencyLiveries, /ambulance:[\s\S]*primary: 0xf8f9fa[\s\S]*secondary: 0xd92d20[\s\S]*accent: 'rear-side-stripe'/);
assert.match(emergencyLiveries, /firetruck:[\s\S]*primary: 0xd92d20[\s\S]*secondary: 0xffd43b/);
assert.match(emergencyLiveries, /applyFixedEmergencyLivery/);
assert.match(emergencyLiveries, /turnEmergencyLiveryAccent/);
assert.match(emergencyLiveries, /length: size\.z \* 0\.52/);
assert.match(emergencyLiveries, /createBaseCarVisual/);
assert.doesNotMatch(emergencyLiveries, /turnEmergencyLightRig|PointLight|AdditiveBlending/);

assert.match(lot, /SERVICE LIVERY/);
assert.match(lotCss, /\.lot-fixed-livery/);
assert.match(fixedLiveryUi, /emergencyVehicleNames/);
assert.match(fixedLiveryUi, /colors\.childNodes\.length > 0/);
assert.match(fixedLiveryUi, /colors\.replaceChildren\(\)/);
assert.doesNotMatch(fixedLiveryUi, /colors\.hidden = true/);
assert.match(fixedLiveryUi, /colors\.hidden = false/);
assert.match(fixedLiveryUi, /colors\.setAttribute\('aria-hidden', 'true'\)/);
assert.match(lotTrackSelect, /installFixedLiveryUiGuard/);
assert.match(lotTrackSelect, /emergency-paint-empty-v3/);
assert.match(index, /syncFixedLiveryRail/);
assert.match(index, /emergencyVehicleNames/);
assert.doesNotMatch(fixedLiveryUi, /input|type=['"]color|SERVICE LIGHTS/);

for (const html of [index, nextIndex]) {
  assert.match(html, /"\.\/vehicle\/car-models\.js\?build=20260720-r19": "\.\/vehicle\/emergency-livery-models\.js\?build=20260803-r126"/);
  assert.match(html, /"\.\/vehicle\/car-models\.js\?build=20260720-r22": "\.\/vehicle\/emergency-livery-models\.js\?build=20260803-r126"/);
}

assert.match(controls, /vehicleId: runtimeState\?\.vehicleId/);
assert.match(audio, /EMERGENCY_SERVICE_BY_VEHICLE_ID/);
assert.match(audio, /installEmergencySirenGraph/);
assert.match(audio, /emergencySirenFrequency/);
assert.match(audio, /sirenActive = boostActive/);
assert.match(license, /Creative Commons CC0 1\.0 Universal/);

console.log('TURN emergency vehicles, fixed liveries, empty paint rail, lights and sirens passed.');
