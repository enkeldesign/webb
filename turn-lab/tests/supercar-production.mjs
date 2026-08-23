import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const carsDir = path.join(turnDir, 'assets', 'cars');

const [
  modelSource,
  carModels,
  catalogSource,
  trophyRoad,
  achievementCatalog,
  provenance
] = await Promise.all([
  fs.readFile(path.join(turnDir, 'vehicle', 'supercar-model-source.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle', 'car-models.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'vehicle', 'catalog.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'progression', 'trophy-road-chromatic-r183.js'), 'utf8'),
  fs.readFile(path.join(turnDir, 'achievements', 'catalog-chromatic-r183.js'), 'utf8'),
  fs.readFile(path.join(carsDir, 'SUPERCAR-CC0.md'), 'utf8')
]);

const parts = await Promise.all(Array.from({ length: 4 }, (_, index) => (
  fs.readFile(path.join(carsDir, `supercar.compact.gz.b64.${String(index).padStart(2, '0')}`), 'utf8')
)));
const compressed = Buffer.from(parts.join('').replace(/\s+/g, ''), 'base64');
const bundle = zlib.gunzipSync(compressed);

assert.equal(bundle.toString('ascii', 0, 4), 'TRVC', 'Supercar bundle must use TURN compact geometry format');
const headerLength = bundle.readUInt32LE(4);
const meta = JSON.parse(bundle.subarray(8, 8 + headerLength).toString('utf8'));
const car = meta.models?.['toy-racer'];
assert.ok(car, 'Supercar bundle must keep the toy-racer compatibility id');
assert.equal(car.positionCount, 3305, 'Supercar should keep the chosen Body 3 geometry');
assert.equal(
  car.materials.reduce((total, material) => total + material.indexCount / 3, 0),
  6014,
  'Supercar should keep the complete body, wheels and aggressive spoiler geometry'
);

const materials = new Set(car.materials.map((material) => String(material.name || '').toLowerCase()));
for (const expected of ['car', 'glass', 'tires', 'rims', 'spoiler']) {
  assert.ok(materials.has(expected), `Supercar must preserve ${expected} as a separate material`);
}

assert.match(provenance, /CC0/);
assert.match(provenance, /A_R7_Body_3\.fbx/);
assert.match(provenance, /A_R7_Spoiler_2fbx\.fbx/);
assert.match(modelSource, /PRIMARY_PAINT_MATERIAL = 'car'/);
assert.match(modelSource, /BUNDLE_PART_COUNT = 4/);
assert.match(modelSource, /DecompressionStream/);
assert.match(carModels, /loadSupercarSource/);
assert.match(carModels, /getSupercarPrimaryPaintMaterial/);
assert.match(carModels, /!isSupercar\(car\.id\)/,
  'Supercar must not use the broad legacy toy-car paint fallback');
assert.match(carModels, /isRgsdevCar\(car\?\.id\) \|\| isSupercar\(car\?\.id\)/,
  'Supercar rims must stay separate while tyre material gets TURN tyre treatment');
assert.match(catalogSource, /\['toy-racer', 'Supercar', 'toy'/);
assert.doesNotMatch(catalogSource, /'toy-racer': 0\.7/,
  'The old tiny toy-racer presentation scale must not shrink the new Supercar');
assert.match(catalogSource, /driftBoostRechargeMultiplier: 3\.6/,
  'TWITCHY TURNY tuning must remain unchanged');
assert.match(trophyRoad, /reward\.id === 'rally-racer'/,
  'The Trophy Road storage/reward id must remain compatible');
assert.match(trophyRoad, /title: 'SUPERCAR'/);
assert.match(trophyRoad, /shortTitle: 'Supercar'/);
assert.match(achievementCatalog, /'toy-racer': 'Supercar'/);

console.log('TURN Supercar vehicle refresh passed.');
