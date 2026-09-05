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
assert.deepEqual(
  catalog.normalizeStoredVehiclePaint({
    carId: 'convertible',
    color: '#0555aa',
    secondaryColor: '#163f7a'
  }, { migrateReplacedFactoryPaint: true }),
  { carId: 'convertible', color: '#776655', secondaryColor: '#393329', factoryPaint: true },
  'The briefly shipped blue AWD factory pair must migrate to the current brown pair atomically'
);
assert.deepEqual(
  catalog.normalizeStoredVehiclePaint({
    carId: 'convertible',
    color: '#ff4fa3',
    secondaryColor: '#792766'
  }, { migrateReplacedFactoryPaint: true }),
  { carId: 'convertible', color: '#776655', secondaryColor: '#393329', factoryPaint: true },
  'The previous pink AWD factory pair must migrate to the current brown pair atomically'
);
assert.deepEqual(
  catalog.normalizeStoredVehiclePaint({
    carId: 'suv',
    color: '#7d123e',
    secondaryColor: '#2f0918'
  }, { migrateReplacedFactoryPaint: true }),
  { carId: 'suv', color: '#0555aa', secondaryColor: '#163f7a', factoryPaint: true },
  'The briefly shipped pink Luxury SUV factory pair must migrate to blue as one atomic pair'
);
assert.deepEqual(
  catalog.normalizeStoredVehiclePaint({
    carId: 'convertible',
    color: '#0555aa',
    secondaryColor: '#abcdef'
  }, { migrateReplacedFactoryPaint: true }),
  { carId: 'convertible', color: '#0555aa', secondaryColor: '#abcdef', factoryPaint: false },
  'A partial or custom PAINTJOB match must never be rewritten'
);

const selectionStorage = createMemoryStorage();
globalThis.localStorage = selectionStorage;
selectionStorage.setItem(catalog.VEHICLE_SELECTION_KEY, JSON.stringify({
  carId: 'convertible',
  color: '#0555aa',
  secondaryColor: '#163f7a'
}));
assert.deepEqual(catalog.loadVehicleSelection(), {
  carId: 'convertible',
  color: '#776655',
  secondaryColor: '#393329'
});
assert.deepEqual(JSON.parse(selectionStorage.getItem(catalog.VEHICLE_SELECTION_KEY)), {
  version: catalog.VEHICLE_SELECTION_VERSION,
  carId: 'convertible',
  color: '#776655',
  secondaryColor: '#393329',
  factoryPaint: true
});

const secondaryCars = catalog.CAR_CATALOG.filter((car) => car.secondaryPaint);
assert.deepEqual(
  secondaryCars.map((car) => car.id),
  ['convertible', 'classic', 'vintage-racer', 'toy-racer', 'monster-truck', 'race-future', 'race', 'sedan-sports', 'sedan', 'suv', 'truck', 'van'],
  'Every player-repaintable car should expose a semantic second picker'
);
assert.equal(secondaryCars[0].secondaryPaint.label, 'Lower body trim');
assert.deepEqual(secondaryCars[0].secondaryPaint.meshNames, []);
assert.equal(secondaryCars[1].secondaryPaint.label, 'Bumpers & trim');
assert.equal(secondaryCars[2].secondaryPaint.label, 'Racing stripe');
assert.equal(secondaryCars[3].secondaryPaint.label, 'Rally trim');
assert.deepEqual(secondaryCars[3].secondaryPaint.meshNames, ['spoiler']);
assert.equal(secondaryCars[4].secondaryPaint.label, 'Suspension trim');
assert.equal(secondaryCars[5].secondaryPaint.label, 'Aero accents');
assert.equal(secondaryCars[6].secondaryPaint.label, 'Aero trim');
assert.equal(secondaryCars[7].secondaryPaint.label, 'Sport trim');
assert.deepEqual(secondaryCars[7].secondaryPaint.meshNames, []);
assert.ok(secondaryCars.slice(8).every((car) => car.secondaryPaint.label === 'Lower body trim'));

const rallyGlb = await fs.readFile(new URL('../../turn/assets/cars/sedan-sports.glb', import.meta.url));
const rallyJson = readGlbJson(rallyGlb, 'Rally Racer');
const rallyMeshNames = meshNodeNames(rallyJson);
assert.ok(rallyMeshNames.includes('body'), 'Rally Racer must inherit the Sport Sedan body mesh');
assert.ok(rallyMeshNames.includes('spoiler'), 'Rally Racer must inherit the Sport Sedan rear spoiler');

const hatchbackGlb = await fs.readFile(new URL('../../turn/assets/cars/hatchback-sports.glb', import.meta.url));
const hatchbackJson = readGlbJson(hatchbackGlb, 'Hatchback');
const hatchbackMeshNames = meshNodeNames(hatchbackJson);
assert.ok(hatchbackMeshNames.includes('body'), 'Hatchback must expose its authored body mesh');
assert.equal(hatchbackMeshNames.includes('spoiler'), false, 'Hatchback must not advertise the old Sedan spoiler control');

