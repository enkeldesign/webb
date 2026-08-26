import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  bridge,
  semantic,
  carModels,
  catalogSource,
  productionEntry,
  labEntry
] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/semantic-car-finish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../index.html', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

function importMapFrom(source) {
  const json = source.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(json, 'TURN entry must expose an import map');
  return JSON.parse(json).imports;
}

const expectedFactoryColors = new Map([
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
assert.doesNotMatch(bridge, /BoxGeometry|PlaneGeometry|applyFixedEmergencyLivery|installSecondaryAccent/,
  'Emergency liveries must not add side panels or other presentation layers');

assert.match(carModels, /from '\.\/catalog\.js'/,
  'Car models must resolve the changed catalog through its canonical URL');
assert.match(carModels, /from '\.\/semantic-car-finish\.js'/,
  'Car models must resolve the changed semantic finish through its canonical URL');
assert.doesNotMatch(carModels, /(?:catalog|semantic-car-finish)\.js\?revision=/,
  'Factory color changes must not create another per-module revision layer');

assert.match(semantic, /const POLICE_FIXED_GREY = '#222222'/,
  'Police Car authored grey must use the requested #222 value');
assert.match(semantic, /if \(car\.id === 'police'\) installPoliceFixedGrey\(node, material\)/,
  'Fixed Police Car livery must apply the grey treatment on its authored atlas');
assert.match(semantic, /function installPoliceFixedGrey\(node, material\)/);
assert.match(semantic, /wheel\|tire\|tyre\|rubber/,
  'Police grey treatment must leave authored wheels alone');
assert.match(semantic, /turnPoliceGreyMask/,
  'Police grey treatment must target neutral mid-grey pixels instead of flattening the service livery');
assert.match(semantic, /car: '\.\/assets\/cars\/palettes\/car-kit\.png'/);

const expectedCatalogTargets = [
  ['/turn/vehicle/catalog.js?build=20260804-r157-factory-colors', '/turn/vehicle/catalog.js'],
  ['/turn/vehicle/catalog.js?build=20260720-r20&revision=r588-canonical-attributes', '/turn/vehicle/catalog.js'],
  ['/turn/vehicle/catalog.js?revision=r164-vintage-rally-polish', '/turn/vehicle/catalog.js'],
  ['./vehicle/catalog.js?build=20260720-r19', '/turn/vehicle/catalog.js'],
  ['./vehicle/catalog.js?build=20260720-r20', '/turn/vehicle/catalog.js']
];
const expectedEmergencyTargets = [
  ['./vehicle/car-models.js?build=20260720-r19', '/turn/vehicle/emergency-livery-models.js'],
  ['./vehicle/car-models.js?build=20260720-r22', '/turn/vehicle/emergency-livery-models.js']
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

console.log('TURN factory vehicle colors, Police fixed grey and canonical vehicle module routes passed.');
