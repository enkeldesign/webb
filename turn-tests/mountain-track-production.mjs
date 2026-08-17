import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import { TRACK_DEFINITIONS, TRACK_PLACEHOLDERS } from '../turn/tracks/definitions.js';
import { MOUNTAIN_CONTROL_POINTS, MOUNTAIN_LAYOUT_RULES } from '../turn/tracks/mountain-layout.js';
import { getTrackPaceNotes, PACE_NOTE_DIRECTION } from '../turn/tracks/pace-notes.js';
import { TROPHY_ROAD_REWARDS, rewardForTrack } from '../turn/progression/trophy-road.js';
import { TRACK_COLOR_CUES } from '../turn/accessibility/color-cues.js';
import { TRACK_COLOR_RULES } from '../turn/achievements/chromatic-camouflage-r183.js';

const [world, terrain, scenery, registry, trophyGate, kenneyAssets, visualPage, visualSmoke, visualWorkflow] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3-terrain.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3-scenery.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/assets/KENNEY-ASSETS.md', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/mountain-visual.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('./mountain-visual-smoke.mjs', import.meta.url), 'utf8'),
  fs.readFile(new URL('../.github/workflows/turn-mountain-visual-smoke.yml', import.meta.url), 'utf8')
]);

const definition = TRACK_DEFINITIONS.find((track) => track.id === 'mountain');
assert.ok(definition, 'MOUNTAIN must be a production track definition');
assert.equal(definition.name, 'Mountain');
assert.equal(definition.eyebrow, 'TRACK 6');
assert.equal(definition.difficulty, 'HARD');
assert.equal(definition.storageRevision, 'mountain-r1');
assert.equal(definition.sampleCount, 1080);
assert.equal(definition.freeRoamDistance, 22.2);
assert.deepEqual(TRACK_PLACEHOLDERS, []);
assert.equal(MOUNTAIN_LAYOUT_RULES.minimumElevation, 0);
assert.equal(MOUNTAIN_LAYOUT_RULES.maximumElevation, 49);
assert.equal(MOUNTAIN_LAYOUT_RULES.snowLineElevation, 37);
assert.ok(closedLength(MOUNTAIN_CONTROL_POINTS) > 1500);
assert.equal(findProperIntersections(MOUNTAIN_CONTROL_POINTS).length, 0);
assert.ok(maximumTurn(MOUNTAIN_CONTROL_POINTS) < 100);

