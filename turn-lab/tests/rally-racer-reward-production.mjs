import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  catalogSource,
  carModelsSource,
  emergencyModelsSource,
  semanticSource,
  lotSource,
  releaseSource
] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/semantic-car-finish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-showroom-experiment.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const rally = catalog.getCarDefinition('toy-racer');
const release = JSON.parse(releaseSource);

assert.equal(rally.name, 'Rally Racer');
assert.equal(rally.pack, 'toy');
assert.equal(rally.asset, './assets/cars/toy-racer.glb', 'Rally should retain the distinctive authored Toy Kit model');
assert.equal(rally.defaultColor, '#111111', 'The final reward should retain its black competition body');
assert.equal(rally.defaultSecondaryColor, '#ffcc00', 'The native rally trim should use TURN trophy gold');
assert.deepEqual(rally.defaultSecondaryColorP3, [1, 0.76, 0]);
assert.equal(rally.secondaryPaint?.label, 'Rally trim');
assert.deepEqual(rally.secondaryPaint?.meshNames, []);
assert.equal(rally.visualUpgrade, null, 'Rally must not opt into generated presentation geometry');

assert.match(semanticSource, /'toy-racer': profile\(\{/);
assert.match(semanticSource, /primary: \[\[1, 4\], \[1, 5\]\]/,
  'Rally body paint must target its authored Toy Kit palette cells');
assert.match(semanticSource, /secondary: \[\[1, 6\], \[1, 7\]\]/,
  'Rally gold must target the existing bumper, wing and body-trim cells');
assert.match(semanticSource, /rims: \[\[4, 6\], \[4, 7\]\]/);
assert.match(semanticSource, /rimRole: 'secondary'/,
  'Rally wheel centres should share the trophy-gold trim colour');
assert.match(semanticSource, /turnPaletteCell/);
assert.match(semanticSource, /ivec2\(floor\(vMapUv \* 8\.0\)\)/,
  'Rally paint masks must use the authored glTF UV orientation');
assert.doesNotMatch(semanticSource, /1\.0 - vMapUv\.y/,
  'Rally paint must not vertically flip the already-oriented glTF UVs');
assert.match(semanticSource, /turnPanelShade/,
  'The two authored palette shades must survive runtime recolouring');
assert.doesNotMatch(semanticSource, /BoxGeometry|CylinderGeometry|SphereGeometry|mergeGeometries|PointLight/,
  'Semantic paint must not manufacture any presentation geometry or lights');

assert.match(carModelsSource, /installSemanticCarFinish\(\{/,
  'Every canonical rendering surface must use the shared semantic finish');
assert.doesNotMatch(carModelsSource, /installVehicleVisualUpgrade|rally-competition/);
assert.match(emergencyModelsSource, new RegExp(`car-models\\.js\\?build=${release.cacheKey}-native-car-surfaces`),
  'The release bridge must bypass cached pre-palette car factories');
assert.doesNotMatch(emergencyModelsSource, /BoxGeometry|applyFixedEmergencyLivery|installSecondaryAccent/);

assert.match(lotSource, /black-and-gold competition coupe/i);
assert.match(lotSource, /integrated high rear wing/i);
assert.doesNotMatch(lotSource, /four rally lamps|roll hoop|rocker steps/i);

console.log('TURN Rally Racer native black-and-gold surface reward passed.');
