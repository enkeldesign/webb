import fs from 'node:fs';

function replaceOnce(path, oldText, newText) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`Expected anchor not found in ${path}: ${oldText.slice(0, 100)}`);
  fs.writeFileSync(path, source.replace(oldText, newText));
}

replaceOnce('turn/vehicle/catalog.js',
  'export const VEHICLE_SELECTION_VERSION = 6;',
  'export const VEHICLE_SELECTION_VERSION = 7;');
replaceOnce('turn/vehicle/catalog.js',
  "  convertible: Object.freeze({ fallback: '#393329' }),",
  "  convertible: Object.freeze({ fallback: '#aa9988' }),");
replaceOnce('turn/vehicle/catalog.js',
  "  tractor: Object.freeze({ fallback: '#ffcc00', p3: Object.freeze([1, 0.76, 0]) }),",
  "  tractor: Object.freeze({ fallback: '#666000' }),");
replaceOnce('turn/vehicle/catalog.js',
`  convertible: Object.freeze([
    Object.freeze({ color: '#0555aa', secondaryColor: '#163f7a' }),
    Object.freeze({ color: '#ff4fa3', secondaryColor: '#792766' })
  ]),`,
`  convertible: Object.freeze([
    Object.freeze({ color: '#0555aa', secondaryColor: '#163f7a' }),
    Object.freeze({ color: '#ff4fa3', secondaryColor: '#792766' }),
    Object.freeze({ color: '#776655', secondaryColor: '#393329' })
  ]),
  tractor: Object.freeze([
    Object.freeze({ color: '#4f7f36', secondaryColor: '#ffcc00' })
  ]),`);

replaceOnce('turn/race/rival-storage.js',
  'export const RIVAL_STORAGE_VERSION = 7;',
  'export const RIVAL_STORAGE_VERSION = 8;');

replaceOnce('turn-tests/tractor-smv-production.mjs',
  "assert.match(catalogSource, /tractor: Object\\.freeze\\(\\{ fallback: '#ffcc00'/);",
  "assert.match(catalogSource, /tractor: Object\\.freeze\\(\\{ fallback: '#666000' \\}\\)/);");

{
  const path = 'turn-lab/tests/native-paint-production.mjs';
  let source = fs.readFileSync(path, 'utf8').replaceAll("secondaryColor: '#393329'", "secondaryColor: '#aa9988'");
  const anchor = `assert.deepEqual(
  catalog.normalizeStoredVehiclePaint({
    carId: 'convertible',
    color: '#ff4fa3',
    secondaryColor: '#792766'
  }, { migrateReplacedFactoryPaint: true }),
  { carId: 'convertible', color: '#776655', secondaryColor: '#aa9988', factoryPaint: true },
  'The previous pink AWD factory pair must migrate to the current brown pair atomically'
);`;
  if (!source.includes(anchor)) throw new Error('Updated AWD migration anchor not found');
  source = source.replace(anchor, `${anchor}
assert.deepEqual(
  catalog.normalizeStoredVehiclePaint({
    carId: 'convertible',
    color: '#776655',
    secondaryColor: '#393329'
  }, { migrateReplacedFactoryPaint: true }),
  { carId: 'convertible', color: '#776655', secondaryColor: '#aa9988', factoryPaint: true },
  'The previous brown AWD factory secondary must migrate to #aa9988 without rewriting custom paint'
);
assert.deepEqual(
  catalog.normalizeStoredVehiclePaint({
    carId: 'tractor',
    color: '#4f7f36',
    secondaryColor: '#ffcc00'
  }, { migrateReplacedFactoryPaint: true }),
  { carId: 'tractor', color: '#4f7f36', secondaryColor: '#666000', factoryPaint: true },
  'The previous Tractor factory yellow must migrate to the new olive secondary'
);`);
  const carAnchor = "const supercar = catalog.getCarDefinition('supercar');";
  if (!source.includes(carAnchor)) throw new Error('Native paint car-definition anchor not found');
  source = source.replace(carAnchor,
`const awd = catalog.getCarDefinition('convertible');
assert.equal(awd.defaultSecondaryColor, '#aa9988');
const tractor = catalog.getCarDefinition('tractor');
assert.equal(tractor.defaultSecondaryColor, '#666000');
${carAnchor}`);
  fs.writeFileSync(path, source);
}

replaceOnce('turn-lab/tests/garage-production.mjs',
  'assert.match(rivalStorage, /RIVAL_STORAGE_VERSION = 7/);',
  'assert.match(rivalStorage, /RIVAL_STORAGE_VERSION = 8/);');

{
  const path = 'turn/content/about-history-current.js';
  let source = fs.readFileSync(path, 'utf8');
  const insertionAnchor = 'const previousLatest = BASE_CHANGELOG.at(-1);';
  const history = `const FACTORY_SECONDARY_PAINT_HISTORY = Object.freeze({
  period: '16 September',
  title: 'Factory secondary paint gets tuned',
  paragraphs: Object.freeze([
    'TURN 1.21.0 build r247 retunes two factory secondary colours without changing body paint or vehicle behaviour. TRACTOR keeps its green body and changes its secondary paint to #666000; AWD keeps its brown body and changes its secondary paint to #aa9988.',
    'Existing factory-painted vehicle selections and saved rivals migrate to the new pairs. Custom PAINTJOB combinations remain untouched.'
  ]),
  milestones: Object.freeze([
    'TRACTOR factory secondary: #666000',
    'AWD factory secondary: #aa9988',
    'TURN 1.21.0 · 2026.09.16-r247'
  ])
});

`;
  if (!source.includes(insertionAnchor)) throw new Error('History insertion anchor not found');
  source = source.replace(insertionAnchor, history + insertionAnchor);
  source = source.replace(
`  HOME_TAGLINE_FLOW_HISTORY,
  TRACTOR_SMV_HISTORY
]);`,
`  HOME_TAGLINE_FLOW_HISTORY,
  TRACTOR_SMV_HISTORY,
  FACTORY_SECONDARY_PAINT_HISTORY
]);`);
  const changelogAnchor = "    Object.freeze(['TRACTOR SHIFT step', 'Uses the normal SHIFT system to move from 1 / 1 / 5 / 1 / 5 / 5 to 2 / 2 / 4 / 2 / 4 / 4.'])";
  if (!source.includes(changelogAnchor)) throw new Error('16 September changelog anchor not found');
  source = source.replace(changelogAnchor,
`${changelogAnchor},
    Object.freeze(['1.21.0 r247', 'Retunes factory secondary paint: TRACTOR to #666000 and AWD to #aa9988 while keeping their body colours unchanged.']),
    Object.freeze(['Factory paint migration', 'Moves existing factory-painted selections and saved rivals to the new secondary colours without changing custom PAINTJOB combinations.'])`);
  fs.writeFileSync(path, source);
}

{
  const path = 'turn/release.json';
  const release = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (release.version !== '1.21.0' || release.id !== '2026.09.16-r246' || release.cacheKey !== '20260916-r246') {
    throw new Error(`Unexpected release base: ${JSON.stringify(release)}`);
  }
  release.id = '2026.09.16-r247';
  release.cacheKey = '20260916-r247';
  fs.writeFileSync(path, `${JSON.stringify(release, null, 2)}\n`);
}
