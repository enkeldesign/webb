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
assert.deepEqual(
  secondaryCars.map((car) => car.id),
  ['vintage-racer', 'toy-racer', 'monster-truck', 'race-future', 'sedan-sports'],
  'Only reward-car recipes, a genuine secondary mesh or a procedural visual upgrade should expose a second picker'
);
assert.equal(secondaryCars[0].secondaryPaint.label, 'Racing stripe');
assert.deepEqual(secondaryCars[0].secondaryPaint.meshNames, []);
assert.equal(secondaryCars[1].secondaryPaint.label, 'Rally kit');
assert.deepEqual(secondaryCars[1].secondaryPaint.meshNames, []);
assert.equal(secondaryCars[2].secondaryPaint.label, 'Suspension');
assert.deepEqual(secondaryCars[2].secondaryPaint.meshNames, []);
assert.equal(secondaryCars[3].secondaryPaint.label, 'Aero accents');
assert.deepEqual(secondaryCars[3].secondaryPaint.meshNames, []);
assert.equal(secondaryCars[4].secondaryPaint.label, 'Spoiler');
assert.deepEqual(secondaryCars[4].secondaryPaint.meshNames, ['spoiler']);

for (const id of ['firetruck', 'police', 'ambulance']) {
  const emergency = catalog.getCarDefinition(id);
  assert.equal(emergency.fixedLivery, true);
  assert.equal(emergency.secondaryPaint, null, `${emergency.name} must never expose repaint controls`);
}

const sportSedanGlb = await fs.readFile(new URL('../../turn/assets/cars/sedan-sports.glb', import.meta.url));
const sportSedanJson = readGlbJson(sportSedanGlb);
const meshNodeNames = (sportSedanJson.nodes || []).filter((node) => Number.isInteger(node.mesh)).map((node) => String(node.name || '').toLowerCase());
assert.ok(meshNodeNames.includes('body'), 'Sport Sedan body must remain a separate primary mesh');
assert.ok(meshNodeNames.includes('spoiler'), 'Sport Sedan spoiler must remain a separate secondary mesh');

const [index, releaseSource, lot, css, carModels, main, lapSystem, rivalStorage] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(lot, /input\.type = 'color'/, 'The Lot must use the browser or OS colour picker');
assert.match(lot, /inputLabel\.htmlFor = input\.id/, 'The native input must have an explicit HTML label');
assert.match(lot, /input\.addEventListener\('input'/, 'Native picker changes must preview immediately');
assert.doesNotMatch(lot, /CAR_PALETTE|makeColorButton|NAMED_COLOR_PRESETS|lot-color-preset/, 'Production must not add a custom or fallback palette');
assert.doesNotMatch(lot, /input\.className|input\.classList|input\.setAttribute\('aria-/, 'The native color input must remain semantically and visually native');
assert.doesNotMatch(css, /\.lot-color-input|input\[type=['"]?color/, 'TURN must not style the native color input itself');
assert.doesNotMatch(css, /\.lot-color\[aria-pressed=/, 'The retired custom swatch state must be removed');
assert.match(carModels, /turnSecondaryPaintMaterials/);
assert.match(carModels, /isSecondaryPaint\(node, car\)/);
assert.match(main, /vehicleSecondaryColor: initialVehicleSelection\.secondaryColor/);
assert.match(main, /secondaryColor: state\.vehicleSecondaryColor/);
assert.match(lapSystem, /carSecondaryColor: state\.vehicleSecondaryColor \|\| '#f8f9fa'/);
assert.match(rivalStorage, /version: 6/, 'Track-scoped rivals must preserve geometry revision and secondary paint metadata');
assert.match(rivalStorage, /normalizeVehicleSecondaryColor\(lap\.carSecondaryColor\)/);

console.log(`TURN ${release.id} bare native and secondary paint passed.`);

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
