import assert from 'node:assert/strict';

// TURN TUTORIAL foundation (#1131): session policy, finish-line boundary, tutorial
// lifecycle and the tutorial session. No tutorial UI exists yet (#1132).
const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key)
};
const events = new globalThis.EventTarget();
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.removeEventListener = events.removeEventListener.bind(events);
globalThis.dispatchEvent = events.dispatchEvent.bind(events);

const {
  SESSION_POLICY,
  activeSessionPolicy,
  sessionPolicy,
  tutorialLapPolicy
} = await import('../turn/race/session-policy.js');
const { completeLapState } = await import('../turn/race/lap-system-r86.js');
const { saveRivalsState } = await import('../turn/race/rival-storage.js');
const { createAchievementStore } = await import('../turn/achievements/store.js');
const {
  TURN_TUTORIAL,
  TUTORIAL_STATUS,
  TUTORIAL_STORAGE_KEY,
  createTutorialProgress,
  hasPlayedBefore
} = await import('../turn/tutorial/tutorial-progress.js');
const { createTutorialSession } = await import('../turn/tutorial/tutorial-session.js');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function makeSamples(count = 100) {
  return Array.from({ length: count }, (_, index) => ({
    point: { x: index * 10, y: 0, z: 0 },
    tangent: { x: 1, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 }
  }));
}

function makeFrames(count = 25) {
  return Array.from({ length: count }, (_, index) => ({
    t: index * 0.05, x: index, z: index * 2, h: index * 0.01, s: 0.1, d: 0.2, p: index / (count - 1)
  }));
}

function makeState(overrides = {}) {
  return {
    trackId: 'countryside',
    vehicleId: 'classic',
    running: true,
    lap: 1,
    lapActive: true,
    lapStartedAt: 0,
    lapElapsed: 0,
    lapCheckpointIndex: 0,
    recording: makeFrames(),
    competitorLaps: [],
    bestTime: Infinity,
    ghostFrames: [],
    ghostVisible: false,
    ...overrides
  };
}

// One completed lap through the production wrapper, as main.js runs it.
function finishLap(state, now) {
  let ghostSaves = 0;
  let scoredAsRanked;
  const result = completeLapState({
    state,
    samples: makeSamples(),
    now,
    competitorLimit: 4,
    saveGhost: () => { ghostSaves += 1; },
    finalizeScores: ({ rankedLap }) => { scoredAsRanked = rankedLap; return null; }
  });
  state.recording = makeFrames();
  state.lapStartedAt = now;
  return { result, ghostSaves, scoredAsRanked };
}

function makeProgress(hasPlayed = () => false) {
  return createTutorialProgress({ storage: globalThis.localStorage, hasPlayed });
}

test('session policies: ordinary play, reward preview and the teaching lap', () => {
  assert.equal(sessionPolicy({}).id, 'normal');
  assert.equal(sessionPolicy({ rewardPreview: { key: 'patrol:midnight-city' } }), SESSION_POLICY.rewardPreview);
  const firstRun = tutorialLapPolicy();
  const replay = tutorialLapPolicy({ replay: true });
  for (const policy of [firstRun, replay]) {
    assert.deepEqual([policy.achievements, policy.progress, policy.challenges, policy.records, policy.ghost],
      [false, false, false, false, 'session'], 'A teaching lap earns nothing but still becomes a ghost');
  }
  assert.equal(firstRun.graduatesTo, 'normal');
  assert.equal(replay.graduatesTo, 'sandbox', 'A replay never writes over stored rivals');
  assert.equal(SESSION_POLICY.sandbox.ghost, 'session');
  assert.equal(SESSION_POLICY.rewardPreview.challenges, true, 'PATROL and EXCURSION still pay their own reward');
});

