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

const expectedMaps = Object.freeze({
  countryside: Object.freeze([
    [[1, 2]],
    [[1, 1]],
    [[1, 2]],
    [[1, 1]]
  ]),
  airport: Object.freeze([
    [[1, 2]],
    [[1, 1]],
    [[1, 2], [-1, 3]],
    [[1, 2]]
  ]),
  cliffside: Object.freeze([
    [[1, 2]],
    [[-1, 1]],
    [[1, 2]],
    [[-1, 1], [1, 2]],
    [[1, 1]]
  ]),
  harbor: Object.freeze([
    [[1, 2]],
    [[1, 3]],
    [[-1, 3]],
    [[1, 3]],
    [[1, 2]]
  ])
});

for (const [trackId, expectedGroups] of Object.entries(expectedMaps)) {
  const notes = getTrackPaceNotes(trackId);
  assert.equal(notes.length, expectedGroups.length, `${trackId} must expose every hand-placed sign from its supplied map`);
  assert.deepEqual(
    notes.map((note) => note.groups.map((group) => [group.direction, group.severity])),
    expectedGroups,
    `${trackId} must preserve the authored direction and severity sequence`
  );

  for (const note of notes) {
    const slowTrigger = speedAdjustedPaceNoteTrigger(note, 8, 88);
    const fastTrigger = speedAdjustedPaceNoteTrigger(note, 62, 88);
    assert.ok(fastTrigger <= slowTrigger, 'Higher speed must move a pace note toward the earlier edge of its authored zone');
    assert.ok(fastTrigger >= note.triggerStart && slowTrigger <= note.triggerEnd);
  }
}
assert.equal(getTrackPaceNotes('unknown').length, 0, 'Tracks without authored data must remain quiet');

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

function triggerProgress(trackId, noteIndex, speed = 35) {
  const note = getTrackPaceNotes(trackId)[noteIndex];
  return speedAdjustedPaceNoteTrigger(note, speed, 88) + 0.001;
}

for (const trackId of Object.keys(expectedMaps)) {
  resetPaceNotePassage();
  const progress = triggerProgress(trackId, 0);
  const firstPass = updatePaceNoteState(makeRuntime({ trackId, progress }), { active: true });
  assert.equal(firstPass?.id, `${trackId}-1`, `${trackId} must play its first authored sign`);
  assert.equal(
    updatePaceNoteState(makeRuntime({ trackId, progress: progress + 0.002 }), { active: true }),
    null,
    'A sign must play only once per lap passage'
  );

  const nextLapPass = updatePaceNoteState(makeRuntime({ trackId, progress, lap: 2 }), { active: true });
  assert.equal(nextLapPass?.id, `${trackId}-1`, 'A new lap must re-arm every track map');
}

resetPaceNotePassage();
const airportProgress = triggerProgress('airport', 1);
assert.equal(updatePaceNoteState(makeRuntime({ progress: airportProgress, offRoad: true }), { active: true }), null, 'Recovery must take priority over pace notes');
assert.equal(updatePaceNoteState(makeRuntime({ progress: airportProgress, mode: 'spectating' }), { active: true }), null, 'Spectating must not trigger player navigation notes');

assert.match(app, /installUniversalDrivingSoundscape\(\);[\s\S]*installPaceNotes\(\);/, 'Pace notes must wrap the completed universal soundscape before gameplay loads');
assert.match(paceAudio, /baseAudio\.update\(frame, now\)/, 'Pace notes must reuse the central audio update cadence rather than add a render loop');
assert.doesNotMatch(paceAudio, /requestAnimationFrame|setInterval/, 'Pace notes must not add another continuous loop');
assert.match(paceAudio, /state\.offRoad === true/, 'Off-road recovery must suppress pace-note triggers');
assert.match(paceAudio, /mode === 'spectating'/, 'Spectator mode must stay quiet');
assert.match(paceAudio, /createStereoPanner/, 'Directional note groups must use stereo placement');
for (const trackName of ['COUNTRYSIDE', 'AIRPORT', 'CLIFFSIDE', 'HARBOR']) {
  assert.match(paceMap, new RegExp(`const ${trackName}_PACE_NOTES`), `${trackName} must keep an explicit authored pace-note map`);
}
assert.match(soundGuide, /<h4>PACE NOTES<\/h4>/);
assert.match(soundGuide, /Before major corners, one to three dry beeps/);

console.log(`TURN ${release.id} all-track auditory pace notes passed.`);
