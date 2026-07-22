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

function makeState({
  recording = makeFrames(),
  lapElapsed = 13.5,
  rivalTimes = [10, 11, 12, 13]
} = {}) {
  return {
    competitorLaps: rivalTimes.map((time) => ({ time, frames: makeFrames() })),
    recording,
    lapStartedAt: 0,
    lapCheckpointIndex: 12,
    lapInvalid: false,
    lapActive: true,
    lap: 1,
    lapElapsed,
    bestTime: rivalTimes[0] ?? Infinity,
    ghostFrames: [],
    ghostVisible: rivalTimes.length > 0,
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
  assert.equal(state.lapInvalid, false, 'A newly started lap after a valid finish must begin clean');
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

  for (const rivalTimes of [[], [11, 14], [10, 11, 12, 13]]) {
    const rivalCountState = makeState({ recording: makeFrames(5), rivalTimes });
    const rivalCountResult = completeLapState({
      state: rivalCountState,
      samples,
      now: 12500,
      competitorLimit: 4,
      saveGhost() { assert.fail('The short diagnostic replay must not alter the saved rival list'); }
    });
    assert.equal(rivalCountResult.completedLap, true, `lap completion must not depend on having ${rivalTimes.length} rivals`);
    assert.equal(rivalCountResult.total, rivalTimes.length + 1, 'only the displayed field size should follow rival count');
    assert.equal(rivalCountResult.position, 1 + rivalTimes.filter((time) => time < 12.5).length, 'placement must be calculated from available rival times without affecting lap validity');
  }
} finally {
  if (originalCustomEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = originalCustomEvent;
  if (originalDispatchEvent === undefined) delete globalThis.dispatchEvent; else globalThis.dispatchEvent = originalDispatchEvent;
}

const [index, app, lapSystem, gameState, hud, styles, toast, toastCss, onboarding, onboardingCss] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/lap-result-toast.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/rival-onboarding.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/rival-onboarding.css', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.27 · Build 2026\.07\.22-r44/);
assert.match(index, /lap-result-toast\.css\?build=20260722-r44/);
assert.match(index, /rival-onboarding\.css\?build=20260722-r44/);
assert.match(index, /"\.\/race\/lap-system\.js\?build=20260720-r19": "\.\/race\/lap-system\.js\?build=20260722-r41"/, 'r44 must preserve the r41 early invalid-lap detector');
assert.match(index, /"\.\/race\/game-state\.js": "\.\/race\/game-state\.js\?build=20260722-r41"/, 'r44 must preserve the r41 reset-safe invalid-lap state');
assert.match(app, /installLapResultToast\(\)/, 'The lap result toast must install before the game runtime starts');
assert.match(app, /installRivalOnboarding\(\)/, 'The rival onboarding plate must install before the game runtime starts');
assert.match(lapSystem, /turn:lap-result/);
assert.match(lapSystem, /turn:lap-invalid/);
assert.match(lapSystem, /crossedLaterCheckpointGate/);
assert.match(lapSystem, /state\.lapInvalid = true/);
assert.doesNotMatch(lapSystem, /crossedStartByProgress/);
assert.match(gameState, /state\.lapInvalid = false/);
assert.match(hud, /lapInvalid \? 'INVALID LAP' : formatTime\(state\.lapElapsed\)/);
assert.match(styles, /\.chip\.is-invalid-lap \{\s*background: #ff6b6b;/s);
assert.match(toast, /STAY ON THE TRACK!/);
assert.match(onboarding, /CHASE YOUR BEST/);
assert.match(onboarding, /ghost: true/);
assert.match(onboarding, /renderer\.dispose\(\)/);
assert.match(toastCss, /prefers-reduced-motion: reduce/);
assert.match(onboardingCss, /\.rival-onboarding-model/);

console.log('TURN persistent INVALID LAP HUD, unified lap feedback and first-rival onboarding regression passed.');
