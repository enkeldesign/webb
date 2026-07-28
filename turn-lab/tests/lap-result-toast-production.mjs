import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { completeLapState } from '../../turn/race/lap-system-r86.js';
import {
  lapResultAnnouncement,
  ordinalWord,
  spokenLapTime,
  spokenPosition
} from '../../turn/ui/race-announcements.js';

assert.equal(ordinalWord(1), 'first');
assert.equal(ordinalWord(2), 'second');
assert.equal(ordinalWord(3), 'third');
assert.equal(ordinalWord(4), 'fourth');
assert.equal(ordinalWord(5), 'fifth');
assert.equal(spokenPosition(1, 5), 'first of five');
assert.equal(spokenLapTime(75.346), 'one minute, fifteen point three four six seconds');
assert.equal(
  lapResultAnnouncement({ position: 1, time: 75.346 }),
  'Lap. Position: first. Time: one minute, fifteen point three four six seconds.'
);

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
  assert.deepEqual(publishedResults.at(-1)?.detail, { position: 5, total: 5, time: 14 }, 'Every completed lap must publish the frozen lap result');

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

  const unrankedState = makeState({ rivalTimes: [10, 11, 12] });
  unrankedState.vehicleId = 'sedan-sports';
  unrankedState.vehicleSecondaryColor = '#666666';
  const originalRivals = unrankedState.competitorLaps;
  const originalGhostFrames = unrankedState.ghostFrames;
  let unrankedSaveCalls = 0;
  const unrankedResult = completeLapState({
    state: unrankedState,
    samples,
    now: 9000,
    competitorLimit: 4,
    saveGhost() {
      unrankedSaveCalls += 1;
    }
  });

  assert.equal(unrankedResult.completedLap, true, 'The easter egg lap must still complete normally on screen');
  assert.equal(unrankedResult.validLap, true, 'The easter egg must not masquerade as a missed-checkpoint lap');
  assert.equal(unrankedResult.savedLap, false, 'The max-stat easter egg lap must be explicitly unranked');
  assert.strictEqual(unrankedState.competitorLaps, originalRivals, 'The rival array must be restored atomically after an easter egg finish');
  assert.strictEqual(unrankedState.ghostFrames, originalGhostFrames, 'The current best ghost must remain untouched');
  assert.equal(unrankedState.bestTime, 10, 'An easter egg time must never replace BEST');
  assert.equal(unrankedState.ghostVisible, true, 'Existing rivals must remain visible after the unranked finish');
  assert.equal(unrankedSaveCalls, 0, 'Unranked laps must never call persistent rival storage');
  assert.deepEqual(publishedResults.at(-1)?.detail, { position: 1, total: 4, time: 9 }, 'The player may still see the completed lap result');
} finally {
  if (originalCustomEvent === undefined) delete globalThis.CustomEvent;
  else globalThis.CustomEvent = originalCustomEvent;
  if (originalDispatchEvent === undefined) delete globalThis.dispatchEvent;
  else globalThis.dispatchEvent = originalDispatchEvent;
}

const [index, releaseSource, app, lapSystem, lapPolicy, gameState, hud, styles, hudTuning, toast, toastCss, onboarding, onboardingCss] = await Promise.all([
  fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/release.json', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/lap-system-r86.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/race/game-state.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/hud.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/styles.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/hud-tuning.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/lap-result-toast.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/lap-result-toast.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/ui/rival-onboarding.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/rival-onboarding.css', import.meta.url), 'utf8')
]);

const release = JSON.parse(releaseSource);
const importMapText = index.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];
assert.ok(importMapText, 'Production must expose its import map');
const imports = JSON.parse(importMapText).imports;

