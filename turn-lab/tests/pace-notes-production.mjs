import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  PACE_NOTE_DIRECTION,
  PACE_NOTE_LENGTH,
  circularProgressSpan,
  classifyCurveMetrics,
  compileTrackPaceNotes
} from '../../turn/tracks/pace-note-compiler.js';
import {
  getTrackPaceNoteRecipes,
  validatePaceNoteRecipes
} from '../../turn/tracks/pace-note-recipes.js';
import {
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../../turn/tracks/pace-notes.js';
import {
  paceNoteDuration,
  paceNotePhraseGroups,
  progressCrossedForward,
  progressInRange
} from '../../turn/audio/pace-notes.js';
import {
  PACE_NOTE_EAR_POLARITY,
  paceNotePan,
  paceNotePlaybackDirection
} from '../../turn/audio/pace-note-spatial.js';

const [
  trackMapSource,
  recipesSource,
  runtimeSource,
  prioritySource,
  fallbackSource,
  trainingSource
] = await Promise.all([
  fs.readFile(new URL('../../turn/tracks/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/pace-note-recipes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-note-priority.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/training/stages.js', import.meta.url), 'utf8')
]);

assert.deepEqual(validatePaceNoteRecipes(), [], 'Every classification override must explain why geometry is intentionally overridden');
assert.deepEqual(
  Object.fromEntries(['countryside', 'airport', 'cliffside', 'harbor', 'midnight-city'].map((trackId) => [
    trackId,
    getTrackPaceNoteRecipes(trackId).length
  ])),
  { countryside: 4, airport: 4, cliffside: 5, harbor: 5, 'midnight-city': 11 },
  'Every production route must expose a stable set of semantic curve recipes'
);
assert.equal(getTrackPaceNotes('unknown', []).length, 0);
assert.doesNotMatch(recipesSource, /\bdirection\s*:/, 'Recipes must select curves, not hand-author left/right output');
assert.match(trackMapSource, /getCompiledTrackPaceNotes\(trackId, samples\)/);
assert.doesNotMatch(trackMapSource, /COUNTRYSIDE_PACE_NOTES|MIDNIGHT_CITY_PACE_NOTES/, 'The old hand-authored maps must not return');

assert.equal(PACE_NOTE_EAR_POLARITY, -1);
assert.equal(paceNotePlaybackDirection(PACE_NOTE_DIRECTION.LEFT), 1);
assert.equal(paceNotePlaybackDirection(PACE_NOTE_DIRECTION.RIGHT), -1);
assert.equal(paceNotePan(PACE_NOTE_DIRECTION.LEFT), 0.96);
assert.equal(paceNotePan(PACE_NOTE_DIRECTION.RIGHT), -0.96);
assert.match(prioritySource, /import \{ paceNotePan \} from '\.\/pace-note-spatial\.js'/);
assert.match(prioritySource, /const pan = paceNotePan\(direction\)/);
assert.doesNotMatch(prioritySource, /direction < 0 \? -0\.96 : 0\.96/);
assert.match(runtimeSource, /paceNotePlaybackDirection\(group\.direction\)/, 'The non-priority fallback must use the same calibrated polarity');
assert.match(fallbackSource, /const pan = direction < 0 \? -0\.96 : 0\.96/, 'The legacy Web Audio fallback still consumes already-calibrated event direction');
assert.match(trainingSource, /const LEFT = -1;[\s\S]*const RIGHT = 1;/, 'Drive By Ear 101 must store semantic road direction too');

const gentleRight = compileSynthetic({ direction: 1, radius: 120, angle: Math.PI / 3 });
const mediumLeft = compileSynthetic({ direction: -1, radius: 50, angle: Math.PI / 2 });
const tightRight = compileSynthetic({ direction: 1, radius: 20, angle: Math.PI / 2 });
const longLeft = compileSynthetic({ direction: -1, radius: 60, angle: Math.PI });

assert.equal(gentleRight.groups[0].direction, PACE_NOTE_DIRECTION.RIGHT);
assert.equal(gentleRight.groups[0].severity, 1);
assert.equal(mediumLeft.groups[0].direction, PACE_NOTE_DIRECTION.LEFT);
assert.equal(mediumLeft.groups[0].severity, 2);
assert.equal(tightRight.groups[0].direction, PACE_NOTE_DIRECTION.RIGHT);
assert.equal(tightRight.groups[0].severity, 3);
assert.equal(longLeft.groups[0].direction, PACE_NOTE_DIRECTION.LEFT);
assert.equal(longLeft.groups[0].length, PACE_NOTE_LENGTH.LONG);

assert.deepEqual(classifyCurveMetrics({ radiusMetres: 130, turnAngleRadians: 0.7, lengthMetres: 35 }), {
  severity: 1,
  length: PACE_NOTE_LENGTH.SHORT
});
assert.deepEqual(classifyCurveMetrics({ radiusMetres: 50, turnAngleRadians: 1.3, lengthMetres: 75 }), {
  severity: 2,
  length: PACE_NOTE_LENGTH.MEDIUM
});
assert.deepEqual(classifyCurveMetrics({ radiusMetres: 20, turnAngleRadians: 2.7, lengthMetres: 145 }), {
  severity: 3,
  length: PACE_NOTE_LENGTH.LONG
});

for (const note of [gentleRight, mediumLeft, tightRight, longLeft]) {
  assert.ok(note.triggerStart >= 0 && note.triggerStart < 1);
  assert.ok(note.triggerEnd >= 0 && note.triggerEnd < 1);
  assert.ok(circularProgressSpan(note.triggerStart, note.triggerEnd) > 0, 'A generated trigger window must advance forward around the route');
}

const wrapped = Object.freeze({ triggerStart: 0.95, triggerEnd: 0.05 });
const highSpeedTrigger = speedAdjustedPaceNoteTrigger(wrapped, 88, 88);
const lowSpeedTrigger = speedAdjustedPaceNoteTrigger(wrapped, 0, 88);
assert.ok(progressInRange(highSpeedTrigger, 0.94, 0.99), 'Fast drivers receive a wrapped cue near the early edge');
assert.ok(progressInRange(lowSpeedTrigger, 0.99, 0.06), 'Slow drivers receive the same wrapped cue closer to the curve');
assert.equal(progressCrossedForward(0.98, 0.02, 0.005), true);
assert.equal(progressCrossedForward(0.02, 0.98, 0.5), false);

const shortPhrase = paceNotePhraseGroups([{ direction: 1, severity: 2, length: 'short' }]);
const longPhrase = paceNotePhraseGroups([{ direction: -1, severity: 2, length: 'long' }]);
assert.equal(shortPhrase[0].finalBeepDurationSeconds, 0.055);
assert.equal(longPhrase[0].finalBeepDurationSeconds, 0.17);
assert.ok(paceNoteDuration(longPhrase) > paceNoteDuration(shortPhrase));
assert.ok(paceNoteDuration([
  { direction: 1, severity: 3, length: 'long' },
  { direction: -1, severity: 3, length: 'long' }
]) < 1.2, 'Even the longest linked phrase must complete before the next driving decision');

assert.match(runtimeSource, /getTrackPaceNotes\(trackId, samples\)/);
assert.match(runtimeSource, /authoredGroups: note\.groups/);
assert.match(runtimeSource, /progressCrossedForward/);
assert.match(runtimeSource, /turn:pace-note-priority/);
assert.match(runtimeSource, /turn:pace-note-silence/);

console.log('TURN semantic pace-note generation, polarity, classification and wrapped triggering passed.');

function compileSynthetic({ direction, radius, angle }) {
  const { samples, anchorProgress } = syntheticCurve({ direction, radius, angle });
  const notes = compileTrackPaceNotes(
    'synthetic',
    samples,
    [{ id: 'synthetic-1', groups: [{ progress: anchorProgress }] }],
    { closed: false }
  );
  assert.equal(notes.length, 1);
  return notes[0];
}

function syntheticCurve({ direction, radius, angle, straightBefore = 130, straightAfter = 130, step = 2 }) {
  const samples = [];
  const push = (x, z, tangentX, tangentZ) => {
    const length = Math.hypot(tangentX, tangentZ) || 1;
    samples.push({
      point: { x, z },
      tangent: { x: tangentX / length, z: tangentZ / length }
    });
  };

  for (let distance = 0; distance < straightBefore; distance += step) push(0, distance, 0, 1);
  const arcSteps = Math.max(12, Math.ceil(radius * angle / step));
  let anchorIndex = samples.length;
  for (let index = 0; index <= arcSteps; index += 1) {
    const theta = angle * index / arcSteps;
    push(
      direction * radius * (1 - Math.cos(theta)),
      straightBefore + radius * Math.sin(theta),
      direction * Math.sin(theta),
      Math.cos(theta)
    );
    if (index === Math.round(arcSteps / 2)) anchorIndex = samples.length - 1;
  }

  const endTheta = angle;
  const endX = direction * radius * (1 - Math.cos(endTheta));
  const endZ = straightBefore + radius * Math.sin(endTheta);
  const tangentX = direction * Math.sin(endTheta);
  const tangentZ = Math.cos(endTheta);
  for (let distance = step; distance <= straightAfter; distance += step) {
    push(endX + tangentX * distance, endZ + tangentZ * distance, tangentX, tangentZ);
  }

  return {
    samples,
    anchorProgress: anchorIndex / Math.max(1, samples.length - 1)
  };
}
