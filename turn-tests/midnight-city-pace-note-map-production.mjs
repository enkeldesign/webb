import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { MIDNIGHT_CITY_CONTROL_POINTS } from '../turn/tracks/midnight-city-layout.js';
import {
  PACE_NOTE_DIRECTION,
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../turn/tracks/pace-notes.js';
import {
  resetPaceNotePassage,
  updatePaceNoteState
} from '../turn/audio/pace-notes.js';

const notes = getTrackPaceNotes('midnight-city');
const expectedDirections = [
  PACE_NOTE_DIRECTION.RIGHT,
  PACE_NOTE_DIRECTION.RIGHT,
  PACE_NOTE_DIRECTION.LEFT,
  PACE_NOTE_DIRECTION.LEFT,
  PACE_NOTE_DIRECTION.RIGHT,
  PACE_NOTE_DIRECTION.LEFT,
  PACE_NOTE_DIRECTION.RIGHT,
  PACE_NOTE_DIRECTION.RIGHT,
  PACE_NOTE_DIRECTION.LEFT,
  PACE_NOTE_DIRECTION.RIGHT,
  PACE_NOTE_DIRECTION.LEFT,
  PACE_NOTE_DIRECTION.RIGHT
];

assert.equal(notes.length, expectedDirections.length, 'Midnight City must keep all twelve authored approach notes');
assert.deepEqual(
  notes.map((note) => note.groups[0]?.direction),
  expectedDirections,
  'Midnight City must preserve the rebuilt route’s R R L L R L R R L R L R sequence'
);

const routeTurns = controlPointTurns(MIDNIGHT_CITY_CONTROL_POINTS);
for (const note of notes) {
  const routeDirection = directionNearProgress(routeTurns, note.triggerEnd);
  assert.notEqual(routeDirection, 0, `${note.id} must sit before a geometrically identifiable bend`);
  for (const group of note.groups) {
    assert.equal(
      group.direction,
      routeDirection,
      `${note.id} must point toward the same side as the current Midnight City geometry`
    );
  }
}

const [gameStateSource, physicsSource, paceAudioSource] = await Promise.all([
  fs.readFile(new URL('../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/audio/pace-notes.js', import.meta.url), 'utf8')
]);
assert.match(gameStateSource, /state\.trackSampleCount = samples\.length/);
assert.match(physicsSource, /activeTrackSampleCount = positiveNumber\(state\.trackSampleCount, trackSampleCount\)/);
assert.match(physicsSource, /state\.progress = nearestAfter\.index \/ activeTrackSampleCount/);
assert.match(paceAudioSource, /const progress = normalizeProgress\(index \/ sampleCount\)/);
assert.doesNotMatch(
  paceAudioSource,
  /Number\.isFinite\(Number\(state\.progress\)\) \? Number\(state\.progress\)/,
  'Pace-note timing must not trust a progress value normalized with another track’s sample count'
);

const sampleCount = 1080;
const speed = 35;
const firstTrigger = speedAdjustedPaceNoteTrigger(notes[0], speed, 88) + 0.001;
const nearestTrackIndex = Math.ceil(firstTrigger * sampleCount);
const physicalProgress = nearestTrackIndex / sampleCount;
const staleLegacyProgress = nearestTrackIndex / 720;
const samples = Array.from({ length: sampleCount }, () => ({
  tangent: { x: 0, z: 1 }
}));
const runtime = {
  trackId: 'midnight-city',
  maxSpeed: 88,
  samples,
  state: {
    trackId: 'midnight-city',
    running: true,
    mode: 'racing',
    lap: 1,
    nearestTrackIndex,
    progress: staleLegacyProgress,
    speed,
    velocity: { x: 0, z: speed }
  }
};

assert.ok(staleLegacyProgress > physicalProgress * 1.49, 'The video regression must reproduce the old 1080/720 timing distortion');
resetPaceNotePassage();
assert.equal(
  updatePaceNoteState(runtime, { active: true })?.id,
  'midnight-city-1',
  'The first note must follow physical 1080-sample progress instead of firing a later note roughly one-third of a lap early'
);

console.log('TURN Midnight City pace notes match route geometry and physical 1080-sample timing.');

function controlPointTurns(points) {
  const segmentLengths = points.map((point, index) => distance2d(point, points[(index + 1) % points.length]));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  let travelled = 0;

  return points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const incoming = [point[0] - previous[0], point[2] - previous[2]];
    const outgoing = [next[0] - point[0], next[2] - point[2]];
    const signedAngle = Math.atan2(
      incoming[0] * outgoing[1] - incoming[1] * outgoing[0],
      incoming[0] * outgoing[0] + incoming[1] * outgoing[1]
    );
    const turn = { progress: travelled / totalLength, signedAngle };
    travelled += segmentLengths[index];
    return turn;
  });
}

function directionNearProgress(turns, progress) {
  const radius = 0.035;
  const signedTurn = turns
    .filter((turn) => circularDistance(turn.progress, progress) <= radius)
    .reduce((sum, turn) => sum + turn.signedAngle, 0);
  if (Math.abs(signedTurn) < 0.08) return 0;
  return signedTurn > 0 ? PACE_NOTE_DIRECTION.RIGHT : PACE_NOTE_DIRECTION.LEFT;
}

function circularDistance(a, b) {
  const direct = Math.abs(a - b);
  return Math.min(direct, 1 - direct);
}

function distance2d(a, b) {
  return Math.hypot(b[0] - a[0], b[2] - a[2]);
}
