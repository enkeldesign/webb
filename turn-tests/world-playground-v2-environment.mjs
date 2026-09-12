import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const read = (relative) => fs.readFile(path.join(repoDir, relative), 'utf8');

const [
  mapSource,
  environmentFacade,
  environmentR3,
  landmarksSource,
  sessionSource,
  labBootstrapSource,
  labIndex
] = await Promise.all([
  read('turn/training/world-playground-v2-map.js'),
  read('turn/training/world-playground-v2-environment.js'),
  read('turn/training/world-playground-v2-environment-r3.js'),
  read('turn/training/world-playground-v2-landmarks-r1.js'),
  read('turn/training/world-playground-v2-session.js'),
  read('turn-lab/lab-bootstrap.js'),
  read('turn-lab/index.html')
]);

const mapModule = await import(`data:text/javascript;base64,${Buffer.from(mapSource).toString('base64')}`);
const {
  WORLD_PLAYGROUND_V2_BOUNDS,
  WORLD_PLAYGROUND_V2_BOUNDARY,
  WORLD_PLAYGROUND_V2_ROUTE,
  WORLD_PLAYGROUND_V2_SAMPLE_COUNT,
  WORLD_PLAYGROUND_V2_SEA_LEVEL,
  worldPlaygroundV2BaseHeight,
  worldPlaygroundV2CoastX
} = mapModule;

assert.ok(WORLD_PLAYGROUND_V2_SAMPLE_COUNT >= 1400, 'World V2 should sample the long environment loop densely');
assert.ok(WORLD_PLAYGROUND_V2_ROUTE.length >= 30, 'World V2 route needs deliberate authored geography');
assert.ok(WORLD_PLAYGROUND_V2_BOUNDARY.length >= 18, 'World V2 needs a broad shore/mountain world boundary');
assert.ok(WORLD_PLAYGROUND_V2_BOUNDS.maxX - WORLD_PLAYGROUND_V2_BOUNDS.minX >= 2600);
assert.ok(WORLD_PLAYGROUND_V2_BOUNDS.maxZ - WORLD_PLAYGROUND_V2_BOUNDS.minZ >= 1900);

let controlPolygonLength = 0;
for (let index = 0; index < WORLD_PLAYGROUND_V2_ROUTE.length; index += 1) {
  const current = WORLD_PLAYGROUND_V2_ROUTE[index];
  const next = WORLD_PLAYGROUND_V2_ROUTE[(index + 1) % WORLD_PLAYGROUND_V2_ROUTE.length];
  controlPolygonLength += Math.hypot(next.x - current.x, next.z - current.z);
}
assert.ok(controlPolygonLength > 5600, `World V2 should remain a multi-kilometre miniature world, got ${controlPolygonLength.toFixed(0)} m`);

const firstDistrict = (id) => WORLD_PLAYGROUND_V2_ROUTE.findIndex((point) => point.district === id);
assert.ok(firstDistrict('harbor') < firstDistrict('cliffside'));
assert.ok(firstDistrict('cliffside') < firstDistrict('mountain'));
assert.ok(firstDistrict('mountain') < firstDistrict('airport'));
assert.ok(firstDistrict('airport') < firstDistrict('countryside'));
assert.ok(firstDistrict('countryside') < firstDistrict('midnight-city'));

const cliffCoast = worldPlaygroundV2CoastX(-300);
assert.ok(worldPlaygroundV2BaseHeight(cliffCoast - 140, -300) < WORLD_PLAYGROUND_V2_SEA_LEVEL);
assert.ok(worldPlaygroundV2BaseHeight(-280, -845) > 100, 'MOUNTAIN must remain real elevated terrain');
assert.ok(worldPlaygroundV2BaseHeight(930, -55) < 55, 'AIRPORT must remain on a believable low plateau');

assert.match(environmentR3, /one-piece sculpted terrain r3/);
assert.match(environmentR3, /singleTerrainOwner: true/);
assert.match(environmentR3, /variableRoadScale: true/);
assert.match(environmentR3, /HARBOR quay groundwork/);
assert.match(environmentR3, /AIRPORT runway/);
assert.match(environmentR3, /COUNTRYSIDE field/);
assert.match(environmentR3, /MIDNIGHT CITY urban ground/);
assert.match(environmentR3, /MOUNTAIN village terrace/);
assert.match(environmentR3, /CLIFFSIDE coastal guardrail r3/);
assert.doesNotMatch(environmentR3, /GLTFLoader|makeRoadSign|CanvasTexture|TextGeometry/,
  'The terrain/environment layer must stay independent from landmark assets and signs');

assert.match(environmentFacade, /world-playground-v2-environment-r3\.js\?revision=r3-single-terrain/);
assert.match(environmentFacade, /world-playground-v2-landmarks-r1\.js\?revision=r1-macro-landmarks/);
assert.match(environmentFacade, /2026\.09\.12-lab-r216/);

for (const district of ['HARBOR', 'CLIFFSIDE', 'MOUNTAIN', 'COUNTRYSIDE', 'AIRPORT', 'MIDNIGHT CITY']) {
  assert.match(landmarksSource, new RegExp(`${district} macro landmarks`), `${district} needs a macro landmark group`);
}
assert.match(landmarksSource, /ship-ocean-liner\.glb/, 'CLIFFSIDE should reuse TURN’s classic ocean liner asset');
assert.match(landmarksSource, /fantasy-town\/windmill\.glb/, 'COUNTRYSIDE should reuse TURN’s classic windmill rotor asset');
assert.match(landmarksSource, /A320_nologo\.glb/);
assert.match(landmarksSource, /B787_nologo\.glb/);
assert.match(landmarksSource, /AIRPORT control tower/);
assert.match(landmarksSource, /MIDNIGHT CITY skyscraper/);
assert.match(landmarksSource, /HARBOR quay crane/);
assert.match(landmarksSource, /MOUNTAIN model village cabin/);
assert.match(landmarksSource, /signsInstalled: false/);
assert.doesNotMatch(landmarksSource, /makeRoadSign|CanvasTexture|TextGeometry/,
  'Macro landmark pass must not introduce signs or text geometry');

assert.match(sessionSource, /TURN LAB only/);
assert.match(sessionSource, /TRAINING_CAR_ID/);
assert.match(sessionSource, /lapActive = false/);
assert.match(sessionSource, /revision=r2-macro-landmarks-lab-r216/);
assert.match(sessionSource, /TURN WORLD V2 · LAB r216/);

assert.match(labBootstrapSource, /get\('world'\) === '2'/,
  'The query may still label World V2 explicitly, even though the branch entry button is always installed');
assert.doesNotMatch(labBootstrapSource, /if \(!worldV2Requested\) return/,
  'World V2 entry must be discoverable in plain TURN LAB on the review branch');
assert.match(labBootstrapSource, /world-playground-v2-session\.js\?revision=r2-macro-landmarks-lab-r216/);

assert.match(labIndex, /__TURN_LAB_BUILD__/);
assert.match(labIndex, /2026\.09\.12-lab-r216/);
assert.match(labIndex, /version: '1\.19\.1'/,
  'TURN LAB may bump independently while the production runtime version remains untouched');
assert.match(labIndex, /id: '2026\.09\.11-r215'/,
  'TURN LAB must continue to identify the production runtime source as r215');

console.log('TURN World Playground V2 r216 environment and macro-landmark contract verified.');
