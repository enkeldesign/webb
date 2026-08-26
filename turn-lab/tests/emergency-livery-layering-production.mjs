import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [bridge, semantic, catalogSource, releaseSource] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/semantic-car-finish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const release = JSON.parse(releaseSource);

for (const id of ['police', 'ambulance', 'firetruck']) {
  const car = catalog.getCarDefinition(id);
  assert.equal(car.fixedLivery, true, `${id} must keep a fixed service livery`);
  assert.equal(car.secondaryPaint, null, `${id} must expose no secondary paint`);
}

assert.match(bridge, /native-kenney-palette/);
assert.match(bridge, /createBaseCarVisual\(options\)/);
assert.match(
  bridge,
  /const emergency = EMERGENCY_IDS\.has\(root\?\.userData\?\.turnCarId\);[\s\S]*if \(!emergency\) darkenVisibleWheels\(root\);/,
  'Fixed-livery emergency wheel atlases must skip whole-material darkening so authored rims remain visible'
);
assert.ok(
  bridge.includes(`./car-models.js?build=${release.cacheKey}`),
  'The emergency bridge must use the central TURN build identity without another hand-authored wheel revision'
);
assert.doesNotMatch(
  bridge,
  /car-models\.js\?[^'"\n]*(?:revision=|wheel=|native-car-surfaces)/,
  'The changed emergency bridge must not add another manual asset revision layer'
);
assert.doesNotMatch(bridge, /BoxGeometry|PlaneGeometry|applyFixedEmergencyLivery|installSecondaryAccent/,
  'Emergency liveries must not add side panels or other presentation layers');
assert.match(semantic, /if \(car\.fixedLivery\) return true/,
  'Fixed emergency models must retain the atlas before paint masks are installed');
assert.match(semantic, /car: '\.\/assets\/cars\/palettes\/car-kit\.png'/);

console.log('Emergency vehicles preserve authored fixed Kenney liveries and rims without overlay geometry.');
