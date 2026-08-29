import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { matchesTrackColor } from '../../turn/achievements/chromatic-camouflage-r183.js';

const [
  bridge,
  semantic,
  carModels,
  catalogSource,
  productionEntry,
  labEntry,
  yourTurnEntry
] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/semantic-car-finish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../yourturn/index.html', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

function importMapFrom(source) {
  const json = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(json, 'TURN entry must expose an import map');
  return JSON.parse(json).imports;
}

const expectedFactoryColors = new Map([
  ['convertible', ['#ff4fa3', '#792766']],
  ['suv', ['#0555aa', '#163f7a']],
  ['van', ['#ff7700', '#222222']],
  ['race', ['#5d503f', '#222222']],
  ['vintage-racer', ['#004455', '#222222']],
  ['race-future', ['#222222', '#332244']],
  ['monster-truck', ['#3f5a3c', '#4f5504']],
  ['police', ['#222222', '#f8f9fa']]
]);

for (const [id, [primary, secondary]] of expectedFactoryColors) {
  const car = catalog.getCarDefinition(id);
  assert.equal(car.defaultColor, primary, `${car.name} factory primary color`);
  assert.equal(car.defaultSecondaryColor, secondary, `${car.name} factory secondary color`);
}

const chromaticFactoryRoute = Object.freeze({
  countryside: 'convertible',
  airport: 'classic',
  harbor: 'van',
  cliffside: 'sedan',
  'midnight-city': 'sedan-sports',
  mountain: 'suv'
});

for (const [trackId, carId] of Object.entries(chromaticFactoryRoute)) {
  const car = catalog.getCarDefinition(carId);
  assert.equal(
    matchesTrackColor(trackId, car.defaultColor),
    true,
    `CHROMATIC CAMOUFLAGE must remain achievable without PAINTJOB: ${car.name} factory ${car.defaultColor} should match ${trackId}`
  );
}

for (const id of ['police', 'ambulance', 'firetruck']) {
  const car = catalog.getCarDefinition(id);
  assert.equal(car.fixedLivery, true, `${id} must keep a fixed service livery`);
  assert.equal(car.secondaryPaint, null, `${id} must expose no secondary paint`);
}

assert.match(bridge, /native-kenney-palette/);
assert.match(bridge, /createBaseCarVisual\(options\)/);
assert.match(
  bridge,
  /from '\.\/car-models\.js'/,
  'The emergency bridge must use the canonical car-model module without another hand-authored query suffix'
);
assert.doesNotMatch(bridge, /car-models\.js\?/, 'Emergency bridge must not add a manual car-model revision');
assert.match(
  bridge,
  /const emergency = EMERGENCY_IDS\.has\(root\?\.userData\?\.turnCarId\);[\s\S]*if \(!emergency\) darkenVisibleWheels\(root\);/,
  'Fixed-livery emergency wheel atlases must skip whole-material darkening so authored rims remain visible'
);
assert.doesNotMatch(bridge, /applyFixedEmergencyLivery|installSecondaryAccent/,
  'Emergency liveries must not add side panels or other presentation layers');

assert.match(bridge, /TRAINING_CAR_ID = 'classic'/,
  'The Taxi-derived Training Car must be the only non-emergency presentation exception');
assert.match(bridge, /TRAINING_SIGN_COLOR = 0x2f9e44/,
  'Training identifiers must use the fixed green treatment');
assert.match(bridge, /installTrainingCarSignage\(root\)/);
assert.match(bridge, /turnTrainingCarSignage/);
assert.match(bridge, /roof-sign/);
assert.match(bridge, /door-sign-left/);
assert.match(bridge, /door-sign-right/);
assert.match(bridge, /bounds\.max\.y \+ roofHeight \* 0\.34/,
  'The replacement roof sign must overlap and visually close the exposed Taxi roof mount');
assert.match(bridge, /BoxGeometry/,
  'The Training Car sign must be real geometry so the old roof opening is covered from oblique cameras');

assert.match(carModels, /from '\.\/catalog\.js'/,
  'Car models must resolve the changed catalog through its canonical URL');
