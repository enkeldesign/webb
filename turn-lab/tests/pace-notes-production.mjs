import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  PACE_NOTE_LENGTH,
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../../turn/tracks/pace-notes.js';
import {
  paceNoteDuration,
  paceNoteLengthTailCount,
  paceNotePhraseGroups,
  progressInRange,
  resetPaceNotePassage,
  updatePaceNoteState
} from '../../turn/audio/pace-notes.js';

const [releaseSource, app, audio, paceAudio, paceMap, soundGuide] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
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

const airportNotes = getTrackPaceNotes('airport');
assert.deepEqual(
  airportNotes.map((note) => note.groups.map((group) => group.length)),
  [
    [PACE_NOTE_LENGTH.MEDIUM],
    [PACE_NOTE_LENGTH.LONG],
    [PACE_NOTE_LENGTH.LONG, PACE_NOTE_LENGTH.MEDIUM],
    [PACE_NOTE_LENGTH.LONG]
  ],
  'AIRPORT must preserve the authored broad sweep and long exits without changing direction or severity'
);
for (const trackId of ['countryside', 'cliffside', 'harbor']) {
  assert.ok(
    getTrackPaceNotes(trackId).every((note) => note.groups.every((group) => group.length === undefined)),
    `${trackId} must keep its currently authored compact phrase unchanged`
  );
}

assert.equal(paceNoteLengthTailCount(PACE_NOTE_LENGTH.MEDIUM), 0, 'The baseline medium phrase must stay clean');
assert.equal(paceNoteLengthTailCount(PACE_NOTE_LENGTH.LONG), 1, 'A long authored corner must add exactly one sparse tail');
const longPhrase = paceNotePhraseGroups(airportNotes[1].groups);
assert.equal(longPhrase.length, 2);
assert.deepEqual(
  longPhrase.map((group) => [group.direction, group.severity, group.lengthMarker === true]),
  [[1, 1, false], [1, 1, true]],
  'The long-corner marker must be a delayed same-pitch echo on the same side'
);
const linkedAirportPhrase = paceNotePhraseGroups(airportNotes[2].groups);
assert.deepEqual(
  linkedAirportPhrase.map((group) => [group.direction, group.severity, group.lengthMarker === true]),
  [[1, 2, false], [1, 1, true], [-1, 3, false]],
  'A long first corner must carry one tail before the linked direction changes'
);
assert.ok(paceNoteDuration(airportNotes[2].groups) < 1, 'The longest authored phrase must remain under one second');
assert.ok(
  paceNoteDuration([{ direction: 1, severity: 2 }, { direction: -1, severity: 3 }]) < 0.8,
  'Existing linked notes must remain as brief as before'
);

assert.equal(progressInRange(0.2, 0.1, 0.3), true);
assert.equal(progressInRange(0.9, 0.95, 0.05), false);
assert.equal(progressInRange(0.98, 0.95, 0.05), true, 'The generic trigger helper must support a zone that wraps over start/finish');
assert.equal(progressInRange(0.02, 0.95, 0.05), true);

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
  mode = 'racing',
  getForward = () => ({ x: 0, z: 1 })
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
    getForward
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

resetPaceNotePassage();
let forwardChecks = 0;
const countedForward = () => {
  forwardChecks += 1;
  return { x: 0, z: 1 };
};
const notes = getTrackPaceNotes('airport');
for (let index = 0; index < notes.length; index += 1) {
  updatePaceNoteState(makeRuntime({
    progress: triggerProgress('airport', index),
    getForward: countedForward
  }), { active: true });
}
const checksAfterFinalNote = forwardChecks;
updatePaceNoteState(makeRuntime({
  progress: triggerProgress('airport', notes.length - 1) + 0.002,
  getForward: countedForward
}), { active: true });
assert.equal(forwardChecks, checksAfterFinalNote, 'Once every note has fired, the lap must skip geometry and heading work');

assert.match(app, /const driveByEarEnabled = installDriveByEarSetting\(\)/);
assert.match(app, /if \(driveByEarEnabled\) \{[\s\S]*installUniversalDrivingSoundscape\(\);[\s\S]*installPaceNotes\(\);/);
assert.match(paceAudio, /PACE_NOTE_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Pace-note position checks must be capped at 30 Hz');
assert.match(paceAudio, /now - lastCheckedAt >= PACE_NOTE_UPDATE_INTERVAL_MS/);
assert.match(paceAudio, /baseAudio\.update\(frame, now\)/, 'Pace notes must remain inside the central audio update path');
assert.match(paceAudio, /groups: paceNotePhraseGroups\(note\.groups\)/, 'Authored corner length must be translated before entering the central audio graph');
assert.match(paceAudio, /lengthMarker: true/);
assert.match(paceAudio, /firedNoteIds\.size >= notes\.length/, 'A completed pace-note lap must take the fast path');
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext|createOscillator|createDynamicsCompressor/, 'Length phrases must not create a second audio engine');
assert.match(audio, /window\.addEventListener\('turn:pace-note', handlePaceNoteAudio\)/);
assert.match(audio, /schedulePaceNoteBeep\(/);
assert.match(audio, /panner\.connect\(routeBus\)/, 'Pace notes and long-corner tails must enter the central route layer');
assert.match(audio, /routeDuckUntil = Math\.max/, 'Pace-note phrases must briefly clear room in the dynamics layer');
assert.doesNotMatch(paceAudio, /requestAnimationFrame|setInterval|setTimeout/, 'Pace notes must not add another timing loop');
assert.match(paceAudio, /state\.offRoad === true/, 'Off-road recovery must suppress pace-note triggers');
assert.match(paceAudio, /mode === 'spectating'/, 'Spectator mode must stay quiet');
for (const trackName of ['COUNTRYSIDE', 'AIRPORT', 'CLIFFSIDE', 'HARBOR']) {
  assert.match(paceMap, new RegExp(`const ${trackName}_PACE_NOTES`), `${trackName} must keep an explicit authored pace-note map`);
}
assert.match(paceMap, /export const PACE_NOTE_LENGTH/);
assert.match(soundGuide, /<h4>PACE NOTES<\/h4>/);
assert.match(soundGuide, /A delayed echo marks a long corner when one is authored/);
assert.match(soundGuide, /<h4>TRAJECTORY SLIDER<\/h4>/);
assert.match(soundGuide, /<h4>SOUND LAYERS<\/h4>/);
assert.match(soundGuide, /Pace notes briefly clear room for route information/);
assert.doesNotMatch(soundGuide, /TURN RIBBON|TURN PULSE|ROAD EDGE|CORNER FLOW|AIRPORT/, 'The pace-note guide must not resurrect retired or track-specific DBE generations');

console.log(`TURN ${release.id} all-track pace notes and layered route audio passed.`);
