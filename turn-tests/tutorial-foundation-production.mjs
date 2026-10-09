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
  TUTORIAL_COMPLETED_EVENT,
  TUTORIAL_STATUS,
  TUTORIAL_STORAGE_KEY,
  createTutorialProgress,
  hasPlayedBefore
} = await import('../turn/tutorial/tutorial-progress.js');
const { createTutorialSession } = await import('../turn/tutorial/tutorial-session.js');
const { createTurnTutorialCoach, readTutorialSignals } = await import('../turn/tutorial/turn-tutorial-coach.js');
const { TURN_TUTORIAL_LESSONS } = await import('../turn/tutorial/turn-tutorial-lessons.js');

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
  assert.equal(progress.startsOnLaunch(id), false, 'SKIP TUTORIAL turns the reminders off');
  assert.equal(progress.status(id), TUTORIAL_STATUS.IN_PROGRESS, 'Skipping is not completion');

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

  const completions = [];
  const onCompleted = (event) => completions.push(event.detail);
  globalThis.addEventListener(TUTORIAL_COMPLETED_EVENT, onCompleted);
  globalThis.dispatchEvent(new CustomEvent('turn:session-graduated', { detail: { policy: 'normal' } }));
  globalThis.removeEventListener(TUTORIAL_COMPLETED_EVENT, onCompleted);
  assert.equal(session.graduated, true);
  assert.equal(session.firstCompletion, true);
  assert.deepEqual(completions, [{ id: TURN_TUTORIAL.id, revision: TURN_TUTORIAL.revision, firstCompletion: true }],
    'The line announces the first completion, which is what the reward listens for');
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

test('a failed restore keeps the player\'s selection for a retry', async () => {
  memory.clear();
  const harness = makeSessionHarness();
  const session = createTutorialSession({ ...harness, progress: makeProgress() });
  await session.enter();
  const activate = harness.activateTrack;
  let failOnce = true;
  const flaky = createTutorialSession({
    ...harness,
    progress: makeProgress(),
    activateTrack: async (id, options) => {
      if (failOnce && id === 'airport') { failOnce = false; throw new Error('Track unavailable'); }
      return activate(id, options);
    }
  });
  await session.exit();
  await flaky.enter();
  await assert.rejects(flaky.exit(), /Track unavailable/);
  assert.equal(flaky.active, true, 'The saved selection survives the failed restore');
  assert.equal(harness.state.sessionPolicy, null, 'Progression is never left suspended');
  assert.equal(await flaky.exit(), true);
  assert.equal(flaky.active, false);
  assert.equal(harness.state.trackId, 'airport');
  assert.equal(harness.state.vehicleId, 'convertible');
});

test('replay and SKIP TUTORIAL', async () => {
  memory.clear();
  const progress = makeProgress();
  progress.complete(TURN_TUTORIAL.id);
  const replay = makeSessionHarness();
  const replaySession = createTutorialSession({ ...replay, progress });
  await replaySession.enter();
  assert.equal(sessionPolicy(replay.state).graduatesTo, 'sandbox');
  const replayCompletions = [];
  const onReplayCompleted = (event) => replayCompletions.push(event.detail.firstCompletion);
  globalThis.addEventListener(TUTORIAL_COMPLETED_EVENT, onReplayCompleted);
  globalThis.dispatchEvent(new CustomEvent('turn:session-graduated', { detail: { policy: 'sandbox' } }));
  globalThis.removeEventListener(TUTORIAL_COMPLETED_EVENT, onReplayCompleted);
  assert.deepEqual(replayCompletions, [false], 'A replay is a completion, but not the first: no second reward');
  await replaySession.exit();

  memory.clear();
  const fresh = makeProgress();
  const harness = makeSessionHarness();
  const session = createTutorialSession({ ...harness, progress: fresh });
  await session.enter();
  await session.stop();
  assert.equal(fresh.startsOnLaunch(TURN_TUTORIAL.id), false, 'SKIP TUTORIAL ends automatic starts');
  assert.equal(fresh.status(TURN_TUTORIAL.id), TUTORIAL_STATUS.IN_PROGRESS);
  assert.equal(harness.state.trackId, 'airport');
});

