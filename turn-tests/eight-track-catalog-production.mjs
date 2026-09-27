import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';

import { TRACK_DEFINITIONS, TRACK_IDS } from '../turn/tracks/definitions.js';
import { createTrackRuntime } from '../turn/tracks/catalog.js';
import { TRACK_RUNTIME_REGISTRY } from '../turn/tracks/registry.js';
import { getTrackPaceNotes, PACE_NOTE_DIRECTION, PACE_NOTE_LENGTH } from '../turn/tracks/pace-notes.js';
import {
  BEACHFRONT_CHECKPOINTS,
  DEAD_CANYON_CHECKPOINTS,
  LAP_CHECKPOINTS,
  LAP_VOID_DISABLED_TRACKS,
  MOUNTAIN_LONG_CHECKPOINTS,
  updateLapProgressState
} from '../turn/race/lap-system-r86.js';
import { TRACK_SHADOW_ROAD_HEIGHT } from '../turn/render/car-shadows.js';
import { TRACK_ICON_ASSETS } from '../turn/ui/track-icons.js';
import { TRACK_COLOR_CUES } from '../turn/accessibility/color-cues.js';
import { TRACK_COLOR_RULES, matchesTrackColor } from '../turn/achievements/chromatic-camouflage-r183.js';
import { TRACK_SONGS } from '../turn/audio/music/songbook.js';

// #983: BEACHFRONT and DEAD CANYON are first-class production tracks, and the
// catalog is ordered by difficulty with two tracks per tier.
const EXPECTED = [
  ['countryside', 'EASY'],
  ['cliffside', 'EASY'],
  ['airport', 'MEDIUM'],
  ['beachfront', 'MEDIUM'],
  ['harbor', 'ADVANCED'],
  ['dead-canyon', 'ADVANCED'],
  ['midnight-city', 'EXPERT'],
  ['mountain', 'EXPERT']
];
assert.deepEqual(TRACK_DEFINITIONS.map((track) => [track.id, track.difficulty]), EXPECTED);
assert.deepEqual(TRACK_IDS, EXPECTED.map(([id]) => id));
assert.deepEqual(TRACK_DEFINITIONS.map((track) => track.eyebrow), EXPECTED.map((_, index) => `TRACK ${index + 1}`));
assert.equal(TRACK_RUNTIME_REGISTRY.length, 8);

const storageRevisions = TRACK_DEFINITIONS.map((track) => track.storageRevision);
assert.equal(new Set(storageRevisions).size, storageRevisions.length, 'Every track keeps its own records and rivals');

const beachfront = TRACK_DEFINITIONS.find((track) => track.id === 'beachfront');
const deadCanyon = TRACK_DEFINITIONS.find((track) => track.id === 'dead-canyon');
assert.equal(beachfront.name, 'Beachfront');
assert.equal(beachfront.accent, '#25b97a', 'BEACHFRONT keeps its green identity');
assert.equal(beachfront.storageRevision, 'beachfront');
assert.equal(beachfront.sampleCount, 1440);
assert.equal(deadCanyon.name, 'Dead Canyon');
assert.equal(deadCanyon.accent, '#e5404f', 'DEAD CANYON keeps its red identity');
assert.equal(deadCanyon.storageRevision, 'dead-canyon');
assert.equal(deadCanyon.sampleCount, 2160);
for (const track of [beachfront, deadCanyon]) {
  assert.ok(!/lab|suburbs/i.test(track.storageRevision), `${track.id} must not share LAB storage`);
  assert.equal(track.collisionProfile.bridgeGuide, undefined, `${track.id} must not inherit MOUNTAIN's bridge guide`);
}

// Geometry: the verified LAB routes, promoted under their own ids.
const lengths = Object.fromEntries(['beachfront', 'dead-canyon'].map((id) => {
  const definition = TRACK_DEFINITIONS.find((track) => track.id === id);
  const runtime = createTrackRuntime(id, definition.sampleCount);
  return [id, runtime.samples.at(-1).distance];
}));
assert.ok(Math.abs(lengths.beachfront - 1900) < 60, `BEACHFRONT ≈1.9 km, got ${lengths.beachfront.toFixed(1)}`);
assert.ok(Math.abs(lengths['dead-canyon'] - 3280) < 90, `DEAD CANYON ≈3.3 km, got ${lengths['dead-canyon'].toFixed(1)}`);

