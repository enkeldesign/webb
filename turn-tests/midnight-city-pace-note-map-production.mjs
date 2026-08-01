import assert from 'node:assert/strict';

import { createTrackRuntime } from '../turn/tracks/catalog.js';
import {
  PACE_NOTE_DIRECTION,
  getTrackPaceNotes
} from '../turn/tracks/pace-notes.js';

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

const runtime = createTrackRuntime('midnight-city', 1080);
for (const note of notes) {
  const routeDirection = directionFromGeometry(runtime, note.triggerEnd);
  assert.notEqual(routeDirection, 0, `${note.id} must sit before a geometrically identifiable bend`);
  for (const group of note.groups) {
    assert.equal(
      group.direction,
      routeDirection,
      `${note.id} must point toward the same side as the current Midnight City geometry`
    );
  }
}

console.log('TURN Midnight City pace notes match the rebuilt route geometry.');

function directionFromGeometry(runtime, progress) {
  const lookAround = 0.018;
  const before = runtime.curve.getTangentAt(wrap(progress - lookAround));
  const after = runtime.curve.getTangentAt(wrap(progress + lookAround));
  const signedTurn = before.x * after.z - before.z * after.x;
  if (Math.abs(signedTurn) < 0.02) return 0;
  return signedTurn > 0 ? PACE_NOTE_DIRECTION.RIGHT : PACE_NOTE_DIRECTION.LEFT;
}

function wrap(value) {
  return ((value % 1) + 1) % 1;
}
