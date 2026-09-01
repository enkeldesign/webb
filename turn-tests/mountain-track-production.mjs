import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  TRACK_DEFINITIONS,
  TRACK_PLACEHOLDERS
} from '../turn/tracks/definitions.js';
import { TRACK_DEFINITIONS as BASE_TRACK_DEFINITIONS } from '../turn/tracks/definitions-base.js';
import {
  MOUNTAIN_BRIDGE_CENTERS,
  MOUNTAIN_CONTROL_POINTS,
  MOUNTAIN_LAYOUT_RULES,
  MOUNTAIN_TUNNEL_SPECS
} from '../turn/tracks/mountain-layout.js';
import {
  getTrackPaceNotes,
  PACE_NOTE_DIRECTION
} from '../turn/tracks/pace-notes.js';
import { getTrackPaceNotes as getBaseTrackPaceNotes } from '../turn/tracks/pace-notes-base.js';
import { MOUNTAIN_LONG_CHECKPOINTS } from '../turn/race/lap-system-r86.js';
import { TROPHY_ROAD_REWARDS, rewardForTrack } from '../turn/progression/trophy-road.js';
import { TRACK_COLOR_CUES } from '../turn/accessibility/color-cues.js';
import { TRACK_COLOR_RULES } from '../turn/achievements/chromatic-camouflage-r183.js';

const [
  definitions,
  definitionsBase,
  paceNotes,
  paceNotesBase,
  registry,
  baseWorld,
  longWorld,
  extension,
  collision,
  collisionBase,
  bridgeGuide,
  terrain,
  scenery,
  night,
  trophyGate
] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/definitions.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/definitions-base.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/pace-notes-base.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-long.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-long-extension-r1.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/world-collision.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/world-collision-base.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/race/mountain-bridge-guide.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3-terrain.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r3-scenery.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/mountain-world-r6-night.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/progression/m8-trophy-gate.js', import.meta.url), 'utf8')
]);

const mountain = TRACK_DEFINITIONS.find((track) => track.id === 'mountain');
assert.ok(mountain, 'MOUNTAIN must remain a production track');
assert.equal(mountain.name, 'Mountain');
assert.equal(mountain.eyebrow, 'TRACK 6');
assert.equal(mountain.difficulty, 'EXPERT');
assert.equal(mountain.storageRevision, 'mountain-r3-start-seam');
assert.equal(mountain.sampleCount, 2160);
assert.equal(mountain.freeRoamDistance, 18.2);
assert.equal(mountain.collisionProfile.shoulderStartDistance, 15.0);
assert.equal(mountain.collisionProfile.shoulderDrag, 1.78);
assert.equal(mountain.collisionProfile.colliders.length, 0,
  'The promoted bridge must not reintroduce padded box colliders');
assert.ok(Object.isFrozen(mountain.collisionProfile.bridgeGuide));
assert.equal(mountain.collisionProfile.bridgeGuide.offRoadDrag, 0.34);
assert.deepEqual(
  mountain.collisionProfile.bridgeGuide.positiveNormalRange,
  { startIndex: 1005, endIndex: 1095, featherSamples: 4 },
  'Smoothed route must keep the positive-side bridge guide aligned to the same visible rails'
);
assert.deepEqual(
  mountain.collisionProfile.bridgeGuide.negativeNormalRange,
  { startIndex: 994, endIndex: 1095, featherSamples: 4 },
  'Smoothed route must keep the negative-side bridge guide aligned to the same visible rails'
);
assert.deepEqual(TRACK_PLACEHOLDERS, []);

for (const baseTrack of BASE_TRACK_DEFINITIONS) {
  if (baseTrack.id === 'mountain') continue;
  const promotedTrack = TRACK_DEFINITIONS.find((track) => track.id === baseTrack.id);
  assert.strictEqual(promotedTrack, baseTrack,
    `${baseTrack.id} must remain the exact previous production definition object`);
}

for (const trackId of ['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city']) {
  assert.strictEqual(getTrackPaceNotes(trackId), getBaseTrackPaceNotes(trackId),
    `${trackId} pace notes must delegate to the exact previous production map`);
}

