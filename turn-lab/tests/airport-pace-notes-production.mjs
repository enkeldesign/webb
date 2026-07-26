import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../../turn/tracks/pace-notes.js';
import {
  paceNoteDuration,
  progressInRange,
  resetPaceNotePassage,
  updatePaceNoteState
} from '../../turn/audio/pace-notes.js';

const [releaseSource, app, paceAudio, paceMap, soundGuide] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/tracks/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/in-game-menu.js', import.meta.url), 'utf8')
]);
const release = JSON.parse(releaseSource);

const airportNotes = getTrackPaceNotes('airport');
assert.equal(airportNotes.length, 4, 'AIRPORT must begin with the four hand-placed signs from the supplied map');
assert.deepEqual(
  airportNotes.map((note) => note.groups.map((group) => [group.direction, group.severity])),
  [
    [[1, 2]],
    [[1, 1]],
    [[1, 2], [-1, 3]],
    [[1, 2]]
  ],
  'The four AIRPORT signs must encode right two, right one, right two into left three, and right two'
);
assert.equal(getTrackPaceNotes('countryside').length, 0, 'The prototype must remain AIRPORT-only');

for (const note of airportNotes) {
  const slowTrigger = speedAdjustedPaceNoteTrigger(note, 8, 88);
  const fastTrigger = speedAdjustedPaceNoteTrigger(note, 62, 88);
  assert.ok(fastTrigger <= slowTrigger, 'Higher speed must move a pace note toward the earlier edge of its authored zone');
  assert.ok(fastTrigger >= note.triggerStart && slowTrigger <= note.triggerEnd);
}

assert.equal(progressInRange(0.2, 0.1, 0.3), true);
assert.equal(progressInRange(0.9, 0.95, 0.05), false);
assert.equal(progressInRange(0.98, 0.95, 0.05), true, 'The generic trigger helper must support a zone that wraps over start/finish');
assert.equal(progressInRange(0.02, 0.95, 0.05), true);
assert.ok(paceNoteDuration([{ direction: 1, severity: 2 }, { direction: -1, severity: 3 }]) < 0.8, 'Linked notes must remain brief enough for racing');

const samples = Array.from({ length: 720 }, (_, index) => ({
  point: { x: 0, z: index },
  tangent: { x: 0, z: 1 },
  normal: { x: -1, z: 0 }
}));

function makeRuntime({
  trackId = 'airport',
  progress = 0.2,
  speed = 35,
  lap = 1,
  offRoad = false,
  mode = 'racing'
} = {}) {
  return {
    trackId,
    maxSpeed: 88,
    samples,
    state: {
      trackId,
      running: true,
      mode,
      lap,
      progress,
      nearestTrackIndex: Math.round(progress * samples.length) % samples.length,
      speed,
      offRoad,
      velocity: { x: 0, z: speed }
    },
    getForward: () => ({ x: 0, z: 1 })
  };
}

resetPaceNotePassage();
const firstPass = updatePaceNoteState(makeRuntime({ progress: 0.2, speed: 35 }), { active: true });
assert.equal(firstPass?.id, 'airport-2', 'Entering sign 2 at normal speed must play right one');
assert.equal(updatePaceNoteState(makeRuntime({ progress: 0.205, speed: 35 }), { active: true }), null, 'A sign must play only once per lap passage');

const nextLapPass = updatePaceNoteState(makeRuntime({ progress: 0.2, speed: 35, lap: 2 }), { active: true });
assert.equal(nextLapPass?.id, 'airport-2', 'A new lap must re-arm the authored signs');

resetPaceNotePassage();
assert.equal(updatePaceNoteState(makeRuntime({ progress: 0.2, offRoad: true }), { active: true }), null, 'Recovery must take priority over pace notes');
assert.equal(updatePaceNoteState(makeRuntime({ trackId: 'harbor', progress: 0.2 }), { active: true }), null, 'Other tracks must remain unchanged');
assert.equal(updatePaceNoteState(makeRuntime({ progress: 0.2, mode: 'spectating' }), { active: true }), null, 'Spectating must not trigger player navigation notes');

assert.match(app, /installUniversalDrivingSoundscape\(\);[\s\S]*installPaceNotes\(\);/, 'Pace notes must wrap the completed universal soundscape before gameplay loads');
assert.match(paceAudio, /baseAudio\.update\(frame, now\)/, 'Pace notes must reuse the central audio update cadence rather than add a render loop');
assert.doesNotMatch(paceAudio, /requestAnimationFrame|setInterval/, 'The pace-note prototype must not add another continuous loop');
assert.match(paceAudio, /state\.offRoad === true/, 'Off-road recovery must suppress pace-note triggers');
assert.match(paceAudio, /mode === 'spectating'/, 'Spectator mode must stay quiet');
assert.match(paceAudio, /createStereoPanner/, 'Directional note groups must use stereo placement');
assert.match(paceMap, /id: 'airport-3'[\s\S]*RIGHT, severity: 2[\s\S]*LEFT, severity: 3/, 'The linked right-two left-three sign must stay explicit in track design data');
assert.match(soundGuide, /<h4>PACE NOTES<\/h4>/);
assert.match(soundGuide, /one to three dry beeps/);

console.log(`TURN ${release.id} AIRPORT auditory pace-note prototype passed.`);
