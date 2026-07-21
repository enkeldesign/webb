import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { completeLapState } from '../../turn/race/lap-system.js';

function makeFrames(count = 25) {
  return Array.from({ length: count }, (_, index) => ({
    t: index * 0.05,
    x: index,
    z: index * 2,
    h: 0,
    s: 0,
    d: 0,
    p: index / Math.max(1, count - 1)
  }));
}

function makeState({ recording = makeFrames(), lapElapsed = 13.5 } = {}) {
  return {
    competitorLaps: [10, 11, 12, 13].map((time) => ({ time, frames: makeFrames() })),
    recording,
    lapStartedAt: 0,
    lapCheckpointIndex: 12,
    lapActive: true,
    lap: 1,
    lapElapsed,
    bestTime: 10,
    ghostFrames: [],
    ghostVisible: true,
    vehicleId: 'sedan',
    vehicleColor: '#ffd43b',
    vehicleSecondaryColor: '#f8f9fa'
  };
}

const samples = [{ point: { x: 0, z: 0 }, tangent: { x: 0, z: 1 } }];
const originalCustomEvent = globalThis.CustomEvent;
const originalDispatchEvent = globalThis.dispatchEvent;
const publishedResults = [];

globalThis.CustomEvent = class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};
globalThis.dispatchEvent = (event) => {
  publishedResults.push(event);
  return true;
};

try {
  const state = makeState();
  const result = completeLapState({
    state,
    samples,
    now: 13500,
    competitorLimit: 4,
    saveGhost() {}
  });

  assert.equal(result.completedLap, true);
  assert.equal(result.validLap, true);
  assert.equal(result.finishedTime, 13.5);
  assert.equal(result.position, 5, 'A lap slower than all four rivals must finish fifth');
  assert.equal(result.total, 5, 'The result must include the player plus the four rivals that actually raced');
  assert.deepEqual(state.competitorLaps.map((lap) => lap.time), [10, 11, 12, 13], 'A fifth-place lap need not replace a saved rival');
  assert.equal(publishedResults.at(-1)?.type, 'turn:lap-result');
  assert.deepEqual(publishedResults.at(-1)?.detail, { position: 5, total: 5, time: 13.5 });

  const shortRecordingState = makeState({ recording: makeFrames(5), lapElapsed: 14 });
  const shortRecordingResult = completeLapState({
    state: shortRecordingState,
    samples,
    now: 14000,
    competitorLimit: 4,
    saveGhost() {
      assert.fail('A short replay must not be saved as a rival');
    }
  });

  assert.equal(shortRecordingResult.completedLap, true, 'A completed race lap is still a result even when its replay cannot be saved');
  assert.equal(shortRecordingResult.validLap, false, 'Replay eligibility remains separate from result visibility');
  assert.equal(shortRecordingResult.position, 5);
  assert.equal(shortRecordingResult.total, 5);
  assert.deepEqual(shortRecordingState.competitorLaps.map((lap) => lap.time), [10, 11, 12, 13]);
  assert.deepEqual(publishedResults.at(-1)?.detail, { position: 5, total: 5, time: 14 }, 'Every completed lap must publish the frozen last-lap result');
} finally {
  if (originalCustomEvent === undefined) delete globalThis.CustomEvent;
  else globalThis.CustomEvent = originalCustomEvent;
  if (originalDispatchEvent === undefined) delete globalThis.dispatchEvent;
  else globalThis.dispatchEvent = originalDispatchEvent;
}

const [index, app, lapSystem, toast, css] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/lap-result-toast.css', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.17 · Build 2026\.07\.21-r33/);
assert.match(index, /lap-result-toast\.css\?build=20260721-r33/);
assert.match(app, /installLapResultToast\(\)/, 'The toast must install before the game runtime starts');
assert.match(lapSystem, /turn:lap-result/, 'Completed lap finish must publish one frozen result event');
assert.match(lapSystem, /const completedLap = finishedTime > 5/, 'Result visibility must be separated from replay-save eligibility');
assert.match(lapSystem, /const validLap = completedLap && state\.recording\.length > 20/, 'Ghost saving may still require a usable recording');
assert.match(lapSystem, /if \(completedLap\) \{\s*publishLapResult/s, 'Every completed lap must publish a result, including last place and unsaved replays');
assert.doesNotMatch(lapSystem, /TOP ['"] \+|NEW BEST|showMessage\?\.\(message\)/, 'The retired duplicate lap-ranking message must stay removed');
assert.match(lapSystem, /raceRivals\.filter\(\(lap\) => lap\.time < finishedTime\)\.length/, 'Finish placement must be calculated against the rivals from the completed race');
assert.match(toast, /TOAST_VISIBLE_MS = 4000/, 'The result should remain readable for a few seconds');
assert.match(toast, /LAST LAP/, 'The toast must use the requested result label');
assert.match(toast, /lap-result-position/, 'The toast must show frozen finishing position');
assert.match(toast, /lap-result-time/, 'The toast must show the completed lap time');
assert.match(toast, /aria-live', 'polite'/, 'The result toast should be announced without interrupting gameplay');
assert.match(css, /background: var\(--yellow\)/, 'The toast must share the yellow finish-result colour');
assert.match(css, /left: 50%/, 'The last-lap toast must occupy the former central finish-message position');
assert.match(css, /top: 22%/, 'The last-lap toast must sit where the old TOP X LAP message appeared');
assert.doesNotMatch(css, /left: max\(112px/, 'The retired lower-left toast placement must stay removed');
assert.match(css, /prefers-reduced-motion: reduce/, 'Toast animation must respect reduced-motion preferences');

console.log('TURN unified last-lap result toast production regression passed.');