assert.equal(MOUNTAIN_CONTROL_POINTS.length, 72);
assert.equal(MOUNTAIN_LAYOUT_RULES.minimumElevation, 0);
assert.equal(MOUNTAIN_LAYOUT_RULES.maximumElevation, 49);
assert.equal(MOUNTAIN_LAYOUT_RULES.snowLineElevation, 37);
assert.equal(MOUNTAIN_LAYOUT_RULES.noDropCourse, true);
assert.equal(MOUNTAIN_LAYOUT_RULES.targetLength, 'long-course-about-2.1-times-production-mountain');
assert.ok(closedLength(MOUNTAIN_CONTROL_POINTS) > 3000,
  'Promoted MOUNTAIN must retain the substantially longer route');
assert.equal(findProperIntersections(MOUNTAIN_CONTROL_POINTS).length, 0);
assert.ok(maximumTurn(MOUNTAIN_CONTROL_POINTS) < 100);

const startSeam = [
  ...MOUNTAIN_CONTROL_POINTS.slice(-3),
  ...MOUNTAIN_CONTROL_POINTS.slice(0, 2)
];
assert.ok(maximumOpenTurn(startSeam) < 16,
  `MOUNTAIN start/finish must not reintroduce a steering S-kink: ${maximumOpenTurn(startSeam).toFixed(2)}°`);
const startLanding = [
  ...MOUNTAIN_CONTROL_POINTS.slice(-4),
  ...MOUNTAIN_CONTROL_POINTS.slice(0, 2)
];
assert.ok(maximumGrade(startLanding) < 0.05,
  `MOUNTAIN final landing must stay below a 5% control-point grade: ${(maximumGrade(startLanding) * 100).toFixed(2)}%`);

assert.equal(MOUNTAIN_BRIDGE_CENTERS.length, 6);
assert.equal(MOUNTAIN_TUNNEL_SPECS.length, 1);

const notes = getTrackPaceNotes('mountain');
assert.equal(notes.length, 10);
assert.equal(notes[0].groups[0].direction, PACE_NOTE_DIRECTION.LEFT);
assert.deepEqual(
  notes.slice(2, 6).map((note) => note.groups[0].direction),
  [1, -1, 1, -1],
  'Promoted MOUNTAIN slalom calls must preserve the tested driver-perspective sequence'
);
assert.equal(MOUNTAIN_LONG_CHECKPOINTS.length, 24);
assert.ok(MOUNTAIN_LONG_CHECKPOINTS.every((value, index, values) => (
  value > 0 && value < 1 && (index === 0 || value > values[index - 1])
)), 'Long MOUNTAIN checkpoints must be ordered around the full lap');

assert.match(definitions, /definitions-base\.js/);
assert.match(definitions, /storageRevision: 'mountain-r3-start-seam'/);
assert.match(definitions, /sampleCount: 2160/);
assert.match(definitionsBase, /storageRevision: 'mountain-r1'/,
  'The retired short-course definition remains intact only as the rollback/base contract');
assert.match(paceNotes, /pace-notes-base\.js/);
assert.match(paceNotesBase, /const MOUNTAIN_PACE_NOTES/,
  'The retired short-course pace map remains available only as the retained base');
assert.match(registry, /mountain-world-long\.js\?revision=mountain-long-r1/);
assert.match(longWorld, /installBaseMountainWorld/);
assert.match(longWorld, /installMountainLongExtension/);
assert.match(longWorld, /BASE_WORLD_SAMPLE_COUNT = 1080/);
assert.match(extension, /REVISION = 'mountain-long-course-r14-slip-bridge-grey-portals'/);
assert.match(extension, /PORTAL_ROCK_GREY = 0x7d878d/);
assert.match(extension, /dynamicPointLightsAdded: 0/);
assert.match(extension, /addedShadowCasters: 0/);
assert.doesNotMatch(extension, /setAnimationLoop|requestAnimationFrame|setInterval/);

assert.match(collision, /if \(trackId !== 'mountain'\) return resolveBaseWorldCollisionState\(options\)/,
  'Every non-MOUNTAIN collision call must take the exact retained production path');