// Every mandatory per-track registry names the new ids explicitly.
for (const [label, map] of Object.entries({
  TRACK_SHADOW_ROAD_HEIGHT,
  TRACK_ICON_ASSETS,
  TRACK_COLOR_CUES,
  TRACK_COLOR_RULES,
  TRACK_SONGS
})) {
  for (const id of TRACK_IDS) assert.ok(Object.hasOwn(map, id), `${label} must cover ${id}`);
}
assert.equal(TRACK_ICON_ASSETS.beachfront, '/turn/assets/trophy-road/beachfront.svg');
assert.equal(TRACK_ICON_ASSETS['dead-canyon'], '/turn/assets/trophy-road/dead-canyon.svg');
for (const id of ['beachfront', 'dead-canyon']) {
  const svg = await fs.readFile(new URL(`../turn/assets/trophy-road/${id}.svg`, import.meta.url), 'utf8');
  assert.match(svg, /viewBox="0 0 1254 1254"/, `${id} pictogram uses the shared track-icon canvas`);
  assert.match(svg, /fill="currentColor" fill-rule="evenodd"/, `${id} pictogram is a single-colour mask source`);
}
assert.equal(TRACK_COLOR_CUES.beachfront, 'green');
assert.equal(TRACK_COLOR_CUES['dead-canyon'], 'red');
assert.equal(new Set(Object.values(TRACK_COLOR_CUES)).size, TRACK_IDS.length, 'Colour cues stay distinguishable');
assert.strictEqual(TRACK_SONGS.beachfront, TRACK_SONGS.cliffside, 'BEACHFRONT plays the CLIFFSIDE music');
assert.strictEqual(TRACK_SONGS['dead-canyon'], TRACK_SONGS.mountain, 'DEAD CANYON plays the MOUNTAIN music');
assert.equal(TRACK_SHADOW_ROAD_HEIGHT.beachfront, 0.16);
assert.equal(TRACK_SHADOW_ROAD_HEIGHT['dead-canyon'], 0.16);

// Chromatic Camouflage: green and red, with red wrapping through 0°.
assert.equal(matchesTrackColor('beachfront', beachfront.accent), true);
assert.equal(matchesTrackColor('dead-canyon', deadCanyon.accent), true);
assert.equal(matchesTrackColor('dead-canyon', '#ff0000'), true);
assert.equal(matchesTrackColor('dead-canyon', '#ff8f3d'), false, 'Harbor orange is not red');
assert.equal(matchesTrackColor('dead-canyon', '#ff4fa3'), false, 'Countryside pink is not red');
assert.equal(matchesTrackColor('beachfront', '#26c7c3'), false, 'Cliffside cyan is not green');
assert.equal(matchesTrackColor('countryside', '#ff00ff'), true, 'Existing rules are unchanged');
for (const color of ['#ff0000', '#25b97a', '#e5404f', '#ff8f3d', '#26c7c3', '#ff4fa3', '#ffd43b', '#9d7cff', '#4dabf7']) {
  const owners = TRACK_IDS.filter((id) => matchesTrackColor(id, color));
  assert.ok(owners.length <= 1, `${color} must not satisfy more than one track colour (${owners.join(', ')})`);
}

// DBE: the corrected LAB maps, now under the production ids.
const { LEFT, RIGHT } = PACE_NOTE_DIRECTION;
const { SHORT, MEDIUM, LONG } = PACE_NOTE_LENGTH;
const directions = (id) => getTrackPaceNotes(id).map((note) => note.groups.map((group) => group.direction));
assert.deepEqual(directions('beachfront'), [
  [RIGHT], [RIGHT], [LEFT], [RIGHT], [LEFT], [RIGHT], [LEFT], [RIGHT], [LEFT], [RIGHT]
]);
assert.deepEqual(directions('dead-canyon'), [
  [RIGHT, LEFT, RIGHT], [RIGHT], [RIGHT], [RIGHT], [LEFT], [RIGHT], [RIGHT], [RIGHT], [LEFT], [RIGHT], [RIGHT], [LEFT]
]);
assert.equal(getTrackPaceNotes('beachfront')[8].groups[0].severity, 4, 'The backyard hairpin stays a 4');
assert.deepEqual(getTrackPaceNotes('dead-canyon')[0].groups.map((group) => group.length), [SHORT, SHORT, SHORT]);
for (const id of ['beachfront', 'dead-canyon']) {
  const notes = getTrackPaceNotes(id);
  assert.ok(notes.every((note) => note.id.startsWith(`${id}-`)), `${id} notes carry their own ids`);
  assert.ok(notes.every((note, index) => note.triggerStart < note.triggerEnd
    && (index === 0 || note.triggerStart > notes[index - 1].triggerEnd)), `${id} notes are ordered around the lap`);
  assert.ok(notes.every((note) => note.groups.every((group) => [SHORT, MEDIUM, LONG].includes(group.length))));
}
assert.notStrictEqual(getTrackPaceNotes('beachfront'), getTrackPaceNotes('cliffside'));
assert.notStrictEqual(getTrackPaceNotes('dead-canyon'), getTrackPaceNotes('mountain'));

