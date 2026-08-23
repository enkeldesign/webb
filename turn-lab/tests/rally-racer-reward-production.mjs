import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [
  catalogSource,
  carModelsSource,
  emergencyModelsSource,
  semanticSource,
  lotVehicleCopySource,
  releaseSource
] = await Promise.all([
  fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/emergency-livery-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/semantic-car-finish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-vehicle-copy.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8')
]);
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const rally = catalog.getCarDefinition('toy-racer');
const release = JSON.parse(releaseSource);

assert.equal(rally.name, 'Rally Racer');
assert.equal(rally.id, 'toy-racer', 'Rally must preserve its stable storage, replay and reward ID');
assert.equal(rally.pack, 'car', 'The new Rally source belongs to the Kenney Car Kit palette family');
assert.equal(rally.asset, './assets/cars/sedan-sports.glb', 'Rally should use the former Sport Sedan model');
assert.equal(rally.surfaceProfileId, 'sedan-sports-rally');
assert.equal(rally.defaultColor, '#111111', 'The final reward should retain its black competition body');
assert.equal(rally.defaultSecondaryColor, '#ffcc00', 'The native rally trim should use TURN trophy gold');
assert.deepEqual(rally.defaultSecondaryColorP3, [1, 0.76, 0]);
assert.equal(rally.secondaryPaint?.label, 'Rally trim');
assert.deepEqual(rally.secondaryPaint?.meshNames, ['spoiler']);
assert.equal(rally.visualUpgrade, null, 'Rally must not opt into generated presentation geometry');
assert.equal(rally.perk?.title, 'TWITCHY TURNY');
assert.equal(rally.tuning.driftBoostRechargeMultiplier, 3.6);

assert.match(semanticSource, /'sedan-sports-rally': profile\(\{/);
assert.match(semanticSource, /primary: \[\[6, 2\], \[6, 3\]\]/,
  'Rally body paint must target the former Sport Sedan authored body cells');
assert.match(semanticSource, /secondary: \[\[3, 4\], \[3, 5\]\]/,
  'Rally gold must target the authored lower trim cells');
assert.match(semanticSource, /rims: \[\[5, 4\], \[5, 5\]\]/);
assert.match(semanticSource, /rimRole: 'secondary'/,
  'Rally wheel centres should share the trophy-gold trim colour');
assert.match(semanticSource, /secondaryPrimaryNodes: \['spoiler'\]/,
  'The former Sport Sedan spoiler must become Rally gold rather than body black');
assert.match(semanticSource, /surfaceProfileId \|\| car\.id/,
  'Paint semantics must follow the mounted source model while logical IDs stay stable');
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

assert.match(lotVehicleCopySource, /'toy-racer': 'A black-and-gold competition car/);
assert.match(lotVehicleCopySource, /high rear wing and rally-bred trim/);

console.log('TURN Rally Racer former-Sport-Sedan black-and-gold surface reward passed.');