test('the first-launch card opens for players, and in test runs only when asked', async () => {
  const { opensTutorialOnLaunch, LAUNCH_UNDER_TEST_KEY } = await import('../turn/tutorial/tutorial-entry.js');
  const at = (hostname, { webdriver = false, optIn = false } = {}) => opensTutorialOnLaunch({
    location: { hostname },
    navigator: { webdriver },
    localStorage: { getItem: (key) => (optIn && key === LAUNCH_UNDER_TEST_KEY ? '1' : null) }
  });
  assert.equal(at('enkel.design'), true, 'A player\'s launch');
  assert.equal(at('claude-turn-game-review-gz74.turntest.pages.dev'), true, 'Preview builds behave like the game');
  assert.equal(at('enkel.design', { webdriver: true }), false, 'Browser automation');
  assert.equal(at('127.0.0.1'), false, 'The local test server');
  assert.equal(at('127.0.0.1', { webdriver: true, optIn: true }), true, 'A test of the first launch opts in');
  assert.equal(opensTutorialOnLaunch({ location: { hostname: '127.0.0.1' }, navigator: {}, get localStorage() { throw new Error('blocked'); } }), false);
});

test('ABOUT TURN, the first-launch card and HOW TO PLAY say what TURN is for', async () => {
  const fs = await import('node:fs');
  const about = fs.readFileSync(new URL('../turn/content/about-turn.js', import.meta.url), 'utf8');
  const entry = fs.readFileSync(new URL('../turn/tutorial/tutorial-entry.js', import.meta.url), 'utf8');
  const goal = /the feel of the drive and getting faster\. Your best laps become rivals to beat, and trophies unlock new tracks, cars and ways to play\./;
  assert.match(about, /<p class="m8-about-lead">TURN is about the feel of the drive and getting faster\./,
    'ABOUT TURN, linked from the install page and in the game, leads with it');
  assert.match(about, goal);
  assert.match(entry, goal, 'The first-launch card and HOW TO PLAY');
  assert.match(entry, /SKIP TUTORIAL/);
});