const reward = rewardForTrack('mountain');
assert.equal(reward?.id, 'mountain');
assert.equal(reward?.threshold, 1000);
assert.equal(TROPHY_ROAD_REWARDS.at(-1)?.id, 'mountain');
assert.match(trophyGate, /rewardForTrack\(trackId\)/);
assert.doesNotMatch(trophyGate, /trackId === ['"]mountain['"]/);

const notes = getTrackPaceNotes('mountain');
assert.ok(notes.length >= 8);
assert.equal(notes[0].groups[0].direction, PACE_NOTE_DIRECTION.LEFT,
  'The verified MOUNTAIN opening call must stay left from the driver perspective');
const slalomNotes = notes.filter((note) => note.triggerStart >= 0.59 && note.triggerStart < 0.95);
assert.deepEqual(
  slalomNotes.slice(0, 4).map((note) => note.groups[0].direction),
  [1, -1, 1, -1],
  'The verified front-face slalom must alternate right/left from the driver perspective'
);

assert.equal(TRACK_COLOR_CUES.mountain, 'blue');
assert.deepEqual(TRACK_COLOR_RULES.mountain, { hueMin: 206, hueMax: 230, name: 'blue' });

assert.match(registry, /mountain-world-r3\.js\?revision=r3-continuous-terrain-v1/);
assert.match(world, /version: 'r3'/);
assert.match(world, /continuous-snow-and-granite-terrain-body/);
assert.match(world, /roadbed: 'opaque-and-terrain-supported'/);
assert.match(world, /riverHasChannelBanksAndBed: true/);
assert.match(world, /boundingBoxGroundedAssets: true/);
assert.match(world, /world\.ready = Promise\.resolve/);
assert.doesNotMatch(world, /setAnimationLoop|requestAnimationFrame|setInterval/);

assert.match(terrain, /Mountain continuous terrain body r3/);
assert.match(terrain, /createMountainTerrainSampler/);
assert.match(terrain, /terrainHeightAt/);
assert.match(terrain, /riverChannelTarget/);
assert.match(terrain, /lakeBasinTarget/);
assert.match(terrain, /Mountain opaque roadbed side wall r3/);
assert.match(terrain, /Mountain closed roadbed underside r3/);
assert.match(terrain, /Mountain solid white road edge r3/);
assert.match(terrain, /Mountain black outer road contour r3/);
assert.match(terrain, /raggedSnowLine/);
assert.doesNotMatch(terrain, /Mountain continuous snowfield/,
  'The old flat plane must no longer pretend to be the playable mountain');
assert.doesNotMatch(terrain, /ALPINE_BLUE|curb/i,
  'MOUNTAIN uses ordinary white road lines with a black contour, never race curbs');

assert.match(scenery, /new THREE\.Box3\(\)\.setFromObject\(root, true\)/,
  'Imported scenery must ground its transformed bounds, not its arbitrary GLB origin');
assert.match(scenery, /turnMountainGroundingDiagnostics/);
assert.match(scenery, /terrainHeightAt\(point\.x, point\.z\)/);
assert.match(scenery, /Mountain river channel bed r3/);
assert.match(scenery, /Mountain summit river water r3/);
assert.match(scenery, /Mountain river waterfall cliff lip r3/);
assert.match(scenery, /Mountain terrain-bounded waterfall lake r3/);
assert.match(scenery, /Mountain structural waterfall granite r3/);
assert.match(scenery, /Mountain Kenney Nature cliff module r3/);
assert.match(scenery, /scale\.setScalar\(8\.2/,
  'Nature cliff modules must be tiled at modest near-uniform scale rather than stretched into giant slabs');
assert.match(scenery, /cabin-doorway\.glb/);
assert.match(scenery, /cabin-window-large\.glb/);
assert.match(scenery, /cabin-roof-snow\.glb/);
assert.match(scenery, /roofB\.scale\.x = -1/,
  'The second Holiday roof half must mirror across the ridge rather than rotate through the cabin');
assert.match(scenery, /turnKenneyGridAssembly/);
assert.match(scenery, /wallRows: 1/,
  'Holiday wall modules must use their one-unit grid instead of overlapping arbitrary stacked rows');
for (const asset of [
  'bench.glb', 'lantern.glb', 'sled.glb', 'snow-pile.glb', 'snow-flat-large.glb', 'tree-snow-a.glb',
  'stall-green.glb', 'stall-red.glb', 'cart.glb', 'fountain-round-detail.glb', 'fence.glb'
]) {
  assert.match(scenery, new RegExp(asset.replace('.', '\\.')));
}
assert.doesNotMatch(scenery, /windmill\.glb|Fantasy Town windmill/i,
  'The loose Fantasy Town rotor must not be mistaken for a complete windmill again');
assert.doesNotMatch(scenery, /setAnimationLoop|requestAnimationFrame|setInterval/);

const glbPaths = [
  'turn/assets/scenery/mountain/holiday/cabin-wall.glb',
  'turn/assets/scenery/mountain/holiday/cabin-doorway.glb',
  'turn/assets/scenery/mountain/holiday/cabin-window-large.glb',
  'turn/assets/scenery/mountain/holiday/cabin-roof-snow.glb',
  'turn/assets/scenery/mountain/holiday/bench.glb',
  'turn/assets/scenery/mountain/holiday/lantern.glb',
  'turn/assets/scenery/mountain/holiday/sled.glb',
  'turn/assets/scenery/mountain/holiday/snow-pile.glb',
  'turn/assets/scenery/mountain/holiday/snow-flat-large.glb',
  'turn/assets/scenery/mountain/holiday/tree-snow-a.glb',
  'turn/assets/scenery/mountain/fantasy/stall-green.glb',
  'turn/assets/scenery/mountain/fantasy/stall-red.glb',
  'turn/assets/scenery/mountain/fantasy/cart.glb',
  'turn/assets/scenery/mountain/fantasy/fountain-round-detail.glb',
  'turn/assets/scenery/mountain/fantasy/fence.glb',
  'turn/assets/scenery/mountain/nature/cliff-waterfall-top-rock.glb',
  'turn/assets/scenery/mountain/nature/cliff-waterfall-rock.glb'
];

for (const assetPath of glbPaths) {
  const url = new URL(`../${assetPath}`, import.meta.url);
  const buffer = await fs.readFile(url);
  const gltf = parseGlbJson(buffer, assetPath);
  assert.equal(gltf.asset?.version, '2.0', `${assetPath} must be a valid glTF 2.0 binary`);
  assert.ok(Array.isArray(gltf.meshes) && gltf.meshes.length > 0, `${assetPath} must contain renderable meshes`);
  for (const image of gltf.images || []) {
    if (!image.uri || image.uri.startsWith('data:')) continue;
    await fs.access(new URL(image.uri, url), fs.constants.R_OK);
  }
}

assert.match(kenneyAssets, /Holiday Kit/i);
assert.match(kenneyAssets, /Fantasy Town/i);
assert.match(kenneyAssets, /Nature Kit/i);
assert.match(kenneyAssets, /bounding/i);
assert.match(visualPage, /__mountainVisualMetrics/);
for (const view of ['aerial', 'village', 'summit', 'descent', 'waterfall']) {
  assert.match(visualPage, new RegExp(`${view}:`));
  assert.match(visualSmoke, new RegExp(`['"]${view}['"]`));
}
assert.match(visualSmoke, /maximumRenderedRoadSupportGap/);
assert.match(visualSmoke, /maxGroundingDelta/);
assert.match(visualWorkflow, /playwright@1\.55\.0/);
assert.match(visualWorkflow, /upload-artifact@v4/);
assert.match(visualWorkflow, /mountain-visual-smoke/);

console.log(`TURN MOUNTAIN r3 production contract passed: ${closedLength(MOUNTAIN_CONTROL_POINTS).toFixed(0)} control units, continuous terrain, grounded Kenney village and browser visual QA.`);

function parseGlbJson(buffer, label) {
  assert.ok(Buffer.isBuffer(buffer), `${label} must be read as binary data`);
  assert.ok(buffer.length >= 20, `${label} is too short to be a valid GLB`);
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'glTF', `${label} has an invalid GLB magic header`);
  assert.equal(buffer.readUInt32LE(4), 2, `${label} must use GLB version 2`);
  assert.equal(buffer.readUInt32LE(8), buffer.length, `${label} GLB header length must match committed bytes`);
  const jsonChunkLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a, `${label} must begin with a JSON chunk`);
  const jsonEnd = 20 + jsonChunkLength;
  assert.ok(jsonEnd <= buffer.length, `${label} JSON chunk must fit inside the GLB`);
  return JSON.parse(buffer.subarray(20, jsonEnd).toString('utf8').replace(/\u0000/g, '').trim());
}

function closedLength(points) {
  let length = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    length += Math.hypot(next[0] - current[0], next[2] - current[2]);
  }
  return length;
}

function maximumTurn(points) {
  let maximum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const incoming = [current[0] - previous[0], current[2] - previous[2]];
    const outgoing = [next[0] - current[0], next[2] - current[2]];
    const cosine = (incoming[0] * outgoing[0] + incoming[1] * outgoing[1])
      / Math.max(1e-9, Math.hypot(...incoming) * Math.hypot(...outgoing));
    maximum = Math.max(maximum, Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI);
  }
  return maximum;
}

function findProperIntersections(points) {
  const intersections = [];
  for (let first = 0; first < points.length; first += 1) {
    const a = points[first];
    const b = points[(first + 1) % points.length];
    for (let second = first + 2; second < points.length; second += 1) {
      if ((second + 1) % points.length === first) continue;
      const c = points[second];
      const d = points[(second + 1) % points.length];
      if (orientation(a, b, c) * orientation(a, b, d) < -1e-8
          && orientation(c, d, a) * orientation(c, d, b) < -1e-8) intersections.push([first, second]);
    }
  }
  return intersections;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}