assert.match(collision, /world-collision-base\.js/);
assert.match(collisionBase, /resolveTrackEnvelopeBoundary/);
assert.match(bridgeGuide, /Number\(nearestTrack\.index\)/);
assert.match(bridgeGuide, /const signedDistance = dx \* normalX \+ dz \* normalZ/);
assert.match(bridgeGuide, /state\.position\.x -= outwardX \* excess/);
assert.doesNotMatch(bridgeGuide, /for\s*\(|while\s*\(/,
  'The per-frame bridge guide must remain O(1)');

// The mature original MOUNTAIN world remains the foundation underneath the extension.
assert.match(baseWorld, /version: 'r3'/);
assert.match(baseWorld, /continuous-snow-and-granite-terrain-body/);
assert.match(baseWorld, /installMountainR6Night/);
assert.match(baseWorld, /world\.ready = Promise\.resolve/);
assert.match(baseWorld, /FINAL_VILLAGE_OPTIONS = Object\.freeze\(\{ skipRetiredHolidayCabins: true \}\)/,
  'The finished production village must skip both cabin layers that r5 replaces');
assert.match(baseWorld, /installMountainScenery\([\s\S]*FINAL_VILLAGE_OPTIONS/);
assert.match(baseWorld, /installMountainR4VisualPolish\([\s\S]*FINAL_VILLAGE_OPTIONS/);
assert.doesNotMatch(baseWorld, /setAnimationLoop|requestAnimationFrame|setInterval/);
assert.match(terrain, /Mountain continuous terrain body r3/);
assert.match(terrain, /Mountain opaque roadbed side wall r3/);
assert.match(terrain, /Mountain closed roadbed underside r3/);
assert.match(scenery, /Mountain Kenney Holiday cabin prefab r3/);
assert.match(scenery, /skipRetiredHolidayCabins[\s\S]*Promise\.resolve\(null\)/,
  'Production must avoid downloading the retired r3 cabin GLBs, not merely hide them later');
assert.match(scenery, /Mountain terrain-bounded waterfall lake r3/);
assert.match(night, /mountain-night-sky\.jpg/);
assert.match(night, /mountain-moon\.png/);

const reward = rewardForTrack('mountain');
assert.equal(reward?.id, 'mountain');
assert.equal(reward?.threshold, 700);
assert.equal(TROPHY_ROAD_REWARDS.at(-1)?.id, 'rally-racer');
assert.match(trophyGate, /rewardForTrack\(trackId\)/);
assert.doesNotMatch(trophyGate, /trackId === ['"]mountain['"]/);
assert.equal(TRACK_COLOR_CUES.mountain, 'blue');
assert.deepEqual(TRACK_COLOR_RULES.mountain, { hueMin: 206, hueMax: 230, name: 'blue' });

console.log(`TURN long MOUNTAIN production contract passed: ${closedLength(MOUNTAIN_CONTROL_POINTS).toFixed(0)} control units, 2160 samples, 24 checkpoints, fresh rival namespace.`);

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
    maximum = Math.max(maximum, turnDegrees(previous, current, next));
  }
  return maximum;
}

function maximumOpenTurn(points) {
  let maximum = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    maximum = Math.max(maximum, turnDegrees(points[index - 1], points[index], points[index + 1]));
  }
  return maximum;
}

function turnDegrees(previous, current, next) {
  const incoming = [current[0] - previous[0], current[2] - previous[2]];
  const outgoing = [next[0] - current[0], next[2] - current[2]];
  const denominator = Math.max(1e-9, Math.hypot(...incoming) * Math.hypot(...outgoing));
  const cosine = (incoming[0] * outgoing[0] + incoming[1] * outgoing[1]) / denominator;
  return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
}

function maximumGrade(points) {
  let maximum = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const horizontal = Math.max(1e-9, Math.hypot(current[0] - previous[0], current[2] - previous[2]));
    maximum = Math.max(maximum, Math.abs(current[1] - previous[1]) / horizontal);
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
      if (segmentsProperlyIntersect(a, b, c, d)) intersections.push([first, second]);
    }
  }
  return intersections;
}

function segmentsProperlyIntersect(a, b, c, d) {
  return orientation(a, b, c) * orientation(a, b, d) < -1e-8
    && orientation(c, d, a) * orientation(c, d, b) < -1e-8;
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
}