// Checkpoints: own sets; CLIFFSIDE's lap-void exception and MOUNTAIN's set stay theirs.
assert.equal(BEACHFRONT_CHECKPOINTS.length, 20);
assert.equal(DEAD_CANYON_CHECKPOINTS.length, 24);
assert.deepEqual(LAP_VOID_DISABLED_TRACKS, ['cliffside']);
assert.notStrictEqual(DEAD_CANYON_CHECKPOINTS, MOUNTAIN_LONG_CHECKPOINTS);

function driveLap(trackId, { skip = null } = {}) {
  const definition = TRACK_DEFINITIONS.find((track) => track.id === trackId);
  const { samples } = createTrackRuntime(trackId, definition.sampleCount);
  const state = {
    trackId,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    lapActive: true,
    lapInvalid: false,
    lapCheckpointIndex: 0,
    lapStartedAt: 0,
    lapPreviousPosition: null
  };
  let completed = 0;
  const step = 2;
  for (let index = 4; index <= samples.length + 4; index += step) {
    if (skip && index / samples.length > skip[0] && index / samples.length < skip[1]) continue;
    const sample = samples[index % samples.length];
    state.lapPreviousPosition = { x: state.position.x, z: state.position.z };
    if (index === 4) state.lapPreviousPosition = null;
    state.position.copy(sample.point);
    state.velocity.copy(sample.tangent).multiplyScalar(30);
    updateLapProgressState({
      state,
      nearestAfter: { sample },
      samples,
      trackWidth: 27,
      now: index,
      beginTimedLap: () => {},
      completeLap: () => { completed += 1; },
      recordGhostFrame: () => {}
    });
  }
  return { state, completed };
}

for (const [trackId, checkpoints] of [['beachfront', BEACHFRONT_CHECKPOINTS], ['dead-canyon', DEAD_CANYON_CHECKPOINTS]]) {
  const full = driveLap(trackId);
  assert.equal(full.state.lapInvalid, false, `${trackId}: a full lap stays valid`);
  assert.equal(full.completed, 1, `${trackId}: a full lap completes at the start gate`);
  const shortcut = driveLap(trackId, { skip: [0.3, 0.6] });
  assert.equal(shortcut.completed, 0, `${trackId}: a shortcut never completes a lap`);
  assert.ok(checkpoints !== LAP_CHECKPOINTS);
}

// World sources: production modules with production assets, no LAB paths.
const [registrySource, beachfrontWorld, deadCanyonWorld] = await Promise.all([
  fs.readFile(new URL('../turn/tracks/registry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/beachfront-world.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/tracks/dead-canyon-world.js', import.meta.url), 'utf8')
]);
assert.match(registrySource, /async beachfront\([\s\S]*?await import\('\.\/beachfront-world\.js'\)/);
assert.match(registrySource, /async 'dead-canyon'\([\s\S]*?await import\('\.\/dead-canyon-world\.js'\)/);
for (const source of [registrySource, beachfrontWorld, deadCanyonWorld]) {
  assert.doesNotMatch(source, /turn-lab/, 'Production tracks never load TURN LAB files');
}
assert.match(deadCanyonWorld, /const RETRO_ROOT = '\/turn\/assets\/scenery\/retro-urban\/'/);
for (const file of ['wall-a-garage.obj', 'wall-broken-type-a.obj', 'scaffolding-structure.obj', 'truck-green-cargo.obj',
  'tree-park-large.obj', 'roof-metal-poles.obj', 'roof-metal-type-a.obj', 'treeA.png', 'LICENSE.txt']) {
  await fs.access(new URL(`../turn/assets/scenery/retro-urban/${file}`, import.meta.url));
}

console.log('TURN eight-track catalog, BEACHFRONT and DEAD CANYON runtime contracts passed.');
