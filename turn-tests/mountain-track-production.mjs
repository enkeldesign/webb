import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TRACK_DEFINITIONS, TRACK_PLACEHOLDERS } from '../turn/tracks/definitions.js';
import { MOUNTAIN_CONTROL_POINTS, MOUNTAIN_LAYOUT_RULES } from '../turn/tracks/mountain-layout.js';
import { getTrackPaceNotes, PACE_NOTE_DIRECTION } from '../turn/tracks/pace-notes.js';
import { TROPHY_ROAD_REWARDS, rewardForTrack } from '../turn/progression/trophy-road.js';
import { TRACK_COLOR_CUES } from '../turn/accessibility/color-cues.js';
import { TRACK_COLOR_RULES } from '../turn/achievements/chromatic-camouflage-r183.js';

const [world, terrain, scenery, registry, trophyGate, kenneyAssets] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/mountain-world-r2.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r2-terrain.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r2-scenery.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/assets/KENNEY-ASSETS.md', import.meta.url), 'utf8')
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
  'The first drive proved the initial Mountain map was mirrored; the verified opening call is left');
const slalomNotes = notes.filter((note) => note.triggerStart >= 0.59 && note.triggerStart < 0.95);
assert.deepEqual(
  slalomNotes.slice(0, 4).map((note) => note.groups[0].direction),
  [1, -1, 1, -1],
  'The corrected front-face slalom alternates right/left from the driver perspective'
);

assert.equal(TRACK_COLOR_CUES.mountain, 'blue');
assert.deepEqual(TRACK_COLOR_RULES.mountain, { hueMin: 206, hueMax: 230, name: 'blue' });

assert.match(registry, /mountain-world-r2\.js\?revision=r2/);
assert.match(world, /ground: 'snow-first-with-rock-patches'/);
assert.match(world, /roadEdge: 'white-with-black-outer-contour'/);
assert.match(world, /routeClearanceProtected: true/);
assert.match(world, /assetVillage: 'Kenney-Holiday-and-Fantasy-Town'/);
assert.match(world, /waterfallCliff: 'Kenney-Nature'/);
assert.match(world, /integratedSnowCaps: true/);
assert.doesNotMatch(world, /setAnimationLoop|requestAnimationFrame|setInterval/);

assert.match(terrain, /Mountain continuous snowfield/);
assert.match(terrain, /Mountain exposed rock patch/);
assert.match(terrain, /Mountain integrated snowy peak backdrop/);
assert.match(terrain, /raggedSnowLine/,
  'Snow belongs to the mountain mesh itself, preventing separate cap hats');
assert.match(terrain, /Mountain solid white road edge/);
assert.match(terrain, /Mountain black outer road contour/);
assert.doesNotMatch(terrain, /ALPINE_BLUE|curb/i,
  'Mountain must use normal road edge lines rather than race curbs');
assert.match(terrain, /nearestNonLocalTrackDistanceXZ/);
assert.match(terrain, /safeTracksidePosition/);

assert.match(scenery, /Mountain route-clearance protected spruce crowns/);
assert.match(scenery, /Mountain grounded clearance-safe granite/);
assert.match(scenery, /Mountain irregular overlapping snow drift/);
assert.match(scenery, /Mountain grounded river rock bed/);
assert.match(scenery, /Mountain summit river clear of road/);
assert.match(scenery, /turnRiverMinimumRoadClearance/);
assert.match(scenery, /Mountain waterfall lake r2/);
assert.match(scenery, /Mountain Kenney Nature waterfall top cliff/);
assert.match(scenery, /cliff-waterfall-top-rock\.glb/);
assert.match(scenery, /cliff-waterfall-rock\.glb/);
assert.match(scenery, /cabin-wall\.glb/);
assert.match(scenery, /cabin-roof-snow-dormer\.glb/);
assert.match(scenery, /Mountain Kenney Holiday cabin/);
assert.match(scenery, /fantasy-town\/windmill\.glb/);
assert.match(scenery, /fantasy-town\/fountainCenter\.glb/);
assert.doesNotMatch(scenery, /makeGabledRoofGeometry|Mountain cozy chalet/,
  'The hand-built inside-out-looking chalet roofs must not return');
assert.doesNotMatch(scenery, /setAnimationLoop|requestAnimationFrame|setInterval/);

assert.match(kenneyAssets, /Holiday Kit/i);
assert.match(kenneyAssets, /Nature Kit/i);
assert.match(kenneyAssets, /Fantasy Town/i);

console.log(`TURN MOUNTAIN r2 polish contract passed: ${closedLength(MOUNTAIN_CONTROL_POINTS).toFixed(0)} control units and corrected DBE directions.`);

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