const [index, releaseSource, lot, css, carModels, semanticFinish, main, lapSystem, rivalStorage] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/garage/lot-r10.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/car-models.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/vehicle/semantic-car-finish.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/rival-storage.js', import.meta.url), 'utf8')
]);
const rivalStorageModule = await import(new URL(
  `../../turn/race/rival-storage.js?paint-migration-test=${Date.now()}`,
  import.meta.url
));

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
assert.match(carModels, /turnSemanticPaintRecords/);
assert.match(carModels, /recolorSemanticCarFinish/);
assert.match(semanticFinish, /surfaceProfileId \|\| car\.id/,
  'Semantic paint must follow the mounted source model rather than assuming gameplay ID equals mesh identity');
assert.match(semanticFinish, /material\.onBeforeCompile/,
  'Kenney paint must recolour the existing texture surface in the material shader');
assert.match(semanticFinish, /RGSDEV_PRIMARY_MATERIALS/,
  'Named-material models must share the same canonical paint API');
assert.match(main, /vehicleSecondaryColor: initialVehicleSelection\.secondaryColor/);
assert.match(main, /secondaryColor: state\.vehicleSecondaryColor/);
assert.match(lapSystem, /factoryPaint: paint\.factoryPaint/,
  'New rivals must record whether their colors came from the factory pair');
assert.match(rivalStorage, /RIVAL_STORAGE_VERSION = 7/,
  'Track-scoped rivals must version the AWD and SUV paint migration');
assert.match(rivalStorage, /normalizeStoredVehiclePaint\(/,
  'Rival previews must use the same car-specific paint normalization as The Lot');

const replayFrames = Array.from({ length: 21 }, (_, index) => ({
  t: index / 20,
  x: index,
  z: 0,
  h: 0
}));
function storedReplay(lap) {
  selectionStorage.setItem('turn-personal-rivals-v1', JSON.stringify({ version: 6, laps: [lap] }));
  return rivalStorageModule.getStoredBestReplayLap('countryside');
}
assert.deepEqual(
  (({ carId, carColor, carSecondaryColor, factoryPaint }) => ({
    carId, carColor, carSecondaryColor, factoryPaint
  }))(storedReplay({
    time: 10,
    carId: 'convertible',
    carColor: '#0555aa',
    carSecondaryColor: '#163f7a',
    frames: replayFrames
  })),
  { carId: 'convertible', carColor: '#776655', carSecondaryColor: '#393329', factoryPaint: true },
  'Saved blue AWD ghosts from the swapped release must follow the current brown factory paint'
);
assert.deepEqual(
  (({ carId, carColor, carSecondaryColor, factoryPaint }) => ({
    carId, carColor, carSecondaryColor, factoryPaint
  }))(storedReplay({
    time: 10,
    carId: 'convertible',
    carColor: '#ff4fa3',
    carSecondaryColor: '#792766',
    frames: replayFrames
  })),
  { carId: 'convertible', carColor: '#776655', carSecondaryColor: '#393329', factoryPaint: true },
  'Saved pink AWD ghosts from the previous factory pair must follow the current brown factory paint'
);
assert.deepEqual(
  (({ carId, carColor, carSecondaryColor, factoryPaint }) => ({
    carId, carColor, carSecondaryColor, factoryPaint
  }))(storedReplay({
    time: 10,
    carId: 'suv',
    carColor: '#7d123e',
    carSecondaryColor: '#2f0918',
    frames: replayFrames
  })),
  { carId: 'suv', carColor: '#0555aa', carSecondaryColor: '#163f7a', factoryPaint: true },
  'Saved pink Luxury SUV ghosts from the swapped release must follow the repaired blue factory paint'
);
assert.deepEqual(
  (({ carColor, carSecondaryColor, factoryPaint }) => ({ carColor, carSecondaryColor, factoryPaint }))(
    storedReplay({
      time: 10,
      carId: 'convertible',
      carColor: '#0555aa',
      carSecondaryColor: '#abcdef',
      frames: replayFrames
    })
  ),
  { carColor: '#0555aa', carSecondaryColor: '#abcdef', factoryPaint: false },
  'A saved custom rival PAINTJOB must survive the factory migration'
);

console.log(`TURN ${release.id} Hatchback, Rally Racer and native secondary paint passed.`);

function readGlbJson(buffer, label) {
  assert.equal(buffer.toString('utf8', 0, 4), 'glTF');
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('utf8', offset + 4, offset + 8);
    if (type === 'JSON') return JSON.parse(buffer.subarray(offset + 8, offset + 8 + length).toString('utf8').trim());
    offset += 8 + length;
  }
  assert.fail(`${label} has no GLB JSON chunk`);
}

function meshNodeNames(json) {
  return (json.nodes || [])
    .filter((node) => Number.isInteger(node.mesh))
    .map((node) => String(node.name || '').toLowerCase());
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    }
  };
}
