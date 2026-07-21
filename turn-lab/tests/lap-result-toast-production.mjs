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
    const rivalCountState = makeState({
      recording: makeFrames(5),
      rivalTimes
    });
    const rivalCountResult = completeLapState({
      state: rivalCountState,
      samples,
      now: 12500,
      competitorLimit: 4,
      saveGhost() {
        assert.fail('The short diagnostic replay must not alter the saved rival list');
      }
    });

    assert.equal(rivalCountResult.completedLap, true, `lap completion must not depend on having ${rivalTimes.length} rivals`);
    assert.equal(rivalCountResult.total, rivalTimes.length + 1, 'only the displayed field size should follow rival count');
    assert.equal(
      rivalCountResult.position,
      1 + rivalTimes.filter((time) => time < 12.5).length,
      'placement must be calculated from available rival times without affecting lap validity'
    );
  }
} finally {
  if (originalCustomEvent === undefined) delete globalThis.CustomEvent;
  else globalThis.CustomEvent = originalCustomEvent;
  if (originalDispatchEvent === undefined) delete globalThis.dispatchEvent;
  else globalThis.dispatchEvent = originalDispatchEvent;
}

const [index, app, lapSystem, gameState, toast, toastCss, onboarding, onboardingCss] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/lap-result-toast.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/rival-onboarding.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/rival-onboarding.css', import.meta.url), 'utf8')
]);

assert.match(index, /TURN v1\.3\.22 · Build 2026\.07\.22-r39/);
assert.match(index, /lap-result-toast\.css\?build=20260722-r39/);
assert.match(index, /rival-onboarding\.css\?build=20260722-r39/);
assert.match(index, /"\.\/race\/lap-system\.js\?build=20260720-r19": "\.\/race\/lap-system\.js\?build=20260721-r38"/, 'r39 must preserve the corrected single-source physical lap system');
assert.match(index, /"\.\/race\/game-state\.js": "\.\/race\/game-state\.js\?build=20260722-r39"/, 'r39 must cache-bust the restart-message removal');
assert.match(app, /installLapResultToast\(\)/, 'The lap result toast must install before the game runtime starts');
assert.match(app, /installRivalOnboarding\(\)/, 'The rival onboarding plate must install before the game runtime starts');
assert.match(lapSystem, /turn:lap-result/, 'Completed lap finish must publish one frozen result event');
assert.match(lapSystem, /turn:lap-invalid/, 'Incomplete checkpoint chains must publish explicit invalid-lap feedback');
assert.match(lapSystem, /suppressNextLapStartMessage = true/, 'Invalid-lap feedback must not be obscured by a competing GO message');
assert.doesNotMatch(lapSystem, /crossedStartByProgress/, 'Start and finish must use only the swept physical line crossing');
assert.match(lapSystem, /const completedLap = finishedTime > 5/, 'Result visibility must be separated from replay-save eligibility');
assert.match(lapSystem, /const validLap = completedLap && state\.recording\.length > 20/, 'Ghost saving may still require a usable recording');
assert.match(lapSystem, /if \(completedLap\) \{\s*publishLapResult/s, 'Every completed lap must publish a result, including last place and unsaved replays');
assert.doesNotMatch(lapSystem, /TOP ['"] \+|NEW BEST|showMessage\?\.\(message\)/, 'The retired duplicate lap-ranking message must stay removed');
assert.match(lapSystem, /raceRivals\.filter\(\(lap\) => lap\.time < finishedTime\)\.length/, 'Finish placement must be calculated against the rivals from the completed race');
assert.match(toast, /TOAST_VISIBLE_MS = 4000/, 'The result should remain readable for a few seconds');
assert.match(toast, /LAST LAP/, 'Valid laps must keep the requested result label');
assert.match(toast, /LAP INVALID/, 'Invalid laps must replace LAST LAP with an explicit failure label');
assert.match(toast, /STAY ON THE TRACK!/, 'Invalid checkpoint chains must use player-facing track guidance');
assert.doesNotMatch(toast, /MISSED CHECKPOINT/, 'Technical checkpoint language must stay out of the player-facing toast');
assert.match(toast, /turn:lap-invalid/, 'The unified toast must listen for invalid-lap events');
assert.match(toast, /lap-result-position/, 'The toast must show frozen finishing position');
assert.match(toast, /lap-result-time/, 'The toast must show the completed lap time');
assert.match(toast, /aria-live', 'polite'/, 'The result toast should be announced without interrupting gameplay');
assert.doesNotMatch(gameState, /READY FOR THE LINE/, 'Restart Lap must not show redundant ready-state feedback');
assert.match(onboarding, /CHASE YOUR BEST/, 'The first rival must introduce the core chase-your-best loop');
assert.match(onboarding, /reason === 'lap-completed'/, 'Onboarding must be tied to the first newly saved rival after a completed lap');
assert.match(onboarding, /!hadRival && hasRival/, 'The onboarding plate must only trigger on the zero-to-one rival transition');
assert.match(onboarding, /makeGhostColor\(color\)/, 'The onboarding plate must use the same lighter body colour as the ghost car');
assert.match(onboarding, /RESULT_TOAST_HANDOFF_MS = 4300/, 'First-rival onboarding must wait until the lap-result toast has cleared');
assert.match(toastCss, /background: var\(--yellow\)/, 'The lap toast must share the yellow finish-result colour');
assert.match(toastCss, /left: 50%/, 'The lap toast must occupy the central finish-message position');
assert.match(toastCss, /top: 22%/, 'The lap toast must sit where the old TOP X LAP message appeared');
assert.doesNotMatch(toastCss, /left: max\(112px/, 'The retired lower-left toast placement must stay removed');
assert.match(toastCss, /prefers-reduced-motion: reduce/, 'Toast animation must respect reduced-motion preferences');
assert.match(onboardingCss, /background: var\(--rival-onboarding-color, var\(--yellow\)\)/, 'The onboarding plate must expose the rival colour through a CSS custom property');
assert.match(onboardingCss, /border-radius: 999px/, 'The onboarding must keep the compact pill-plate language of the old READY message');

console.log('TURN unified lap feedback and first-rival onboarding regression passed.');
