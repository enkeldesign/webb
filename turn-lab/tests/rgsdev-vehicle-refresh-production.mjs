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

const parts = await Promise.all(Array.from({ length: 7 }, (_, index) => (
  fs.readFile(path.join(carsDir, `rgsdev-vehicles.tar.gz.b64.${String(index).padStart(2, '0')}`), 'utf8')
)));
const compressed = Buffer.from(parts.join('').replace(/\s+/g, ''), 'base64');
const entries = parseTar(zlib.gunzipSync(compressed));

assert.deepEqual([...entries.keys()].sort(), Object.keys(expected).map((id) => `${id}.glb`).sort());
assert.match(provenance, /CC0 License/);
assert.match(provenance, /Raphael Gonçalves \(Rgsdev\)/);
assert.match(modelSource, /typeof globalThis\.DecompressionStream !== 'function'/,
  'Legacy browsers must be able to fall back to TURN’s existing GLBs');
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
  const glb = entries.get(`${id}.glb`);
  assert.equal(glb.toString('utf8', 0, 4), 'glTF', `${id} must be a valid binary glTF`);
  const json = readGlbJson(glb);
  const materialNames = (json.materials || []).map((material) => String(material.name || '').toLowerCase());
  assert.ok(materialNames.some((name) => name.includes('wheels')), `${id} should preserve wheel materials`);
  assert.ok(materialNames.some((name) => name.includes('tires')), `${id} should preserve tyre materials`);
  if (primaryMaterial) {
    assert.ok(materialNames.includes(primaryMaterial), `${id} must preserve ${primaryMaterial} for PAINTJOB`);
  }
}

console.log('TURN RGSDev CC0 vehicle refresh passed.');

function parseTar(buffer) {
  const entries = new Map();
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = readString(header.subarray(0, 100));
    const size = Number.parseInt(readString(header.subarray(124, 136)) || '0', 8);
    const start = offset + 512;
    const end = start + size;
    assert.ok(end <= buffer.length, `tar entry ${name} must fit inside bundle`);
    entries.set(name, Buffer.from(buffer.subarray(start, end)));
    offset = start + Math.ceil(size / 512) * 512;
  }
  return entries;
}

function readString(buffer) {
  const zero = buffer.indexOf(0);
  return buffer.subarray(0, zero >= 0 ? zero : buffer.length).toString('utf8').trim();
}

function readGlbJson(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('utf8', offset + 4, offset + 8);
    if (type === 'JSON') {
      return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    }
    offset += 8 + length;
  }
  assert.fail('GLB has no JSON chunk');
}
