import assert from 'node:assert/strict';

import { MIDNIGHT_CITY_CONTROL_POINTS } from '../turn/tracks/midnight-city-layout.js';
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

console.log('TURN Midnight City pace notes match the rebuilt route geometry.');

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
