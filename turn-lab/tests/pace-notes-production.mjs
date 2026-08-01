import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  PACE_NOTE_LENGTH,
  getTrackPaceNotes,
  speedAdjustedPaceNoteTrigger
} from '../../turn/tracks/pace-notes.js';
import {
  paceNoteDuration,
  paceNotePhraseGroups,
  progressCrossedForward,
  progressInRange,
  resetPaceNotePassage,
  updatePaceNoteState
} from '../../turn/audio/pace-notes.js';

const [releaseSource, app, audio, paceAudio, priorityAudio, paceMap, audioPanel] = await Promise.all([
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/audio-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-notes.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/audio/pace-note-priority.js', import.meta.url), 'utf8'),
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

const regularTightPhrase = paceNotePhraseGroups([{ direction: 1, severity: 3 }]);
const longTightPhrase = paceNotePhraseGroups([{ direction: 1, severity: 3, length: PACE_NOTE_LENGTH.LONG }]);
assert.equal(regularTightPhrase.length, 1, 'A regular tight curve must remain one three-beep group');
assert.equal(longTightPhrase.length, 1, 'A long tight curve must not gain a fourth beep');
assert.equal(regularTightPhrase[0].finalBeepDurationSeconds, 0.055);
assert.equal(longTightPhrase[0].finalBeepDurationSeconds, 0.17, 'A long curve must hold its existing final beep');
assert.equal('lengthMarker' in longTightPhrase[0], false, 'The retired extra-tail marker must not return');
assert.ok(
  paceNoteDuration(longTightPhrase) > paceNoteDuration(regularTightPhrase),
  'bip-bip-beep must last longer than bip-bip-bip without changing beep count'
);

const longMediumPhrase = paceNotePhraseGroups([{
  direction: -1,
  severity: 2,
  length: PACE_NOTE_LENGTH.LONG
}]);
assert.deepEqual(
  longMediumPhrase.map((group) => [group.direction, group.severity, group.finalBeepDurationSeconds]),
  [[-1, 2, 0.17]],
  'A long medium curve must encode bip-beep as one two-beep group'
);

const linkedAirportPhrase = paceNotePhraseGroups(airportNotes[2].groups);
assert.deepEqual(
  linkedAirportPhrase.map((group) => [
    group.direction,
    group.severity,
    group.finalBeepDurationSeconds
  ]),
  [[1, 2, 0.17], [-1, 3, 0.055]],
  'A linked phrase must hold only the final beep of the authored long first corner before direction changes'
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
assert.equal(progressCrossedForward(0.12, 0.24, 0.18), true, 'A forward frame hitch must still cross a skipped trigger');
assert.equal(progressCrossedForward(0.24, 0.12, 0.18), false, 'Reverse travel must not masquerade as a forward trigger crossing');
assert.equal(progressCrossedForward(0.96, 0.04, 0.99), true, 'Forward crossing must work over the lap boundary');
assert.equal(progressCrossedForward(0.1, 0.7, 0.2), false, 'A teleport-sized progress jump must not emit a chain of stale notes');

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
assert.equal(
  updatePaceNoteState(makeRuntime({ progress: airportProgress, offRoad: true }), { active: true })?.id,
  'airport-2',
  'Leaving the road must not discard an upcoming-corner note'
);
resetPaceNotePassage();
assert.equal(updatePaceNoteState(makeRuntime({ progress: airportProgress, mode: 'spectating' }), { active: true }), null, 'Spectating must not trigger player navigation notes');

resetPaceNotePassage();
const skippedNote = airportNotes[1];
const skippedTrigger = speedAdjustedPaceNoteTrigger(skippedNote, 35, 88);
assert.equal(
  updatePaceNoteState(makeRuntime({ progress: skippedTrigger - 0.012 }), { active: true }),
  null,
  'The approach sample before a note must remain quiet'
);
assert.equal(
  updatePaceNoteState(makeRuntime({ progress: skippedNote.triggerEnd + 0.012 }), { active: true })?.id,
  skippedNote.id,
  'A frame hitch that lands beyond the authored window must still deliver the crossed note'
);

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
assert.equal(forwardChecks, checksAfterFinalNote, 'Once every note has fired, the lap must skip unnecessary guidance work');

assert.match(app, /const driveByEarEnabled = installDriveByEarSetting\(\)/);
assert.match(app, /preparePaceNotePriorityCapture\(\)/, 'The shared-context priority layer must prepare before graph creation');
assert.ok(app.indexOf('preparePaceNotePriorityCapture()') < app.indexOf('./audio/audio-preferences.js'));
assert.match(app, /installPaceNotePriority\(\);[\s\S]*installPaceNotes\(\);/);
assert.match(app, /if \(driveByEarEnabled\) \{[\s\S]*installUniversalDrivingSoundscape\(\);[\s\S]*installPaceNotes\(\);/);
assert.match(paceAudio, /PACE_NOTE_UPDATE_INTERVAL_MS = 1000 \/ 30/, 'Pace-note position checks must be capped at 30 Hz');
assert.match(paceAudio, /now - lastCheckedAt >= PACE_NOTE_UPDATE_INTERVAL_MS/);
assert.match(paceAudio, /baseAudio\.update\(frame, now\)/, 'Pace-note detection must remain inside the central audio update path');
assert.match(paceAudio, /progressCrossedForward\(previousProgress, progress, trigger\)/, 'Skipped progress windows must still trigger');
assert.match(paceAudio, /groups: paceNotePhraseGroups\(note\.groups\)/, 'Authored corner length must be translated before entering playback');
assert.match(paceAudio, /LONG_NOTE_DURATION_SECONDS = 0\.17/);
assert.match(paceAudio, /finalBeepDurationSeconds:/);
assert.doesNotMatch(paceAudio, /lengthMarker|paceNoteLengthTailCount/, 'Long curves must not synthesize an extra beep group');
assert.match(paceAudio, /firedNoteIds\.size >= notes\.length/, 'A completed pace-note lap must take the fast path');
assert.match(paceAudio, /turn:pace-note-priority/, 'Production must dispatch into the reliable priority queue');
assert.doesNotMatch(paceAudio, /state\.offRoad === true/, 'Off-road recovery must not suppress an upcoming corner');
assert.doesNotMatch(paceAudio, /MIN_FORWARD_ALIGNMENT|headingAlignment/, 'A brief steering or drift angle must not erase a pace note');
assert.doesNotMatch(paceAudio, /AudioContext|webkitAudioContext|createOscillator|createDynamicsCompressor/, 'Detection must not create a second audio engine');
assert.match(priorityAudio, /const pendingPaceNotes = \[\]/, 'Triggered notes must wait in a persistent FIFO until scheduled');
assert.match(priorityAudio, /context\.state !== 'running'/, 'Interrupted Web Audio must retain rather than discard a note');
assert.match(priorityAudio, /requestAudioResume\(now, forceResume\)/, 'The normal update path must retry an interrupted context');
assert.match(priorityAudio, /context\.addEventListener\?\.\('statechange'/, 'Automatic iOS audio recovery must flush retained notes');
assert.match(priorityAudio, /priorityBus\.connect\(masterGain\)/, 'Pace notes must use the shared context while bypassing route and safety muting');
assert.match(priorityAudio, /panner\.connect\(priorityBus\)/);
assert.match(priorityAudio, /PACE_NOTE_LEVEL = 0\.084/, 'The critical route phrase must remain prominent in the app mix');
assert.match(priorityAudio, /PACE_NOTE_LONG_DURATION_SECONDS = 0\.17/);
assert.match(priorityAudio, /index === severity - 1[\s\S]*paceNoteFinalBeepDuration\(group\)/, 'Only the final regular beep may be lengthened');
assert.match(priorityAudio, /schedulePaceNoteBeep\(cursor, pan, severity, duration\)/, 'Playback must hold the final beep rather than schedule a tail');
assert.match(priorityAudio, /const endAt = startAt \+ duration/);
assert.doesNotMatch(priorityAudio, /lengthMarker/, 'Priority playback must not depend on the retired extra-beep marker');
assert.doesNotMatch(priorityAudio, /safetyMode|offRoadLatched/, 'Ribbon, recovery and wrong-way state must never veto a queued pace note');
assert.doesNotMatch(priorityAudio, /new AudioContext|new webkitAudioContext|new Audio\(|fetch\(/, 'Priority playback must reuse TURN’s one AudioContext and generated tones');
assert.doesNotMatch(priorityAudio, /requestAnimationFrame|setInterval|setTimeout/, 'Reliability must use existing updates and state changes rather than another loop');
assert.match(audio, /window\.addEventListener\('turn:pace-note', handlePaceNoteAudio\)/, 'The legacy event remains as a safe fallback if the priority layer cannot install');
assert.doesNotMatch(paceAudio, /requestAnimationFrame|setInterval|setTimeout/, 'Pace-note detection must not add another timing loop');
assert.match(paceAudio, /mode === 'spectating'/, 'Spectator mode must stay quiet');
for (const trackName of ['COUNTRYSIDE', 'AIRPORT', 'CLIFFSIDE', 'HARBOR']) {
  assert.match(paceMap, new RegExp(`const ${trackName}_PACE_NOTES`), `${trackName} must keep an explicit authored pace-note map`);
}
assert.match(paceMap, /export const PACE_NOTE_LENGTH/);
assert.match(audioPanel, /Drive By Ear sound guide/);
assert.match(audioPanel, /Pace notes tell you what comes next/);
assert.match(audioPanel, /A warm organic hum guides your steering/);
assert.match(audioPanel, /Off road, centred gravel marks the surface/);
assert.match(audioPanel, /nearby-rival warnings are directional/);
assert.doesNotMatch(audioPanel, /TURN RIBBON|TURN PULSE|ROAD EDGE|CORNER FLOW|AIRPORT/, 'The audio guide must not resurrect retired or track-specific DBE generations');

console.log(`TURN ${release.id} final-beep long-curve encoding and priority pace notes passed.`);
