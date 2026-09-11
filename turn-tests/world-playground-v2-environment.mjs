import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(scriptDir, '..');
const mapPath = path.join(repoDir, 'turn/training/world-playground-v2-map.js');
const environmentPath = path.join(repoDir, 'turn/training/world-playground-v2-environment.js');
const sessionPath = path.join(repoDir, 'turn/training/world-playground-v2-session.js');
const labBootstrapPath = path.join(repoDir, 'turn-lab/lab-bootstrap.js');

const [mapSource, environmentSource, sessionSource, labBootstrapSource] = await Promise.all([
  fs.readFile(mapPath, 'utf8'),
  fs.readFile(environmentPath, 'utf8'),
  fs.readFile(sessionPath, 'utf8'),
  fs.readFile(labBootstrapPath, 'utf8')
]);

const mapModule = await import(`data:text/javascript;base64,${Buffer.from(mapSource).toString('base64')}`);
const {
  WORLD_PLAYGROUND_V2_BOUNDS,
  WORLD_PLAYGROUND_V2_BOUNDARY,
  WORLD_PLAYGROUND_V2_ROAD_WIDTH,
  WORLD_PLAYGROUND_V2_ROUTE,
  WORLD_PLAYGROUND_V2_SAMPLE_COUNT,
  WORLD_PLAYGROUND_V2_SEA_LEVEL,
  worldPlaygroundV2BaseHeight,
  worldPlaygroundV2CoastX
} = mapModule;

assert.equal(WORLD_PLAYGROUND_V2_ROAD_WIDTH, 27, 'World V2 should inherit Cliffside-like road scale instead of the oversized r214 road');
assert.ok(WORLD_PLAYGROUND_V2_SAMPLE_COUNT >= 1400, 'World V2 should sample the long environment loop densely');
assert.ok(WORLD_PLAYGROUND_V2_ROUTE.length >= 30, 'World V2 route should have enough authored control points for deliberate geography');
assert.ok(WORLD_PLAYGROUND_V2_BOUNDARY.length >= 18, 'World V2 needs a broad authored shore/mountain world boundary');
assert.ok(WORLD_PLAYGROUND_V2_BOUNDS.maxX - WORLD_PLAYGROUND_V2_BOUNDS.minX >= 2600, 'World V2 must be materially wider than the r214 prototype');
assert.ok(WORLD_PLAYGROUND_V2_BOUNDS.maxZ - WORLD_PLAYGROUND_V2_BOUNDS.minZ >= 1900, 'World V2 must be materially deeper than the r214 prototype');

let controlPolygonLength = 0;
for (let index = 0; index < WORLD_PLAYGROUND_V2_ROUTE.length; index += 1) {
  const current = WORLD_PLAYGROUND_V2_ROUTE[index];
  const next = WORLD_PLAYGROUND_V2_ROUTE[(index + 1) % WORLD_PLAYGROUND_V2_ROUTE.length];
  controlPolygonLength += Math.hypot(next.x - current.x, next.z - current.z);
}
assert.ok(controlPolygonLength > 5600, `World V2 control loop should be around a multi-kilometre miniature world, got ${controlPolygonLength.toFixed(0)} m`);

const firstDistrict = (id) => WORLD_PLAYGROUND_V2_ROUTE.findIndex((point) => point.district === id);
assert.ok(firstDistrict('harbor') < firstDistrict('cliffside'));
assert.ok(firstDistrict('cliffside') < firstDistrict('mountain'));
assert.ok(firstDistrict('mountain') < firstDistrict('airport'));
assert.ok(firstDistrict('airport') < firstDistrict('countryside'));
assert.ok(firstDistrict('countryside') < firstDistrict('midnight-city'));

const cliffCoast = worldPlaygroundV2CoastX(-300);
assert.ok(worldPlaygroundV2BaseHeight(cliffCoast - 140, -300) < WORLD_PLAYGROUND_V2_SEA_LEVEL, 'Terrain west of the Cliffside coast should be below the sea plane');
assert.ok(worldPlaygroundV2BaseHeight(-280, -845) > 100, 'MOUNTAIN must be real elevated terrain rather than backdrop cones');
assert.ok(worldPlaygroundV2BaseHeight(930, -55) < 55, 'AIRPORT side of the map should stay on a believable low plateau');

assert.match(environmentSource, /continuous sculpted terrain/, 'Environment must build a continuous terrain mesh');
assert.match(environmentSource, /road-integrated terrain bed/, 'Road must have a terrain bed instead of hanging freely in space');
assert.match(environmentSource, /gradedTerrainHeight/, 'Base terrain must be cut\/filled toward the road corridor');
assert.match(environmentSource, /Cliffside coastal guardrail/, 'Cliffside should retain its grounded coastal-road language');
assert.match(environmentSource, /procedural sky/, 'Environment should have a coherent procedural atmosphere without art assets');
assert.match(environmentSource, /assetsInstalled = false/, 'Environment pass must stay asset-free');
assert.match(environmentSource, /signsInstalled = false/, 'Environment pass must stay sign-free');
assert.doesNotMatch(environmentSource, /GLTFLoader|\/assets\/|makeRoadSign|CanvasTexture|TextGeometry/, 'Environment pass must not smuggle in landmark assets or signs');

assert.match(sessionSource, /TURN LAB only/, 'World V2 must remain isolated in TURN LAB while art direction is being reviewed');
assert.match(sessionSource, /TRAINING_CAR_ID/, 'Environment review should use the Learner Car');
assert.match(sessionSource, /lapActive = false/, 'Environment review must not behave like a seventh competitive race track');
assert.match(labBootstrapSource, /get\('world'\) === '2'/, 'TURN LAB should expose World V2 only through the explicit ?world=2 experiment route');
assert.match(labBootstrapSource, /world-playground-v2-session\.js\?revision=r1-environment/, 'TURN LAB query should install the current World V2 environment session');

console.log('TURN World Playground V2 environment contract verified.');