test('the teaching lap earns nothing, becomes a session ghost and graduates at the line', () => {
  memory.clear();
  const store = createAchievementStore(globalThis.localStorage);
  const state = makeState({ sessionPolicy: tutorialLapPolicy() });
  globalThis.__turnRuntime = { state };
  const seen = [];
  // Stand-ins for the real listeners: the achievement runtime unlocks FIRST TURN on any
  // valid lap; the tutorial session listens for graduation.
  const onLap = (event) => {
    seen.push(['lap-result', activeSessionPolicy().id, store.unlock('first-turn', { trackId: 'countryside' })?.id ?? null, event.detail.saved]);
  };
  const onGraduated = (event) => seen.push(['graduated', event.detail.policy]);
  globalThis.addEventListener('turn:lap-result', onLap);
  globalThis.addEventListener('turn:session-graduated', onGraduated);
  try {
    const teaching = finishLap(state, 60_000);
    assert.equal(teaching.result.validLap, true);
    assert.equal(teaching.result.ranked, false, 'No best time or DRIFT/FLOW record from the teaching lap');
    assert.equal(teaching.scoredAsRanked, false);
    assert.equal(teaching.ghostSaves, 0, 'The teaching lap is never written to rival storage');
    assert.equal(state.competitorLaps.length, 1, 'The teaching lap becomes the ghost to catch');
    assert.equal(state.competitorLaps[0].sessionOnly, true);
    assert.equal(state.bestTime, 60, 'The run races the teaching lap');
    assert.equal(teaching.result.graduated, true);
    assert.equal(state.sessionPolicy, null, 'The run continues as ordinary TURN');
    assert.deepEqual(seen, [
      ['lap-result', 'tutorial-lap', null, false],
      ['graduated', 'normal']
    ], 'Every lap-result listener sees the teaching lap before the switch');
    assert.equal(store.isUnlocked('first-turn'), false, 'FIRST TURN never comes from the teaching lap');

    const ordinary = finishLap(state, 115_000);
    assert.equal(ordinary.result.ranked, true);
    assert.equal(ordinary.scoredAsRanked, true);
    assert.equal(ordinary.ghostSaves, 1, 'The first ordinary lap is a stored rival');
    assert.equal(ordinary.result.graduated, false);
    assert.equal(seen.at(-1)[2], 'first-turn', 'The first ordinary valid lap earns FIRST TURN');
    assert.equal(state.competitorLaps.length, 2);
  } finally {
    globalThis.removeEventListener('turn:lap-result', onLap);
    globalThis.removeEventListener('turn:session-graduated', onGraduated);
    delete globalThis.__turnRuntime;
  }
});

test('a replay graduates into a sandbox: ordinary racing, no stored rivals written', () => {
  const state = makeState({ sessionPolicy: tutorialLapPolicy({ replay: true }) });
  finishLap(state, 60_000);
  assert.equal(sessionPolicy(state).id, 'sandbox');
  const next = finishLap(state, 115_000);
  assert.equal(next.result.ranked, true, 'Sandbox laps are ordinary laps');
  assert.equal(next.ghostSaves, 0, 'The borrowed track keeps its stored rivals');
  assert.ok(state.competitorLaps.every((lap) => lap.sessionOnly === true));
  assert.equal(next.result.savedLap, false);
});

test('a session-only ghost is never written to rival storage', () => {
  memory.clear();
  const stored = { time: 50, frames: makeFrames(), carId: 'classic' };
  const state = makeState({ competitorLaps: [{ ...stored, time: 45, sessionOnly: true }, stored] });
  saveRivalsState(state, { trackId: 'countryside' });
  const saved = JSON.parse(memory.get('turn-personal-rivals-v1'));
  assert.equal(saved.laps.length, 1);
  assert.equal(saved.laps[0].time, 50, 'Only the ordinary lap is stored');
});

test('tutorial lifecycle: start, interrupt, stop, complete and replay', () => {
  memory.clear();
  let progress = makeProgress();
  const id = TURN_TUTORIAL.id;
  assert.equal(progress.status(id), TUTORIAL_STATUS.NOT_STARTED);
  assert.equal(progress.startsOnLaunch(id), true, 'A new player\'s first launch starts the tutorial');
  assert.equal(memory.has(TUTORIAL_STORAGE_KEY), false, 'Reading a new profile writes nothing');

  progress.begin(id);
  progress = makeProgress();
  assert.equal(progress.status(id), TUTORIAL_STATUS.IN_PROGRESS, 'Leaving mid-tutorial keeps it in progress');
  assert.equal(progress.startsOnLaunch(id), true, 'The next launch starts it again');

  progress.stop(id);
  progress = makeProgress();
  assert.equal(progress.startsOnLaunch(id), false, 'STOP TUTORIAL turns the reminders off');
  assert.equal(progress.status(id), TUTORIAL_STATUS.IN_PROGRESS, 'Stopping is not completion');

  progress.begin(id);
  assert.equal(progress.complete(id, TURN_TUTORIAL.revision), true, 'The first completion is the rewarded one');
  progress = makeProgress();
  assert.equal(progress.status(id), TUTORIAL_STATUS.COMPLETED);
  assert.equal(progress.startsOnLaunch(id), false, 'A completed tutorial never starts by itself');

  progress.begin(id);
  assert.equal(progress.status(id), TUTORIAL_STATUS.COMPLETED, 'A replay keeps the tutorial completed');
  assert.equal(progress.complete(id, TURN_TUTORIAL.revision), false, 'A replay is not rewarded again');
  assert.equal(progress.complete(id, TURN_TUTORIAL.revision + 1), false, 'A later revision does not re-onboard');
  assert.equal(makeProgress().get(id).completedRevision, TURN_TUTORIAL.revision + 1);
});

