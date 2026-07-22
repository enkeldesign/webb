import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const catalogSource = await fs.readFile(new URL('../../turn/vehicle/catalog.js', import.meta.url), 'utf8');
const catalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);

assert.equal(catalog.normalizeVehicleColor('#12AbEf'), '#12abef', 'Native picker colours must not be palette-limited');
assert.equal(catalog.normalizeVehicleColor('#fff'), catalog.DEFAULT_VEHICLE_COLOR, 'Invalid short hex must use the body fallback');
assert.equal(catalog.normalizeVehicleSecondaryColor('#654321'), '#654321', 'Secondary paint must accept a native picker value');
assert.deepEqual(
  catalog.normalizeVehicleSelection({ carId: 'sedan-sports', color: '#123456', secondaryColor: '#abcdef' }),
  { carId: 'sedan-sports', color: '#123456', secondaryColor: '#abcdef' },
  'Vehicle selection must persist both native colours'
);

const secondaryCars = catalog.CAR_CATALOG.filter((car) => car.secondaryPaint);
assert.deepEqual(secondaryCars.map((car) => car.id), ['sedan-sports'], 'Only genuinely separate secondary meshes should expose a second picker');
assert.equal(secondaryCars[0].secondaryPaint.label, 'Spoiler');
assert.deepEqual(secondaryCars[0].secondaryPaint.meshNames, ['spoiler']);

const sportSedanGlb = await fs.readFile(new URL('../../turn/assets/cars/sedan-sports.glb', import.meta.url));
const sportSedanJson = readGlbJson(sportSedanGlb);
const meshNodeNames = (sportSedanJson.nodes || []).filter((node) => Number.isInteger(node.mesh)).map((node) => String(node.name || '').toLowerCase());
assert.ok(meshNodeNames.includes('body'), 'Sport Sedan body must remain a separate primary mesh');
assert.ok(meshNodeNames.includes('spoiler'), 'Sport Sedan spoiler must remain a separate secondary mesh');

const [index, lot, css, carModels, main, lapSystem, rivalStorage] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.29 · Build 2026\.07\.22-r46/);
assert.match(lot, /input\.type = 'color'/, 'The Lot must invoke the browser or OS colour picker');
assert.match(lot, /input\.addEventListener\('input'/, 'Native picker changes must preview immediately');
assert.doesNotMatch(lot, /CAR_PALETTE|makeColorButton/, 'The production Lot must not render the custom palette');
assert.match(css, /\.lot-color-input/);
assert.doesNotMatch(css, /\.lot-color\[aria-pressed=/, 'The retired custom swatch state must be removed');
assert.match(carModels, /turnSecondaryPaintMaterials/);
assert.match(carModels, /isSecondaryPaint\(node, car\)/);
assert.match(main, /vehicleSecondaryColor: initialVehicleSelection\.secondaryColor/);
assert.match(main, /secondaryColor: state\.vehicleSecondaryColor/);
assert.match(lapSystem, /carSecondaryColor: state\.vehicleSecondaryColor \|\| '#f8f9fa'/);
assert.match(rivalStorage, /version: 4/);
assert.match(rivalStorage, /normalizeVehicleSecondaryColor\(lap\.carSecondaryColor\)/);

console.log('TURN native and secondary paint regression passed.');

function readGlbJson(buffer) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF');
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('utf8', offset + 4, offset + 8);
    if (type === 'JSON') return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    offset += 8 + length;
  }
  assert.fail('Sport Sedan has no GLB JSON chunk');
}