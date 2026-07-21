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

const samples = [{ point: { x: 0, z: 0 }, tangent: { x: 0, z: 1 } }];
const state = {
  competitorLaps: [10, 11, 12, 13].map((time) => ({ time, frames: makeFrames() })),
  recording: makeFrames(),
  lapStartedAt: 0,
  lapCheckpointIndex: 12,
  lapActive: true,
  lap: 1,
  lapElapsed: 13.5,
  bestTime: 10,
  ghostFrames: [],
  ghostVisible: true,
  vehicleId: 'sedan',
  vehicleColor: '#ffd43b',
  vehicleSecondaryColor: '#f8f9fa'
};

const result = completeLapState({
  state,
  samples,
  now: 13500,
  competitorLimit: 4,
  saveGhost() {},
  showMessage() {}
});

assert.equal(result.validLap, true);
assert.equal(result.finishedTime, 13.5);
assert.equal(result.position, 5, 'A lap slower than all four rivals must finish fifth');
assert.equal(result.total, 5, 'The result must include the player plus the four rivals that actually raced');
assert.deepEqual(state.competitorLaps.map((lap) => lap.time), [10, 11, 12, 13], 'A fifth-place lap need not replace a saved rival');

const [index, app, lapSystem, toast, css] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/lap-result-toast.css', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.16 · Build 2026\.07\.21-r32/);
assert.match(index, /lap-result-toast\.css\?build=20260721-r32/);
assert.match(app, /installLapResultToast\(\)/, 'The toast must install before the game runtime starts');
assert.match(lapSystem, /turn:lap-result/, 'Valid lap completion must publish one frozen result event');
assert.match(lapSystem, /raceRivals\.filter\(\(lap\) => lap\.time < finishedTime\)\.length/, 'Finish placement must be calculated against the rivals from the completed race');
assert.match(toast, /TOAST_VISIBLE_MS = 4000/, 'The result should remain readable for a few seconds');
assert.match(toast, /LAST LAP/, 'The toast must use the requested result label');
assert.match(toast, /lap-result-position/, 'The toast must show frozen finishing position');
assert.match(toast, /lap-result-time/, 'The toast must show the completed lap time');
assert.match(toast, /aria-live', 'polite'/, 'The result toast should be announced without interrupting gameplay');
assert.match(css, /background: var\(--yellow\)/, 'The toast must share the yellow finish-result colour');
assert.match(css, /left: max\(112px/, 'The toast should sit in the lower-left result area rather than cover the racing line');
assert.match(css, /prefers-reduced-motion: reduce/, 'Toast animation must respect reduced-motion preferences');

console.log('TURN lap result toast production regression passed.');