test('course rescue leaves ordinary off-road driving alone and stops a big mistake', async () => {
  const { applyCourseRescue, COURSE_RESCUE } = await import('../turn/tutorial/course-rescue.js');
  // A straight stretch heading +z; the off-road line is 0.58 x 27 = 15.66 m from the centre.
  const samples = [{ point: { x: 0, z: 0 }, tangent: { x: 0, z: 1 }, normal: { x: 1, z: 0 } }];
  const line = 27 * 0.58;
  const car = (x, vx) => ({ nearestTrackIndex: 0, position: { x, z: 0 }, velocity: { x: vx, z: 20 }, speed: 0 });
  const rescue = (state) => applyCourseRescue({ state, samples, trackWidth: 27, dt: 0.1 });

  const onRoad = car(10, 3);
  assert.equal(rescue(onRoad), 'none');
  assert.deepEqual(onRoad.velocity, { x: 3, z: 20 }, 'On the road nothing is touched');
  const justOff = car(line + 1, 3);
  assert.equal(rescue(justOff), 'none', 'Briefly off the road is ordinary driving, with its usual penalty');

  for (const side of [1, -1]) {
    const drifting = car(side * (line + COURSE_RESCUE.softFrom + 3), side * 6);
    assert.equal(rescue(drifting), 'push');
    assert.ok(drifting.velocity.x * side < 6, 'Heading away from the road is slowed');
    assert.equal(drifting.velocity.z, 20, 'Forward motion is kept');
    assert.ok(drifting.speed > 0);

    const lost = car(side * (line + COURSE_RESCUE.limit + 10), side * 6);
    assert.equal(rescue(lost), 'limit');
    assert.ok(Math.abs(Math.abs(lost.position.x) - (line + COURSE_RESCUE.limit)) < 1e-9, 'Held at the remote limit');
    assert.ok(lost.velocity.x * side < 0, 'Turned back towards the road');
    assert.ok(Math.abs(lost.velocity.z - 20 * 0.82) < 1e-9, 'Still moving forward, not snapped back');
  }
  assert.equal(applyCourseRescue({ state: car(40, 0), samples: [], trackWidth: 27, dt: 0.1 }), 'none', 'No sample, no rescue');
  const prompt = await import('node:fs').then((fs) => fs.readFileSync(new URL('../turn/tutorial/tutorial-prompt.js', import.meta.url), 'utf8'));
  assert.match(prompt, /if \(!graduated && dt > 0\) \{\n(?:\s{8}.*\n)*?\s{8}const rescue = applyCourseRescue\(/, 'Only on the teaching lap');
});

test('TURN TUTORIAL earns 25 trophies in Ways to play, outside Getting started', async () => {
  const catalog = await import('../turn/achievements/catalog.js');
  const achievement = catalog.ACHIEVEMENTS.find((entry) => entry.id === catalog.TURN_TUTORIAL_ACHIEVEMENT.id);
  assert.ok(achievement, 'In the achievements catalog');
  assert.equal(achievement.trophies, 25);
  assert.equal(achievement.category, 'ways-to-play');
  assert.equal(catalog.ONBOARDING_ACHIEVEMENT_IDS.includes(achievement.id), false,
    'Existing players never play it, so it cannot hold up Getting started');
  const runtime = await import('node:fs').then((fs) => fs.readFileSync(new URL('../turn/achievements/runtime.js', import.meta.url), 'utf8'));
  assert.match(runtime, /addEventListener\(TUTORIAL_COMPLETED_EVENT[\s\S]{0,200}firstCompletion !== true\) return;\s*unlock\(\[TURN_TUTORIAL_ACHIEVEMENT\.id\]/,
    'Only the first completion unlocks it');
});

test('the coach teaches DRIVE, BOOST and DRIFT by doing, with no failure state', () => {
  const state = { sessionSpeedCap: null };
  const views = [];
  let input = { progress: 0.02, speed: 70, gas: false, drift: false, boostActive: false, boostCharge: 1, routeCues: true, paceNotes: 0 };
  const coach = createTurnTutorialCoach({ state, maxSpeed: 88, signals: () => input, present: (view) => views.push(view) });
  const run = (seconds, change = {}) => {
    input = { ...input, ...change };
    for (let t = 0; t < seconds; t += 0.1) coach.update(0.1);
  };
  assert.deepEqual(TURN_TUTORIAL_LESSONS.map((lesson) => lesson.id), ['drive', 'boost', 'drift', 'read'],
    'BOOST is taught before DRIFT, and READ THE ROAD comes last');

  run(1);
  assert.equal(views.at(-1).id, 'drive');
  assert.ok(state.sessionSpeedCap < 70 && state.sessionSpeedCap >= TURN_TUTORIAL_LESSONS[0].speedCap * 88, 'The car eases down while DRIVE waits');
  run(2, { gas: true });
  assert.equal(coach.outcome().drive, 'done', 'Holding GAS completes DRIVE');
  assert.equal(state.sessionSpeedCap, null, 'A finished lesson releases the speed cap');

  run(1, { progress: 0.2, gas: true, boostActive: true, boostCharge: 0.6 });
  assert.equal(coach.outcome().boost, 'pending', 'BOOST waits until the meter is spent');
  assert.equal(state.sessionSpeedCap, null, 'BOOST is never capped: it must be felt');
  run(0.5, { boostCharge: 0.1 });
  assert.equal(coach.outcome().boost, 'done', 'Emptying the meter completes BOOST');

  run(1, { progress: 0.4, boostActive: false });
  assert.equal(views.at(-1).kind, 'idle', 'No prompt between lessons');

  run(0.5, { progress: 0.5 });
  assert.equal(views.at(-1).id, 'drift');
  assert.ok(state.sessionSpeedCap > 0, 'The car eases down for the DRIFT bend');
  run(1, { progress: 0.59 });
  assert.equal(coach.outcome().drift, 'pending', 'A late DRIFT still counts: the prompt stays');
  assert.equal(state.sessionSpeedCap, null, 'No cap outside the lesson stretch');
  coach.graduate();
  assert.equal(coach.outcome().drift, 'missed', 'Crossing the line ends the teaching lap regardless');
  assert.equal(views.at(-1).kind, 'graduated');
  run(1, { progress: 0.05 });
  assert.equal(views.at(-1).kind, 'graduated', 'After the line the coach stays out of ordinary racing');
});

test('READ THE ROAD is done when the pace note for the next bend plays', () => {
  const state = { sessionSpeedCap: null };
  const views = [];
  let input = { progress: 0.62, speed: 50, gas: true, drift: false, boostActive: false, boostCharge: 0.5, routeCues: true, paceNotes: 6 };
  const coach = createTurnTutorialCoach({ state, maxSpeed: 88, signals: () => input, present: (view) => views.push(view) });
  const run = (seconds, change = {}) => {
    input = { ...input, ...change };
    for (let t = 0; t < seconds; t += 0.1) coach.update(0.1);
  };
  run(1);
  assert.equal(views.at(-1).id, 'read');
  assert.match(views.at(-1).prompt, /chime/i, 'The prompt says what to listen for, before the cue plays');
  assert.equal(coach.outcome().read, 'pending', 'Cues heard before the lesson do not count');
  assert.ok(state.sessionSpeedCap > 0, 'The car eases down so the cue is clear');
  run(0.2, { progress: 0.7, paceNotes: 7 });
  assert.equal(coach.outcome().read, 'done', 'The cue playing completes the lesson: no recognition test');
  assert.equal(views.at(-1).kind, 'done');
  assert.match(views.at(-1).text, /bend ahead/, 'The text says what the cue meant, as it plays');
  assert.equal(state.sessionSpeedCap, null);
  run(2, { progress: 0.75 });
  assert.equal(views.at(-1).kind, 'done', 'The meaning stays up long enough to read or hear');
  run(3, { progress: 0.85 });
  assert.equal(views.at(-1).kind, 'idle');

  const quiet = [];
  const quietState = { sessionSpeedCap: null };
  input = { ...input, progress: 0.55, drift: false, routeCues: false };
  const withoutCues = createTurnTutorialCoach({ state: quietState, maxSpeed: 88, signals: () => input, present: (view) => quiet.push(view) });
  withoutCues.update(0.1);
  assert.equal(quiet.at(-1).id, 'drift');
  input = { ...input, progress: 0.65 };
  withoutCues.update(0.1);
  assert.equal(withoutCues.outcome().read, 'skipped', 'With DRIVE BY EAR off there is nothing to hear: no prompt to listen');
  assert.equal(quiet.at(-1).kind, 'idle', 'The missed DRIFT prompt does not linger');
  assert.equal(quietState.sessionSpeedCap, null);

  // Sound or DRIVE BY EAR turned off in SETTINGS while READ THE ROAD waits.
  const switched = [];
  const switchedState = { sessionSpeedCap: null };
  input = { ...input, progress: 0.65, routeCues: true, paceNotes: 9 };
  const midLesson = createTurnTutorialCoach({ state: switchedState, maxSpeed: 88, signals: () => input, present: (view) => switched.push(view) });
  midLesson.update(0.1);
  assert.equal(switched.at(-1).id, 'read');
  assert.ok(switchedState.sessionSpeedCap > 0);
  input = { ...input, routeCues: false };
  midLesson.update(0.1);
  assert.equal(midLesson.outcome().read, 'skipped', 'Cues turned off mid-lesson end the lesson');
  assert.equal(switched.at(-1).kind, 'idle', 'The listening prompt goes away');
  assert.equal(switchedState.sessionSpeedCap, null, 'and so does its speed cap');
});

test('pace notes count as available only when they can actually play', () => {
  const saved = Object.fromEntries(['__turnSwooshPaceNotes', '__turnRouteAudio', '__turnDriveByEarEnabled', '__turnAudioPreferences']
    .map((key) => [key, globalThis[key]]));
  try {
    globalThis.__turnSwooshPaceNotes = { counts: { fired: 4 } };
    globalThis.__turnDriveByEarEnabled = true;
    globalThis.__turnAudioPreferences = { getSettings: () => ({ audioEnabled: true, dbeEnabled: true }) };
    globalThis.__turnRouteAudio = { ready: true, destination: {} };
    assert.deepEqual([readTutorialSignals({}).routeCues, readTutorialSignals({}).paceNotes], [true, 4]);
    globalThis.__turnRouteAudio = { ready: false, destination: null };
    assert.equal(readTutorialSignals({}).routeCues, false, 'No ready route channel (no Web Audio, or a suspended context): no cue can play');
    globalThis.__turnRouteAudio = { ready: true, destination: {} };
    globalThis.__turnAudioPreferences = { getSettings: () => ({ audioEnabled: true, dbeEnabled: false }) };
    assert.equal(readTutorialSignals({}).routeCues, false, 'DRIVE BY EAR off');
    globalThis.__turnAudioPreferences = { getSettings: () => ({ audioEnabled: false, dbeEnabled: true }) };
    assert.equal(readTutorialSignals({}).routeCues, false, 'Sound off');
  } finally {
    Object.assign(globalThis, saved);
  }
});

test('a drifted bend completes DRIFT and the physics honour the lesson cap', async () => {
  const state = { sessionSpeedCap: null };
  let input = { progress: 0.5, speed: 40, gas: true, drift: true, boostActive: false, boostCharge: 0.4 };
  const coach = createTurnTutorialCoach({ state, maxSpeed: 88, signals: () => input });
  for (let t = 0; t < 2; t += 0.1) coach.update(0.1);
  assert.equal(coach.outcome().drift, 'done');
  const physics = await import('node:fs').then((fs) => fs.readFileSync(new URL('../turn/vehicle/physics.js', import.meta.url), 'utf8'));
  assert.match(physics, /Math\.min\(speedLimit, sessionSpeedCap\)/, 'The lesson cap limits the vehicle speed');
});

test('Tutorial steering help aims at the road ahead and the player still steers', async () => {
  const help = await import('../turn/tutorial/steering-help.js');
  const { updateMotionInputState } = await import('../turn/input/motion.js');
  // A straight road heading +z (heading 0); samples 2 m apart.
  const samples = Array.from({ length: 60 }, (_, i) => ({ point: { x: 0, z: i * 2 } }));
  const car = (x, heading, speed = 20) => ({
    nearestTrackIndex: 5, position: { x, z: 10 }, heading,
    velocity: { x: Math.sin(heading) * speed, z: Math.cos(heading) * speed }
  });
  const target = (state) => help.steeringHelpTarget({ state, samples });
  assert.ok(Math.abs(target(car(0, 0))) < 1e-9, 'On the line and pointing along it: no correction');
  // Positive steering raises the heading (vehicle/physics.js), turning towards +x.
  assert.ok(target(car(-4, 0)) > 0 && target(car(4, 0)) < 0, 'Off to one side, it aims back at the road');
  assert.ok(target(car(0, -0.3)) > 0 && target(car(0, 0.3)) < 0, 'Pointing away, it turns back');
  assert.ok(Math.abs(target(car(0, Math.PI / 2))) === 1, 'Never past full lock');
  assert.equal(target(car(0, 0, -5)), null, 'Not while reversing');
  assert.equal(help.steeringHelpTarget({ state: car(0, 0), samples: [] }), null);

  // input/motion.js blends it in: the player's own steering still counts, at half strength.
  const steer = (manualSteering, sessionSteeringTarget) => {
    const state = { sensorMode: false, steering: 0, manualSteering, sessionSteeringTarget };
    for (let i = 0; i < 60; i += 1) updateMotionInputState({ state, dt: 1 / 60, maxSteerRoll: 0.4 });
    return state.steering;
  };
  assert.ok(Math.abs(steer(1, null) + 1) < 1e-3, 'Help off: steering is the player\'s alone');
  assert.ok(Math.abs(steer(0, 0.6) - 0.6) < 1e-3, 'Help on, hands off: TURN steers');
  assert.ok(Math.abs(steer(1, 0.6) - 0.1) < 1e-3, 'Help on: the player still moves the car');
  assert.ok(Math.abs(steer(-1, 0.9) - 1) < 1e-3, 'Clamped to full lock');
});

test('Tutorial steering help is a saved SETTINGS choice that works mid-lap', async () => {
  const help = await import('../turn/tutorial/steering-help.js');
  memory.delete(help.STEERING_HELP_STORAGE_KEY);
  assert.equal(help.loadSteeringHelp(), false, 'Off unless chosen');
  let heard = null;
  const listener = (event) => { heard = event.detail.enabled; };
  globalThis.addEventListener(help.STEERING_HELP_CHANGED_EVENT, listener);
  assert.equal(help.saveSteeringHelp(true), true);
  assert.equal(heard, true, 'A running tutorial hears the change at once: no restart');
  assert.equal(help.loadSteeringHelp(), true);
  help.saveSteeringHelp(false);
  assert.equal(heard, false);
  globalThis.removeEventListener(help.STEERING_HELP_CHANGED_EVENT, listener);
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  help.saveSteeringHelp(true, broken, null);
  assert.equal(help.loadSteeringHelp(broken), true, 'Without storage the choice holds for this visit');
  help.saveSteeringHelp(false, broken, null);

  const read = (path) => import('node:fs').then((fs) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  const home = await read('../turn/m8-home.js');
  assert.match(home, /<legend>Steering<\/legend>[\s\S]*id="m8SteeringHelp"[\s\S]*<strong>Tutorial steering help<\/strong>[\s\S]*<\/fieldset>/,
    'SETTINGS has it with the other steering choices (also opened from PAUSED)');
  const prompt = await read('../turn/tutorial/tutorial-prompt.js');
  assert.match(prompt, /if \(!graduated && dt > 0\) \{[\s\S]*state\.sessionSteeringTarget = steeringHelp \? steeringHelpTarget/,
    'It only steers the teaching lap');
  assert.match(prompt, /function onGraduated\(\) \{\s*graduated = true;\s*state\.sessionSteeringTarget = null;/, 'It ends at the line');
  assert.match(prompt, /stopped = true;\s*cancelAnimationFrame\(frame\);\s*state\.sessionSteeringTarget = null;/,
    'And whenever the run stops (leave, Home, GARAGE)');
  const lessons = await import('../turn/tutorial/turn-tutorial-lessons.js');
  assert.match(lessons.TURN_TUTORIAL_LESSONS.find((lesson) => lesson.id === 'drive').assistedPrompt, /Steering help is on/,
    'The DRIVE lesson says when TURN is steering');
  assert.match(lessons.TUTORIAL_GRADUATION_WITH_HELP_MESSAGE, /Steering help ends here/,
    'Help never passes for the player\'s own steering');
  assert.match(lessons.STEERING_HELP_HINT.text, /PAUSED|Pause/, 'Repeated rescues point to it, reachable mid-lap');
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
