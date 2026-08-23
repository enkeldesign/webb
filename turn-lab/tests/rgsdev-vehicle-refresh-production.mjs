import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const turnDir = path.join(root, 'turn');
const carsDir = path.join(turnDir, 'assets', 'cars');
const modelSource = await fs.readFile(path.join(turnDir, 'vehicle', 'rgsdev-model-source.js'), 'utf8');
const carModels = await fs.readFile(path.join(turnDir, 'vehicle', 'car-models.js'), 'utf8');
const provenance = await fs.readFile(path.join(carsDir, 'RGSDEV-VEHICLES.md'), 'utf8');

const expected = Object.freeze({
  convertible: 'body blue',
  classic: 'body dark yellow',
  'vintage-racer': 'body light yellow',
  'monster-truck': 'body light blue',
  race: 'body red',
  sedan: 'body grey',
  suv: 'body dark purple',
  firetruck: null,
  police: null,
  ambulance: null,
  truck: 'body dark green',
  van: 'body dark blue'
});

const parts = await Promise.all(Array.from({ length: 9 }, (_, index) => (
  fs.readFile(path.join(carsDir, `rgsdev-vehicles.compact.gz.b64.${String(index).padStart(2, '0')}`), 'utf8')
)));
const compressed = Buffer.from(parts.join('').replace(/\s+/g, ''), 'base64');
const bundle = zlib.gunzipSync(compressed);
const meta = readCompactHeader(bundle);

assert.deepEqual(Object.keys(meta.models).sort(), Object.keys(expected).sort());
assert.equal(meta.version, 2);
assert.equal(meta.bits, 8);
assert.ok(compressed.length < 60_000, 'All 12 replacement cars should remain a lightweight compressed payload');
assert.match(provenance, /CC0 License/);
assert.match(provenance, /Raphael Gonçalves \(Rgsdev\)/);
assert.match(modelSource, /typeof globalThis\.DecompressionStream !== 'function'/,
  'Legacy browsers must be able to fall back to TURN’s existing GLBs');
assert.match(modelSource, /flatShading: true/,
  'The compact source geometry should retain its low-poly faceted appearance');
assert.match(carModels, /loadRgsdevCarSource/);
assert.match(carModels, /installEmergencyLightRig/,
  'Emergency light rigs must remain TURN-owned and model-independent');
assert.match(carModels, /getRgsdevPrimaryPaintMaterial/,
  'PAINTJOB must use the RGSDev primary material contract');
assert.match(carModels, /!isRgsdevCar\(car\.id\) && car\.pack !== 'car'/,
  'Legacy toy/prototype paint fallback must not flatten RGSDev secondary materials');

for (const retained of ['toy-racer', 'race-future', 'sedan-sports']) {
  assert.doesNotMatch(modelSource, new RegExp(`['"]${retained}['"]`), `${retained} should keep its existing TURN model`);
}

for (const [id, primaryMaterial] of Object.entries(expected)) {
  const model = meta.models[id];
  assert.ok(model.positionCount > 0, `${id} must include source vertices`);
  const materialNames = model.materials.map((material) => String(material.name || '').toLowerCase());
  assert.ok(materialNames.some((name) => name.includes('wheels')), `${id} should preserve wheel-rim materials`);
  assert.ok(materialNames.some((name) => name.includes('tires')), `${id} should preserve tyre materials`);
  assert.ok(model.materials.every((material) => material.indexCount > 0 && material.indexCount % 3 === 0),
    `${id} material streams must contain complete triangles`);
  if (primaryMaterial) {
    assert.ok(materialNames.includes(primaryMaterial), `${id} must preserve ${primaryMaterial} for PAINTJOB`);
  }
}

console.log('TURN RGSDev CC0 vehicle refresh passed.');

function readCompactHeader(buffer) {
  assert.equal(buffer.toString('utf8', 0, 4), 'TRVC');
  const headerLength = buffer.readUInt32LE(4);
  assert.ok(8 + headerLength <= buffer.length, 'compact vehicle header must fit inside bundle');
  return JSON.parse(buffer.subarray(8, 8 + headerLength).toString('utf8'));
}