assert.match(index, new RegExp(`TURN v${release.version.replaceAll('.', '\\.')} · Build ${release.id.replaceAll('.', '\\.')}`));
assert.match(index, new RegExp(`lap-result-toast\\.css\\?build=${release.cacheKey}`));
assert.match(index, new RegExp(`rival-onboarding\\.css\\?build=${release.cacheKey}`));
assert.equal(imports['./race/lap-system.js?build=20260720-r19'], `./race/lap-system-r86.js?build=${release.cacheKey}`, 'The current release must publish the unranked easter egg policy around the verified lap engine');
assert.equal(imports['./race/game-state.js'], `./race/game-state.js?build=${release.cacheKey}`, 'The current release must publish reset-safe invalid-lap state');
assert.equal(imports['./ui/race-announcements.js'], `./ui/race-announcements.js?build=${release.cacheKey}`, 'Shared spoken race formatting must follow the release cache key');
assert.match(app, /installLapResultToast\(\)/, 'The lap result toast must install before the game runtime starts');
assert.match(app, /installRivalOnboarding\(\)/, 'The rival onboarding plate must install before the game runtime starts');
assert.match(lapSystem, /turn:lap-result/, 'Completed lap finish must publish one frozen result event');
assert.match(lapSystem, /turn:lap-invalid/, 'Incomplete checkpoint chains must publish explicit invalid-lap feedback');
assert.match(lapSystem, /crossedLaterCheckpointGate/, 'Crossing a later gate before the required one must detect an irrecoverably invalid attempt');
assert.match(lapSystem, /state\.lapInvalid = true/, 'The invalid attempt must stay marked until the next lap begins');
assert.match(lapSystem, /suppressNextLapStartMessage = true/, 'Invalid-lap feedback must not be obscured by a competing GO message');
assert.doesNotMatch(lapSystem, /crossedStartByProgress/, 'Start and finish must use only the swept physical line crossing');
assert.match(lapSystem, /const completedLap = finishedTime > 5/, 'Result visibility must be separated from replay-save eligibility');
assert.match(lapSystem, /const validLap = completedLap && state\.recording\.length > 20/, 'Ghost saving may still require a usable recording');
assert.match(lapSystem, /if \(completedLap\) \{\s*publishLapResult/s, 'Every completed lap must publish a result, including last place and unsaved replays');
assert.doesNotMatch(lapSystem, /TOP ['"] \+|NEW BEST|showMessage\?\.\(message\)/, 'The retired duplicate lap-ranking message must stay removed');
assert.match(lapSystem, /raceRivals\.filter\(\(lap\) => lap\.time < finishedTime\)\.length/, 'Finish placement must be calculated against the rivals from the completed race');
assert.match(lapPolicy, /isSportsSedanEasterEgg/, 'The production lap policy must recognize the hidden Sports Sedan setup');
assert.match(lapPolicy, /saveGhost: undefined/, 'The hidden setup must never reach persistent rival storage');
assert.match(lapPolicy, /state\.competitorLaps = savedState\.competitorLaps/, 'The hidden setup must restore rival state before the next render');
assert.match(lapPolicy, /savedLap: false/, 'The hidden setup must report its lap as unranked');
assert.match(gameState, /state\.lapInvalid = false/, 'Restart Lap and race staging must clear invalid-lap status');
assert.match(hud, /lapInvalid \? 'LAP VOID' : formatTime\(state\.lapElapsed\)/, 'The TIME card must stop displaying a running time once the lap is void');
assert.doesNotMatch(hud, /INVALID LAP/, 'Retired technical copy must not return to the TIME card');
assert.match(hud, /classList\.toggle\('is-invalid-lap', lapInvalid\)/, 'The TIME card must expose a persistent invalid visual state');
assert.match(styles, /\.chip\.is-invalid-lap \{\s*background: #ff6b6b;/s, 'Void laps must turn the TIME card red');
assert.match(styles, /\.chip\.is-invalid-lap strong/, 'LAP VOID must retain dedicated compact typography');
assert.match(hudTuning, /overflow: visible;/, 'Top HUD chips must avoid Safari rounded-overflow clipping seams');
assert.doesNotMatch(hudTuning, /overflow: hidden;/, 'Top HUD chips must not reintroduce the clipping path that produced horizontal repaint seams');
assert.match(toast, /TOAST_VISIBLE_MS = 4000/, 'The result should remain readable for a few seconds');
assert.match(toast, /<span>LAP<\/span>/, 'Valid laps must use the unambiguous LAP label');
assert.doesNotMatch(toast, /LAST LAP/, 'The ambiguous LAST LAP label must stay removed');
assert.match(toast, /LAP VOID/, 'Void laps must use the same concise wording as the TIME card');
assert.doesNotMatch(toast, /LAP INVALID|INVALID LAP/, 'Retired invalid-lap wording must not remain in player-facing result feedback');
assert.match(toast, /STAY ON THE TRACK!/, 'Invalid checkpoint chains must use player-facing track guidance');
assert.doesNotMatch(toast, /MISSED CHECKPOINT/, 'Technical checkpoint language must stay out of the player-facing toast');
assert.match(toast, /turn:lap-invalid/, 'The unified toast must listen for invalid-lap events');
assert.match(toast, /lap-result-position/, 'The toast must show frozen finishing position');
assert.match(toast, /lap-result-time/, 'The toast must show the completed lap time');
assert.match(toast, /toast\.setAttribute\('aria-label', 'Lap result'\)/, 'The visible result must remain inspectable without becoming another live region');
assert.doesNotMatch(toast, /toast\.setAttribute\('role', 'status'\)/, 'The visible toast must not duplicate the dedicated announcer');
assert.doesNotMatch(toast, /toast\.setAttribute\('aria-live'/, 'The visible toast must not announce each child mutation');
assert.match(toast, /announcer\.setAttribute\('aria-live', 'polite'\)/, 'One dedicated polite live region must own the result announcement');
assert.match(toast, /setLiveAnnouncement\(announcer, lapResultAnnouncement/, 'A valid result must be announced as one composed utterance');
assert.match(toast, /Position, \$\{spokenPosition/, 'The visible fraction must expose an ordinal position when inspected');
assert.match(toast, /Lap time, \$\{spokenLapTime/, 'The visible clock must expose the same time in speech-friendly form');
assert.doesNotMatch(gameState, /READY FOR THE LINE/, 'Restart Lap must not show redundant ready-state feedback');
assert.match(onboarding, /CHASE YOUR BEST/, 'The first rival must introduce the core chase-your-best loop');
assert.match(onboarding, /reason === 'lap-completed'/, 'Onboarding must be tied to the first newly saved rival after a completed lap');
assert.match(onboarding, /!hadRival && hasRival\) schedule\(rivals\[0\]\)/, 'The onboarding must use the newly saved rival rather than the current selection');
assert.match(onboarding, /rival\?\.carId/, 'The first-rival preview must use the saved ghost model');
assert.match(onboarding, /rival\?\.carColor/, 'The first-rival preview must use the saved ghost body paint');
assert.match(onboarding, /rival\?\.carSecondaryColor/, 'The first-rival preview must preserve saved secondary paint');
assert.match(onboarding, /ghost: true/, 'The onboarding model must use the same lighter solid ghost treatment as race rivals');
assert.match(onboarding, /targetLength: 6\.4/, 'The onboarding model must use the Lot 3D viewer presentation scale');
assert.match(onboarding, /PerspectiveCamera\(34, 1, 0\.1, 60\)/, 'The onboarding model must reuse the Lot viewer camera language');
assert.match(onboarding, /camera\.position\.set\(7\.8, 4\.8, 8\.8\)/, 'The onboarding model must use the Lot viewer camera position');
assert.match(onboarding, /HemisphereLight\(0xffffff, 0x5b6770, 3\.2\)/, 'The onboarding model must use the Lot viewer ambient lighting');
assert.match(onboarding, /VIEWER_ROTATION_RADIANS_PER_SECOND = 0\.144/, 'The onboarding preview must rotate at the same approximately 60fps Lot viewer speed');
assert.match(onboarding, /VIEWER_FRAME_INTERVAL_MS = 1000 \/ 30/, 'The temporary onboarding renderer must stay capped at 30 fps on mobile');
assert.match(onboarding, /renderer\.dispose\(\)/, 'The temporary onboarding renderer must be disposed after the reveal');
assert.match(onboarding, /RESULT_TOAST_HANDOFF_MS = 4300/, 'First-rival onboarding must wait until the lap-result toast has cleared');
assert.match(toastCss, /background: var\(--yellow\)/, 'Valid lap results must keep the yellow finish-result colour');
assert.match(toastCss, /\.lap-result-toast\.is-invalid \{\s*background: #ff6b6b;/s, 'STAY ON THE TRACK must use the same red void-lap colour as the TIME card');
assert.match(toastCss, /left: 50%/, 'The lap toast must occupy the central finish-message position');
assert.match(toastCss, /top: 22%/, 'The lap toast must sit where the old TOP X LAP message appeared');
assert.doesNotMatch(toastCss, /left: max\(112px/, 'The retired lower-left toast placement must stay removed');
assert.match(toastCss, /prefers-reduced-motion: reduce/, 'Toast animation must respect reduced-motion preferences');
assert.match(onboardingCss, /\.rival-onboarding-model/, 'The onboarding must reserve an adjacent host for the ghost model');
assert.match(onboardingCss, /\.rival-onboarding-copy/, 'The CHASE YOUR BEST copy must remain a separate pill plate beside the model');
assert.match(onboardingCss, /background: var\(--rival-onboarding-color, var\(--yellow\)\)/, 'The onboarding plate must expose the rival colour through a CSS custom property');
assert.match(onboardingCss, /border-radius: 999px/, 'The onboarding must keep the compact pill-plate language of the old READY message');

console.log(`TURN ${release.id} single-pass spoken lap results, persistent LAP VOID HUD and first-rival onboarding passed.`);