test('existing players count as completed, without a reward, when first considered', () => {
  memory.clear();
  let asked = 0;
  const progress = makeProgress(() => { asked += 1; return true; });
  assert.equal(asked, 0, 'Nothing is decided when the module loads');
  assert.equal(progress.startsOnLaunch(TURN_TUTORIAL.id), false);
  assert.equal(progress.get(TURN_TUTORIAL.id).migrated, true);
  assert.equal(makeProgress(() => false).status(TURN_TUTORIAL.id), TUTORIAL_STATUS.COMPLETED, 'Stored once');
  // A player who stopped the tutorial and then played normally keeps their choice.
  memory.clear();
  makeProgress().stop(TURN_TUTORIAL.id);
  assert.equal(makeProgress(() => true).status(TURN_TUTORIAL.id), TUTORIAL_STATUS.NOT_STARTED);
  assert.equal(makeProgress(() => true).startsOnLaunch(TURN_TUTORIAL.id), false);

  memory.clear();
  const store = createAchievementStore(globalThis.localStorage);
  assert.equal(hasPlayedBefore({ store }), false);
  store.unlock('first-turn');
  assert.equal(hasPlayedBefore({ store }), true);
});

function makeSessionHarness({ trackId = 'airport', vehicleId = 'convertible', stored = [] } = {}) {
  const calls = [];
  const state = makeState({ running: false, trackId, vehicleId, vehicleColor: '#123456', vehicleSecondaryColor: '#abcdef', competitorLaps: [...stored] });
  const raceSession = {
    leaveRace() { calls.push(['leave']); state.running = false; },
    async selectVehicle(selection, options) {
      calls.push(['car', selection.carId, options.persist]);
      Object.assign(state, { vehicleId: selection.carId, vehicleColor: selection.color, vehicleSecondaryColor: selection.secondaryColor });
    }
  };
  async function activateTrack(id, options) {
    calls.push(['track', id, options.persist]);
    state.trackId = id;
    state.competitorLaps = id === trackId ? [...stored] : [{ time: 70, frames: makeFrames() }];
  }
  return { state, calls, raceSession, activateTrack };
}

test('a tutorial session borrows COUNTRYSIDE and the LEARNER CAR, then restores everything', async () => {
  memory.clear();
  const progress = makeProgress();
  const stored = [{ time: 41, frames: makeFrames() }];
  const harness = makeSessionHarness({ stored });
  let rivalSyncs = 0;
  const session = createTutorialSession({ ...harness, progress, syncRivals: () => { rivalSyncs += 1; } });

  assert.equal(await session.enter(), true);
  assert.equal(await session.enter(), false, 'One session at a time');
  assert.deepEqual(harness.calls.slice(0, 2), [['track', 'countryside', false], ['car', 'classic', false]],
    'The tutorial selection is never saved');
  assert.equal(harness.state.competitorLaps.length, 0, 'No rival drives ahead of the teaching lap');
  assert.equal(rivalSyncs, 1);
  assert.equal(sessionPolicy(harness.state).id, 'tutorial-lap');
  assert.equal(sessionPolicy(harness.state).graduatesTo, 'normal');
  assert.equal(progress.status(TURN_TUTORIAL.id), TUTORIAL_STATUS.IN_PROGRESS);

  globalThis.dispatchEvent(new CustomEvent('turn:session-graduated', { detail: { policy: 'normal' } }));
  assert.equal(session.graduated, true);
  assert.equal(session.firstCompletion, true);
  assert.equal(progress.status(TURN_TUTORIAL.id), TUTORIAL_STATUS.COMPLETED);

  harness.state.sessionPolicy = SESSION_POLICY.sandbox;
  assert.equal(await session.exit(), true);
  assert.equal(session.active, false);
  assert.equal(harness.state.sessionPolicy, null);
  assert.equal(harness.state.trackId, 'airport');
  assert.equal(harness.state.vehicleId, 'convertible');
  assert.equal(harness.state.vehicleColor, '#123456');
  assert.deepEqual(harness.state.competitorLaps, stored, 'The stored rivals come back');
  assert.deepEqual(harness.calls.slice(-2), [['track', 'airport', false], ['car', 'convertible', false]]);

  globalThis.dispatchEvent(new CustomEvent('turn:session-graduated', { detail: { policy: 'normal' } }));
  assert.equal(progress.complete(TURN_TUTORIAL.id), false, 'An ended session no longer listens');
});

test('replay and STOP TUTORIAL', async () => {
  memory.clear();
  const progress = makeProgress();
  progress.complete(TURN_TUTORIAL.id);
  const replay = makeSessionHarness();
  const replaySession = createTutorialSession({ ...replay, progress });
  await replaySession.enter();
  assert.equal(sessionPolicy(replay.state).graduatesTo, 'sandbox');
  await replaySession.exit();

  memory.clear();
  const fresh = makeProgress();
  const harness = makeSessionHarness();
  const session = createTutorialSession({ ...harness, progress: fresh });
  await session.enter();
  await session.stop();
  assert.equal(fresh.startsOnLaunch(TURN_TUTORIAL.id), false, 'STOP TUTORIAL ends automatic starts');
  assert.equal(fresh.status(TURN_TUTORIAL.id), TUTORIAL_STATUS.IN_PROGRESS);
  assert.equal(harness.state.trackId, 'airport');
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exit(1);
console.log(`TURN tutorial foundation regression passed (${tests.length} tests).`);