assert.match(carModels, /from '\.\/semantic-car-finish\.js'/,
  'Car models must resolve the changed semantic finish through its canonical URL');
assert.doesNotMatch(carModels, /(?:catalog|semantic-car-finish)\.js\?revision=/,
  'Factory color changes must not create another per-module revision layer');

assert.match(semantic, /const POLICE_FIXED_GREY = '#222222'/,
  'Police Car authored grey must use the requested #222 value');
assert.match(semantic, /if \(car\.fixedLivery && car\.id === 'police'\) installPoliceFixedGrey\(node, material\)/,
  'Fixed Police Car livery must apply the grey treatment on its authored atlas');
assert.match(semantic, /if \(car\.fixedLivery\) return true/,
  'Fixed emergency models must retain the authored atlas after Police-specific treatment');
assert.match(semantic, /function installPoliceFixedGrey\(node, material\)/);
assert.match(semantic, /wheel\|tire\|tyre\|rubber/,
  'Police grey treatment must leave authored wheels alone');
assert.match(semantic, /turnPoliceGreyMask/,
  'Police grey treatment must target neutral mid-grey pixels instead of flattening the service livery');
assert.match(semantic, /car: '\.\/assets\/cars\/palettes\/car-kit\.png'/);

const canonicalCatalogTarget = '/turn/vehicle/catalog.js?revision=r223-training-car-taxi';
const canonicalBridgeTarget = '/turn/vehicle/emergency-livery-models.js?revision=r224-training-car-signage';
const expectedCatalogTargets = [
  ['/turn/vehicle/catalog.js', canonicalCatalogTarget],
  ['/turn/vehicle/catalog.js?build=20260804-r157-factory-colors', canonicalCatalogTarget],
  ['/turn/vehicle/catalog.js?build=20260720-r20&revision=r588-canonical-attributes', canonicalCatalogTarget],
  ['/turn/vehicle/catalog.js?revision=r164-vintage-rally-polish', canonicalCatalogTarget],
  ['./vehicle/catalog.js?build=20260720-r19', canonicalCatalogTarget],
  ['./vehicle/catalog.js?build=20260720-r20', canonicalCatalogTarget]
];
const expectedEmergencyTargets = [
  ['/turn/vehicle/semantic-car-finish.js', '/turn/vehicle/semantic-car-finish.js?revision=r223-training-car-taxi'],
  ['/turn/vehicle/car-models.js', '/turn/vehicle/car-models.js?revision=r223-training-car-taxi'],
  ['/turn/vehicle/emergency-livery-models.js', canonicalBridgeTarget],
  ['./vehicle/car-models.js?build=20260720-r19', canonicalBridgeTarget],
  ['./vehicle/car-models.js?build=20260720-r22', canonicalBridgeTarget]
];

for (const [name, source] of [['production', productionEntry], ['TURN LAB', labEntry]]) {
  const imports = importMapFrom(source);
  for (const [specifier, target] of [...expectedCatalogTargets, ...expectedEmergencyTargets]) {
    assert.equal(imports[specifier], target, `${name} must route ${specifier} to the canonical changed vehicle module`);
  }
}

assert.deepEqual(
  importMapFrom(labEntry),
  importMapFrom(productionEntry),
  'TURN LAB must retain the exact production import map'
);

const yourTurnImports = importMapFrom(yourTurnEntry);
for (const specifier of [
  '/turn/vehicle/catalog.js',
  '/turn/vehicle/catalog.js?build=20260720-r19',
  '/turn/vehicle/catalog.js?build=20260720-r20',
  '/turn/vehicle/catalog.js?build=20260804-r157-factory-colors',
  '/turn/vehicle/catalog.js?revision=r164-vintage-rally-polish'
]) {
  assert.equal(yourTurnImports[specifier], canonicalCatalogTarget,
    `YOUR TURN must share the canonical factory color catalog for ${specifier}`);
}

console.log('TURN semantic emergency liveries, Training Car signage, factory colors and shared catalog routing passed.');
