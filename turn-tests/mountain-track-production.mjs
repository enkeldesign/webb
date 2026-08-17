import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { TRACK_DEFINITIONS, TRACK_PLACEHOLDERS } from '../turn/tracks/definitions.js';
import { MOUNTAIN_CONTROL_POINTS, MOUNTAIN_LAYOUT_RULES } from '../turn/tracks/mountain-layout.js';
import { getTrackPaceNotes, PACE_NOTE_DIRECTION } from '../turn/tracks/pace-notes.js';
import {
  TROPHY_ROAD_REWARDS,
  rewardForTrack
} from '../turn/progression/trophy-road.js';
import { TRACK_COLOR_CUES } from '../turn/accessibility/color-cues.js';
import { TRACK_COLOR_RULES } from '../turn/achievements/chromatic-camouflage-r183.js';

const [
  world,
  registry,
  trophyGate,
  kenneyAssets
] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/mountain-world.js', import.meta.url), 'utf8'),
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
assert.equal(definition.freeRoamDistance, 22.2,
  'Mountain containment must sit at the exposed guardrails rather than behind them');
assert.deepEqual(TRACK_PLACEHOLDERS, [], 'The former Track 6 TBA card must be gone');

assert.equal(MOUNTAIN_LAYOUT_RULES.minimumElevation, 0);
assert.equal(MOUNTAIN_LAYOUT_RULES.maximumElevation, 49);
assert.equal(MOUNTAIN_LAYOUT_RULES.snowLineElevation, 37);
assert.equal(MOUNTAIN_LAYOUT_RULES.slalomStartControlPoint, 20);
assert.equal(MOUNTAIN_LAYOUT_RULES.waterfallControlPoint, 34);
assert.ok(closedLength(MOUNTAIN_CONTROL_POINTS) > 1500, 'MOUNTAIN must stay a substantial journey');
assert.equal(findProperIntersections(MOUNTAIN_CONTROL_POINTS).length, 0, 'MOUNTAIN must not cross itself');
assert.ok(maximumTurn(MOUNTAIN_CONTROL_POINTS) < 100, 'The hairpin sequence must remain driveable');

const reward = rewardForTrack('mountain');
assert.equal(reward?.id, 'mountain');
assert.equal(reward?.threshold, 1000);
assert.equal(reward?.type, 'track');
assert.equal(TROPHY_ROAD_REWARDS.at(-1)?.id, 'mountain');
assert.match(trophyGate, /rewardForTrack\(trackId\)/,
  'Track gating must remain generic instead of introducing a Mountain-only lock');
assert.doesNotMatch(trophyGate, /trackId === ['"]mountain['"]/,
  'MOUNTAIN must not create a special-case Trophy Road branch');

const notes = getTrackPaceNotes('mountain');
assert.ok(notes.length >= 8, 'MOUNTAIN needs a complete DBE pace-note map');
assert.equal(notes[0].groups[0].direction, PACE_NOTE_DIRECTION.RIGHT,
  'The opening climb should begin with the intended flowing right-hand guidance');
assert.equal(notes[0].groups[0].length, 'long');
const slalomNotes = notes.filter((note) => note.triggerStart >= 0.59 && note.triggerStart < 0.95);
assert.ok(slalomNotes.length >= 4, 'The front-face descent must have dense slalom guidance');
assert.ok(slalomNotes.every((note) => note.groups.some((group) => group.severity === 3)),
  'The slalom should remain the technical half of the lap');
assert.deepEqual(
  slalomNotes.slice(0, 4).map((note) => note.groups[0].direction),
  [-1, 1, -1, 1],
  'The core slalom guidance must alternate left/right'
);

assert.equal(TRACK_COLOR_CUES.mountain, 'blue');
assert.deepEqual(TRACK_COLOR_RULES.mountain, { hueMin: 206, hueMax: 230, name: 'blue' });

assert.match(registry, /installMountainWorld/);
assert.match(registry, /mountain-world\.js\?revision=r1/);
assert.match(world, /makeGroundTexture/);
assert.match(world, /Mountain cozy chalet/);
assert.match(world, /Mountain village inn/);
assert.match(world, /Mountain village chapel/);
assert.match(world, /Mountain summit river/);
assert.match(world, /Mountain waterfall sheet/);
assert.match(world, /Mountain waterfall mist/);
assert.match(world, /Mountain Cliffside-style granite rock fields/);
assert.match(world, /Mountain spruce crowns/);
assert.match(world, /Mountain exposed descent guardrails/);
assert.match(world, /Mountain distant snow cap/);
assert.match(world, /new THREE\.InstancedMesh/,
  'Repeated trees, rocks and barriers must remain batched');
assert.match(world, /noIceGripModifier: true/,
  'Snow must remain a visual biome rather than an unrequested grip gimmick');
assert.match(world, /fantasy-town\/windmill\.glb/);
assert.match(world, /fantasy-town\/fountainCenter\.glb/);
assert.doesNotMatch(world, /setAnimationLoop|requestAnimationFrame|setInterval/,
  'Static alpine scenery must not add an independent runtime loop');
assert.match(kenneyAssets, /Fantasy Town/i);
assert.match(kenneyAssets, /fountainCenter\.glb/,
  'The new Kenney village landmark must be documented with the bundled assets');

console.log(`TURN MOUNTAIN production contract passed: ${closedLength(MOUNTAIN_CONTROL_POINTS).toFixed(0)} control units, ${notes.length} DBE notes, 49 m summit.`);

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
    const incomingLength = Math.hypot(...incoming);
    const outgoingLength = Math.hypot(...outgoing);
    const cosine = (incoming[0] * outgoing[0] + incoming[1] * outgoing[1])
      / Math.max(1e-9, incomingLength * outgoingLength);
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
      const firstSide = orientation(a, b, c) * orientation(a, b, d);
      const secondSide = orientation(c, d, a) * orientation(c, d, b);
      if (firstSide < -1e-8 && secondSide < -1e-8) intersections.push([first, second]);
    }
  }
  return intersections;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}
