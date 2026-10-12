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

test('the coach teaches DRIVE, DRIFT and BOOST by doing, with no failure state', () => {
  const state = { sessionSpeedCap: null };
  const views = [];
  let input = { progress: 0.02, speed: 70, gas: false, drift: false, boostActive: false, boostCharge: 1, routeCues: true, paceNotes: 0 };
  const coach = createTurnTutorialCoach({ state, maxSpeed: 88, signals: () => input, present: (view) => views.push(view) });
  const run = (seconds, change = {}) => {
    input = { ...input, ...change };
    for (let t = 0; t < seconds; t += 0.1) coach.update(0.1);
  };
  // #1166: DRIFT where COUNTRYSIDE's long curve begins (24% of the lap), BOOST after it.
  assert.deepEqual(TURN_TUTORIAL_LESSONS.map((lesson) => lesson.id), ['drive', 'drift', 'boost', 'read'],
    'DRIFT is taught before BOOST, and READ THE ROAD comes last');
  const zone = (id) => TURN_TUTORIAL_LESSONS.find((lesson) => lesson.id === id);
  assert.ok(zone('drift').from < 0.24 && zone('drift').to > 0.24, 'DRIFT is said on the straight and runs into the long curve');
  assert.ok(zone('boost').speedCap > zone('drift').speedCap && zone('boost').speedCap < 1,
    'BOOST is felt from the DRIFT speed but capped in the curve');

  run(1);
  assert.equal(views.at(-1).id, 'drive');
  assert.ok(state.sessionSpeedCap < 70 && state.sessionSpeedCap >= TURN_TUTORIAL_LESSONS[0].speedCap * 88, 'The car eases down while DRIVE waits');
  run(2, { gas: true });
  assert.equal(coach.outcome().drive, 'done', 'Holding GAS completes DRIVE');
  assert.equal(state.sessionSpeedCap, null, 'A finished lesson releases the speed cap');

  run(1, { progress: 0.15, gas: true });
  assert.equal(views.at(-1).kind, 'idle', 'No prompt between lessons');

  run(0.5, { progress: 0.2 });
  assert.equal(views.at(-1).id, 'drift');
  assert.ok(state.sessionSpeedCap > 0, 'The car eases down for the DRIFT bend');
  run(1, { progress: 0.39 });
  assert.equal(coach.outcome().drift, 'pending', 'A late DRIFT still counts: the prompt stays');
  run(0.5, { progress: 0.41 });
  assert.equal(state.sessionSpeedCap, null, 'No cap outside the lesson stretch');

  run(1, { progress: 0.45, gas: true, boostActive: true, boostCharge: 0.6 });
  assert.equal(views.at(-1).id, 'boost');
  assert.equal(coach.outcome().drift, 'missed', 'BOOST\'s stretch begins: the waiting DRIFT gives way');
  assert.equal(coach.outcome().boost, 'pending', 'BOOST waits until the meter is spent');
  assert.ok(state.sessionSpeedCap >= zone('boost').speedCap * 88 - 1e-9, 'BOOST is capped, but above DRIFT speed');
  run(0.5, { boostCharge: 0.1 });
  assert.equal(coach.outcome().boost, 'done', 'Emptying the meter completes BOOST');
  coach.graduate();
  assert.equal(views.at(-1).kind, 'graduated');
  run(1, { progress: 0.05 });
  assert.equal(views.at(-1).kind, 'graduated', 'After the line the coach stays out of ordinary racing');
});

test('each new tutorial line slows the car while it is read, once, and BOOST ends it', async () => {
  const { createReadingPace, readingSeconds, READING_SPEED_SHARE } = await import('../turn/tutorial/tutorial-prompt.js');
  assert.equal(readingSeconds('Press BOOST and watch the meter empty.'), 1 + 7 * 0.3);
  assert.equal(readingSeconds('word '.repeat(40)), 5, 'Never more than 5 s');
  const state = { sessionSpeedCap: null, speed: 20, vehicleEffectiveMaxSpeed: 74 };
  const pace = createReadingPace();
  const frame = (dt = 0.1) => pace.update({ state, dt, maxSpeed: 88 });
  const line = 'Hold DRIFT through the bend and slide outward into LOCK.';
  pace.read(`lesson:drift:${line}`, line);
  frame();
  assert.ok(pace.reading && state.sessionSpeedCap < 20 && state.sessionSpeedCap >= READING_SPEED_SHARE * 74,
    'Eased down from the current speed, never below the reading speed');
  for (let t = 0; t < 1; t += 0.1) frame();
  assert.ok(Math.abs(state.sessionSpeedCap - READING_SPEED_SHARE * 74) < 1e-9, 'At the reading speed while it is read');
  for (let t = 0; t < 4; t += 0.1) frame();
  assert.equal(pace.reading, false);
  assert.equal(state.sessionSpeedCap, null, 'Then the cap the lesson had (none) is back');

  // Under a lesson cap the coach rewrites each frame: the lower of the two applies,
  // and the lesson's comes back after.
  pace.read('lesson:boost:Press BOOST.', 'Press BOOST.');
  state.sessionSpeedCap = 0.6 * 88;
  frame();
  assert.ok(state.sessionSpeedCap < 0.6 * 88);
  pace.read('lesson:boost:Press BOOST.', 'Press BOOST.');
  globalThis.__turnBoostActive = true;
  state.sessionSpeedCap = 0.6 * 88;
  frame();
  delete globalThis.__turnBoostActive;
  assert.equal(pace.reading, false, 'BOOST ends it: the player has chosen to go');
  assert.equal(state.sessionSpeedCap, 0.6 * 88, 'The lesson cap is untouched');
  pace.read('lesson:boost:Press BOOST.', 'Press BOOST.');
  assert.equal(pace.reading, false, 'A line already read does not slow the car again');

  // A line still to be said, or being said, keeps the car slow until it has been heard.
  let speaking = true;
  const heard = createReadingPace({ speaking: () => speaking });
  const heardState = { sessionSpeedCap: null, speed: 20, vehicleEffectiveMaxSpeed: 74 };
  heard.read('lesson:drive:Hold GAS.', 'Hold GAS.');
  for (let t = 0; t < 4; t += 0.1) heard.update({ state: heardState, dt: 0.1, maxSpeed: 88 });
  assert.equal(heard.reading, true, 'Past its reading time, still slow while it is to be heard');
  speaking = false;
  heard.update({ state: heardState, dt: 0.1, maxSpeed: 88 });
  assert.equal(heard.reading, false);
  assert.equal(heardState.sessionSpeedCap, null);

  const read = (path) => import('node:fs').then((fs) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  for (const path of ['../turn/tutorial/tutorial-prompt.js', '../turn/tutorial/drift-attack-coach.js', '../turn/tutorial/flow-tutorial.js']) {
    assert.match(await read(path), /prompt\.pace\(\{ state, dt, maxSpeed: runtime\.maxSpeed \}\);/, `${path} paces its lines`);
  }
  assert.match(await read('../turn/tutorial/tutorial-prompt.js'), /if \(view\.kind === 'graduated'\) reading\.end\(\);/,
    'After the line, ordinary racing is never slowed');
  assert.match(await read('../turn/tutorial/tutorial-prompt.js'),
    /createReadingPace\(\{ speaking: \(\) => unsaid !== '' \|\| performance\.now\(\) < saidUntil \}\)/,
    'The prompt paces by its voice as well as its text');
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
  assert.equal(quiet.at(-1).id, 'boost');
  input = { ...input, progress: 0.65 };
  withoutCues.update(0.1);
  assert.equal(withoutCues.outcome().read, 'skipped', 'With DRIVE BY EAR off there is nothing to hear: no prompt to listen');
  assert.equal(quiet.at(-1).kind, 'idle', 'The missed BOOST prompt does not linger');
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
  let input = { progress: 0.3, speed: 40, gas: true, drift: true, boostActive: false, boostCharge: 0.4 };
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

test('DRIFT ATTACK TUTORIAL teaches scoring, then LINK, BUILD, CATCH, HOLD and SPEND in order', async () => {
  const { createDriftAttackCoach } = await import('../turn/tutorial/drift-attack-coach.js');
  const lessons = await import('../turn/tutorial/drift-attack-lessons.js');
  const state = { sessionSpeedCap: null };
  let input = { speed: 60, overcharge: 0, caught: false, boosting: false, banks: 0, links: 0 };
  const views = [];
  const coach = createDriftAttackCoach({ state, maxSpeed: 88, signals: () => input, present: (view) => views.push(view) });
  const run = (seconds) => { for (let t = 0; t < seconds; t += 0.1) coach.update(0.1); };

  run(0.1);
  assert.equal(coach.lesson, 'score');
  assert.equal(views.at(-1).title, 'DRIFT SCORING');
  assert.match(views.at(-1).prompt, /LOCK/, 'LOCK first: it may be what starts the slide');
  assert.doesNotMatch(views.at(-1).keyboardPrompt, /LOCK/, 'LOCK has no key');
  run(1);
  assert.ok(state.sessionSpeedCap < 60 && state.sessionSpeedCap >= 0.45 * 88, 'Eased toward the lesson cap, not braked');
  input = { ...input, banks: 1 };
  run(0.1);
  assert.equal(views.at(-1).kind, 'done', 'A banked slide is the lesson');
  assert.equal(state.sessionSpeedCap, null);
  run(3.2);
  assert.equal(coach.lesson, 'link', 'Linking drifts comes before OVERCHARGE');
  input = { ...input, banks: 2 };
  run(0.1);
  assert.equal(coach.lesson, 'link', 'Another bank alone is not a link');
  input = { ...input, links: 1 };
  run(0.1);
  assert.equal(views.at(-1).kind, 'done');
  run(3.2);
  assert.equal(coach.lesson, 'build');
  input = { ...input, overcharge: 0.35 };
  run(0.1);
  assert.equal(coach.lesson, 'catch', 'CATCH comes straight after BUILD: OVERCHARGE leaks');
  assert.equal(state.sessionSpeedCap, null, 'No cap while it leaks');

  // It leaked away before the catch: back to BUILD, never a failure.
  input = { ...input, overcharge: 0 };
  run(0.1);
  assert.equal(coach.lesson, 'build');
  assert.equal(views.at(-1).prompt, lessons.DRIFT_ATTACK_RETRY_PROMPT);
  input = { ...input, overcharge: 0.4 };
  run(0.1);
  input = { ...input, caught: true };
  run(0.1);
  assert.equal(coach.lesson, 'hold');
  run(1.6);
  assert.equal(coach.lesson, 'spend');
  input = { ...input, caught: false, boosting: true, overcharge: 0.25 };
  run(0.1);
  assert.equal(views.at(-1).kind, 'done');
  assert.match(views.at(-1).text, /OVERCHARGE/);
  assert.deepEqual(Object.values(coach.outcome()), ['done', 'done', 'done', 'done', 'done', 'done']);
  // The cap is a share of the car's own top speed: the LEARNER CAR tops out below 88.
  const learner = { sessionSpeedCap: null, vehicleEffectiveMaxSpeed: 73.92 };
  const capped = createDriftAttackCoach({ state: learner, maxSpeed: 88, signals: () => ({ ...input, speed: 20, banks: 0, links: 0 }) });
  capped.update(0.1);
  capped.update(0.1);
  assert.ok(Math.abs(learner.sessionSpeedCap - 0.45 * 73.92) < 1e-9, '45 % of this car, not of the base limit');
  coach.graduate();
  assert.equal(views.at(-1).message, lessons.DRIFT_ATTACK_GRADUATION_MESSAGE);

  for (const lesson of lessons.DRIFT_ATTACK_LESSONS.filter(({ id }) => !['score', 'link'].includes(id))) {
    assert.match(lesson.prompt, /OVERCHARGE/, `${lesson.title} names OVERCHARGE: on the meter it is only purple`);
  }
});

test('DRIFT ATTACK TUTORIAL has no failure state: an early BOOST or the line ends it kindly', async () => {
  const { createDriftAttackCoach } = await import('../turn/tutorial/drift-attack-coach.js');
  const lessons = await import('../turn/tutorial/drift-attack-lessons.js');
  const state = { sessionSpeedCap: null };
  let input = { speed: 30, overcharge: 0, caught: false, boosting: false, banks: 0, links: 0 };
  const views = [];
  const coach = createDriftAttackCoach({ state, maxSpeed: 88, signals: () => input, present: (view) => views.push(view) });
  coach.update(0.1);
  input = { ...input, banks: 1 };
  coach.update(0.1);
  for (let t = 0; t < 3.2; t += 0.1) coach.update(0.1);
  input = { ...input, links: 1 };
  coach.update(0.1);
  for (let t = 0; t < 3.2; t += 0.1) coach.update(0.1);
  input = { ...input, overcharge: 0.5 };
  coach.update(0.1);
  assert.equal(coach.lesson, 'catch');
  // Straight to BOOST, skipping CATCH and HOLD: that is OVERCHARGE spent.
  input = { ...input, boosting: true, overcharge: 0.3 };
  coach.update(0.1);
  assert.equal(coach.outcome().spend, 'done');

  const missed = createDriftAttackCoach({ state, maxSpeed: 88, signals: () => ({ ...input, banks: 0, links: 0 }), present: (view) => views.push(view) });
  missed.update(0.1);
  missed.graduate();
  assert.equal(views.at(-1).message, lessons.DRIFT_ATTACK_PRACTICE_MESSAGE, 'The line ends the lesson either way');
  assert.equal(missed.outcome().score, 'missed');
  assert.equal(state.sessionSpeedCap, null);
});

test('DRIFT ATTACK TUTORIAL is its own module, offered in HOW TO PLAY once DRIFT ATTACK unlocks', async () => {
  const { DRIFT_ATTACK_TUTORIAL } = await import('../turn/tutorial/tutorial-progress.js');
  assert.equal(DRIFT_ATTACK_TUTORIAL.id, 'drift-attack');
  memory.delete(TUTORIAL_STORAGE_KEY);
  const progress = createTutorialProgress({ hasPlayed: () => true });
  assert.equal(progress.status(DRIFT_ATTACK_TUTORIAL.id), TUTORIAL_STATUS.NOT_STARTED,
    'Only TURN TUTORIAL is skipped for players who played before');
  const read = (path) => import('node:fs').then((fs) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  const home = await read('../turn/m8-home.js');
  assert.match(home, /\[DRIFT_ATTACK_TUTORIAL\.id, \{ name: 'DRIFT ATTACK TUTORIAL'[^\n]*coach: startDriftAttackCoach \}\]/);
  assert.match(home, /if \(driftAttackSession\.active\) await driftAttackSession\.exit\(\);/, 'Leaving restores the player\'s own track and car');
  assert.match(home, /isUnlocked: \(\) => isFeatureUnlocked\('drift-attack'\)/);
  const entry = await read('../turn/tutorial/tutorial-entry.js');
  assert.match(entry, /\.m8-drift-attack-entry\[hidden\] \{ display: none; \}/, 'Hidden until DRIFT ATTACK unlocks');
});

test('unlock introductions queue new DRIFT ATTACK, SHIFT and FLOW unlocks once', async () => {
  const intro = await import('../turn/progression/unlock-introductions.js');
  memory.delete(intro.UNLOCK_INTRODUCTIONS_KEY);
  const queue = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(queue.unlocked(['compact', 'medium-tracks']), false, 'Only DRIFT ATTACK, SHIFT and FLOW are introduced');
  assert.equal(queue.unlocked(['shift', 'flow']), true);
  assert.equal(queue.next(), 'shift', 'One at a time, in unlock order');
  queue.introduced('shift');
  assert.equal(queue.hasHint('garage-shift'), true, 'SHIFT points GARAGE at ACTIVATE SHIFT next time');
  assert.equal(queue.unlocked(['shift']), false, 'Never introduced twice');
  const reloaded = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(reloaded.next(), 'flow', 'Waiting introductions survive closing TURN');
  reloaded.consumeHint('garage-shift');
  assert.equal(reloaded.hasHint('garage-shift'), false);
  assert.equal(reloaded.unlocked(['shift'], { replay: true }), true, 'Admin UNLOCK replays one');
  assert.equal(intro.UNLOCK_INTRODUCTIONS['drift-attack'].action.label, 'START DRIFT ATTACK TUTORIAL');
  assert.match(intro.UNLOCK_INTRODUCTIONS['drift-attack'].copy.join(' '), /OVERCHARGE/);
  assert.equal(intro.introducesOnUnlock({ location: { hostname: 'enkel.design' }, navigator: {} }), true,
    'Players see them as soon as they are back on Home');
  assert.equal(intro.introducesOnUnlock({ location: { hostname: 'localhost' }, navigator: {} }, { getItem: () => null }), false,
    'Test suites earning rewards are not interrupted');
});

test('after the SHIFT introduction, the drive pad\'s SHIFT is pointed out in the next races', async () => {
  const intro = await import('../turn/progression/unlock-introductions.js');
  const callout = await import('../turn/ui/shift-race-callout.js');
  memory.delete(intro.UNLOCK_INTRODUCTIONS_KEY);
  const queue = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  queue.unlocked(['shift']);
  queue.introduced('shift');
  assert.equal(queue.hasHint(callout.RACE_SHIFT_HINT), true, 'Armed with the GARAGE hint when the sheet closes');
  assert.match(callout.SHIFT_CALLOUT_TEXT, /Hold GAS, then slide outward into SHIFT/, 'In the drive pad\'s own words');
  for (let race = 1; race < callout.RACE_SHIFT_HINT_RACES; race += 1) queue.viewHint(callout.RACE_SHIFT_HINT, callout.RACE_SHIFT_HINT_RACES);
  const reloaded = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(reloaded.hasHint(callout.RACE_SHIFT_HINT), true, 'Showings are counted across visits');
  reloaded.viewHint(callout.RACE_SHIFT_HINT, callout.RACE_SHIFT_HINT_RACES);
  assert.equal(reloaded.hasHint(callout.RACE_SHIFT_HINT), false, 'A player who never shifts is not reminded forever');
  assert.equal(reloaded.unlocked(['shift'], { replay: true }), true);
  reloaded.introduced('shift');
  assert.equal(reloaded.hasHint(callout.RACE_SHIFT_HINT), true, 'Admin UNLOCK SHIFT arms it again');
  assert.deepEqual(reloaded.snapshot().views, {}, 'With its count started over');
  // Introduced in r426/r427, before the race hint: armed once, then never again.
  memory.set(intro.UNLOCK_INTRODUCTIONS_KEY, JSON.stringify({ pending: [], shown: ['shift'], hints: [] }));
  const upgraded = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(upgraded.hasHint(callout.RACE_SHIFT_HINT), true, 'Players introduced to SHIFT before r428 get the race hint');
  upgraded.consumeHint(callout.RACE_SHIFT_HINT);
  assert.equal(intro.createUnlockIntroductionQueue(globalThis.localStorage).hasHint(callout.RACE_SHIFT_HINT), false,
    'Once used, the backfill does not bring it back');
});

test('FLOW TUTORIAL: DRIFT and EXIT, then a COMBO of three, judged on FLOW\'s own events', async () => {
  const flow = await import('../turn/tutorial/flow-tutorial.js');
  const { FLOW_TUTORIAL } = await import('../turn/tutorial/tutorial-progress.js');
  assert.deepEqual([FLOW_TUTORIAL.id, FLOW_TUTORIAL.trackId], ['flow', 'cliffside']);
  const state = { sessionSpeedCap: null, vehicleEffectiveMaxSpeed: 80 };
  const views = [];
  const coach = flow.createFlowCoach({ state, maxSpeed: 88, present: (view) => views.push(view) });
  coach.update(0.1, 30);
  assert.equal(coach.lesson, 'slide');
  assert.ok(state.sessionSpeedCap >= 0.45 * 80, 'A slower first bend, from the car\'s own top speed');
  coach.technique({ technique: 'drift', multiplier: 1 });
  assert.equal(coach.lesson, 'combo', 'Straight on: the chain is already running');
  assert.equal(state.sessionSpeedCap, null);
  coach.chainEnded();
  assert.equal(views.at(-1).prompt, flow.FLOW_CHAIN_ENDED_PROMPT, 'A chain that runs out is said, not failed');
  coach.technique({ technique: 'drift', multiplier: 1 });
  coach.technique({ technique: 'boost', multiplier: 1.5 });
  assert.equal(coach.lesson, 'combo', 'Two techniques are not yet COMBO ×2');
  coach.technique({ technique: 'clean-exit', multiplier: 2 });
  assert.equal(coach.lesson, 'combo', 'COMBO ×2, but not ending on the BOOST the lesson asks for');
  coach.technique({ technique: 'boost', multiplier: 2.25 });
  assert.equal(views.at(-1).kind, 'done');
  // One slide with LOCK scores LOCK, DRIFT and EXIT, ×2 already: the lesson still waits for BOOST.
  const locked = flow.createFlowCoach({ state, maxSpeed: 88 });
  locked.update(0.1, 0);
  for (const [technique, multiplier] of [['lock', 1], ['drift', 1.5], ['clean-exit', 2]]) locked.technique({ technique, multiplier });
  assert.equal(locked.lesson, 'combo');
  locked.technique({ technique: 'boost', multiplier: 2.5 });
  assert.equal(locked.outcome().combo, 'done');
  coach.graduate();
  assert.equal(views.at(-1).message, flow.FLOW_GRADUATION_MESSAGE);

  const missed = flow.createFlowCoach({ state, maxSpeed: 88 });
  missed.update(0.1, 0);
  missed.graduate();
  assert.equal(missed.outcome().combo, 'missed');
  assert.equal(state.sessionSpeedCap, null);
  const read = (path) => import('node:fs').then((fs) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  const home = await read('../turn/m8-home.js');
  assert.match(home, /\[FLOW_TUTORIAL\.id, \{ name: 'FLOW TUTORIAL'[^\n]*coach: startFlowCoach \}\]/);
  assert.match(home, /isUnlocked: \(\) => isFeatureUnlocked\('flow'\)/);
  const intro = await import('../turn/progression/unlock-introductions.js');
  assert.equal(intro.UNLOCK_INTRODUCTIONS.flow.action.label, 'START FLOW TUTORIAL');
});

test('FLOW pulses: each technique FLOW scores pulses the control that earned it (#1171)', async () => {
  const { FLOW_PULSE_CLASS, FLOW_PULSE_TARGETS, startFlowPulses } = await import('../turn/ui/flow-pulses.js');
  const made = new Map();
  const control = () => {
    const classes = new Set();
    return {
      isConnected: true,
      offsetWidth: 1,
      classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name), contains: (name) => classes.has(name) }
    };
  };
  const documentRef = {
    head: { appendChild() {} },
    getElementById: () => null,
    createElement: () => ({}),
    querySelector(selector) {
      const key = selector.replace('.drive-stack ', '');
      if (!made.has(key)) made.set(key, control());
      return made.get(key);
    }
  };
  const bus = new globalThis.EventTarget();
  const send = (detail) => bus.dispatchEvent(new globalThis.CustomEvent('turn:flow-score-event', { detail }));
  const pulsing = (selector) => made.get(selector)?.classList.contains(FLOW_PULSE_CLASS) === true;
  const stop = startFlowPulses({ events: bus, documentRef });
  send({ type: 'technique', technique: 'lock' });
  assert.equal(pulsing('.drive-lock-bubble'), true, 'LOCK during a drift pulses LOCK');
  send({ type: 'technique', technique: 'overcharge-catch' });
  assert.equal(pulsing('.drive-gas-zone'), true, 'A caught OVERCHARGE pulses GAS');
  send({ type: 'chain-expired' });
  assert.equal(made.size, 2, 'Only scored techniques pulse');
  // A pause clears what is showing at once (turn/AGENTS.md: nothing runs on through it).
  bus.dispatchEvent(new globalThis.CustomEvent('turn:ui-state-change', { detail: { reason: 'race-paused', running: true, paused: true } }));
  assert.equal(pulsing('.drive-lock-bubble') || pulsing('.drive-gas-zone'), false, 'A pause clears the pulses');
  send({ type: 'technique', technique: 'lock' });
  stop();
  assert.equal(pulsing('.drive-lock-bubble') || pulsing('.drive-gas-zone'), false, 'Stopping clears what is showing');
  send({ type: 'technique', technique: 'boost' });
  assert.equal(made.has('.drive-boost-zone'), false, 'Stopped: nothing more pulses');
  // Every technique FLOW scores, by FLOW's own names, has its control.
  const read = (path) => import('node:fs').then((fs) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  const runtime = await read('../turn/scoring/flow-runtime.js');
  const scored = [...runtime.matchAll(/accept\('([a-z-]+)'/g)].map(([, technique]) => technique).sort();
  assert.deepEqual(Object.keys(FLOW_PULSE_TARGETS).sort(), scored);
  const tutorial = await read('../turn/tutorial/flow-tutorial.js');
  assert.match(tutorial, /const stopPulses = startFlowPulses\(\{ events \}\);/, 'FLOW TUTORIAL starts them');
  assert.match(tutorial, /stopPulses\(\);\n    coach\.stop\(\);/, 'and stops them with the coach');
});

test('PAINTJOB is pointed out in GARAGE without a sheet: its reward toast says it', async () => {
  const intro = await import('../turn/progression/unlock-introductions.js');
  assert.equal(intro.UNLOCK_INTRODUCTIONS.paintjob, undefined, 'No introduction sheet');
  assert.equal(intro.UNLOCK_HINTS.paintjob.hint, 'garage-paint');
  memory.delete(intro.UNLOCK_INTRODUCTIONS_KEY);
  const queue = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(queue.unlocked(['paintjob']), false, 'Nothing waits on Home for it');
  queue.armHint('garage-paint');
  assert.equal(intro.createUnlockIntroductionQueue(globalThis.localStorage).hasHint('garage-paint'), true,
    'Armed until GARAGE next shows PAINT');
  const source = await import('node:fs').then((fs) => fs.readFileSync(new URL('../turn/progression/unlock-introductions.js', import.meta.url), 'utf8'));
  assert.match(source, /'garage-paint': Object\.freeze\(\{ selector: '\.garage-paint-toggle', say: 'New in GARAGE: PAINT, below the car’s name\.' \}\)/,
    'Said as well as shown');
  // Watched on Home and in GARAGE only (turn/AGENTS.md): never during a race.
  assert.match(source, /if \(hintObserver \|\| windowRef\.__turnRuntime\?\.state\?\.running === true\) return;/);
  assert.match(source, /if \(event\.detail\?\.running === true\) stopWatchingHints\(\);/);
  assert.match(source, /if \(introducesOnUnlock\(windowRef, storage\)\) armUnlockHints\(event\.detail\?\.unlocked\);/,
    'Not armed in automated runs, as the sheets are not shown');
  assert.match(source, /viewCarWhenGarageOpens\('sedan'\);/, 'TRY SHIFT IN THE SEDAN opens the SEDAN as a challenge opens its car');
});

test('GARAGE points at ALL CARS until it is used, and RACE at ACTIVATE SHIFT once per car', async () => {
  const intro = await import('../turn/progression/unlock-introductions.js');
  memory.delete(intro.UNLOCK_INTRODUCTIONS_KEY);
  const queue = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(queue.armOnce(intro.ALL_CARS_HINT, intro.ALL_CARS_UNTIL_USED), true, 'Armed for every player, including existing ones');
  // #1189: pointed out once, then a calm pulse on every visit until ALL CARS is used.
  assert.equal(queue.pointedOut(intro.ALL_CARS_HINT), false);
  queue.markPointedOut(intro.ALL_CARS_HINT);
  const revisit = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(revisit.hasHint(intro.ALL_CARS_HINT), true, 'Still armed on later visits');
  assert.equal(revisit.pointedOut(intro.ALL_CARS_HINT), true, 'But said and scrolled to only once');
  revisit.consumeHint(intro.ALL_CARS_HINT);
  const later = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(later.armOnce(intro.ALL_CARS_HINT, intro.ALL_CARS_UNTIL_USED), false, 'Once used, never armed again');
  assert.equal(later.hasHint(intro.ALL_CARS_HINT), false);
  // TURN in two tabs (CODEX on #1192): used in one, the other takes that up from the
  // storage event, so its next save does not arm ALL CARS again.
  memory.delete(intro.UNLOCK_INTRODUCTIONS_KEY);
  const tabs = new globalThis.EventTarget();
  const usedHere = intro.createUnlockIntroductionQueue(globalThis.localStorage, { events: new globalThis.EventTarget() });
  usedHere.armOnce(intro.ALL_CARS_HINT, intro.ALL_CARS_UNTIL_USED);
  const otherTab = intro.createUnlockIntroductionQueue(globalThis.localStorage, { events: tabs });
  assert.equal(otherTab.hasHint(intro.ALL_CARS_HINT), true);
  usedHere.consumeHint(intro.ALL_CARS_HINT);
  tabs.dispatchEvent(Object.assign(new globalThis.Event('storage'), { key: 'some-other-key' }));
  assert.equal(otherTab.hasHint(intro.ALL_CARS_HINT), true, 'Only its own key is taken up');
  tabs.dispatchEvent(Object.assign(new globalThis.Event('storage'), { key: intro.UNLOCK_INTRODUCTIONS_KEY }));
  assert.equal(otherTab.hasHint(intro.ALL_CARS_HINT), false, 'The other tab sees it used');
  otherTab.markPointedOut('garage-paint');
  assert.equal(intro.createUnlockIntroductionQueue(globalThis.localStorage).hasHint(intro.ALL_CARS_HINT), false,
    'And its next save keeps it used');
  // A player whose r435 hint ended after one showing is armed once more.
  globalThis.localStorage.setItem(intro.UNLOCK_INTRODUCTIONS_KEY, JSON.stringify({ pending: [], shown: [], hints: [], views: {}, once: ['garage-all-cars'] }));
  const r435 = intro.createUnlockIntroductionQueue(globalThis.localStorage);
  assert.equal(r435.armOnce(intro.ALL_CARS_HINT, intro.ALL_CARS_UNTIL_USED), true);
  assert.equal(r435.hasHint(intro.ALL_CARS_HINT), true);
  const read = (path) => import('node:fs').then((fs) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  const source = await read('../turn/progression/unlock-introductions.js');
  assert.match(source, /if \(introducesOnUnlock\(windowRef, storage\)\) queue\.armOnce\(ALL_CARS_HINT, ALL_CARS_UNTIL_USED\);/, 'Not in automated runs');
  assert.match(source, /untilUsed: '\.garage-all-cars-button, \.garage-car-card'/,
    'Used: the sheet opened on a phone, or a car chosen from ALL CARS, in the sheet or inline on iPad');
  assert.match(source, /if \(untilUsed && queue\.pointedOut\(hint\)\) \{\n\s*suggestInGarage\(target, \{ documentRef \}\);\n\s*continue;\n\s*\}/,
    'The calm pulse on every later visit; the scroll and the line only once');
  assert.match(source, /if \(untilUsed\) \{\n\s*queue\.markPointedOut\(hint\);\n\s*suggestInGarage\(target, \{ documentRef \}\);\n\s*\} else queue\.consumeHint\(hint\);/,
    'And not before that pointing-out: a hint still waiting does not pulse (CODEX on #1192)');
  assert.match(source, /if \(!untilUsed \|\| !queue\.hasHint\(hint\) \|\| !event\.target\?\.closest\?\.\(untilUsed\)\) continue;\n\s*queue\.consumeHint\(hint\);/,
    'Using it ends the pulse for good');
  const focusSource = await read('../turn/garage/garage-focus.js');
  assert.match(focusSource, /#turnGarage \.is-suggested:not\(\.is-introduced\) \{ animation: turn-garage-suggest 2\.4s ease-in-out infinite; \}/);
  assert.match(focusSource, /prefers-reduced-motion: reduce\) \{\s*#turnGarage \.is-introduced,\s*#turnGarage \.is-suggested:not\(\.is-introduced\) \{\s*animation: none;/,
    'Reduced Motion: a steady outline instead');
  assert.match(source, /if \(ownVisit && \(points\.length \|\| pointedGarage === garage \|\| garageOpenedForCar\(garage\)\)\) continue;/,
    'Only on a visit the player opened themselves, with nothing else to point out');
  assert.match(source, /selector: '\.garage-all-cars-button, #garageCatalogTitle'/,
    'On tablets, where ALL CARS is shown inline and its button hidden, the inline heading is pointed out');
  assert.match(source, /const target = \[\.\.\.documentRef\.querySelectorAll\(selector\)\]\.find\(\(element\) => !element\.hidden && element\.offsetParent\);/);

  // Consumed during the speech delay: no stale hint is announced, while other
  // current guidance in the same call still gets its turn.
  const { pointOutInGarage } = await import('../turn/garage/garage-focus.js');
  const delayed = [];
  const statuses = [];
  const section = { append: (status) => statuses.push(status) };
  const target = { isConnected: true, classList: { add() {}, remove() {} }, closest: () => section };
  let current = true;
  pointOutInGarage([
    { element: target, say: 'ALL CARS', isCurrent: () => current },
    { element: target, say: 'Still relevant' }
  ], {
    documentRef: { getElementById: () => ({}), createElement: () => ({ textContent: '', setAttribute() {}, remove() {} }) },
    windowRef: { setTimeout: (fn, ms) => delayed.push({ fn, ms }) }
  });
  assert.equal(statuses[0].textContent, '', 'The hint waits for GARAGE to speak first');
  current = false;
  delayed.find(({ ms }) => ms === 1200).fn();
  assert.equal(statuses[0].textContent, 'Still relevant', 'Used hints are removed from the pending announcement');

  const reminder = await import('../turn/garage/shift-race-reminder.js');
  const trigger = (classes = [], extra = {}) => ({
    isConnected: true, disabled: false, hidden: false, offsetParent: {},
    classList: { contains: (name) => classes.includes(name) }, ...extra
  });
  assert.equal(reminder.shiftNeedsSetup(trigger()), true, 'Unlocked, possible and not set up');
  assert.equal(reminder.shiftNeedsSetup(trigger(['is-active'])), false, 'A car with a SHIFT setup is never reminded');
  assert.equal(reminder.shiftNeedsSetup(trigger(['is-locked'])), false, 'Not before SHIFT unlocks');
  assert.equal(reminder.shiftNeedsSetup(trigger(['is-unavailable'])), false, 'Not for a car that cannot SHIFT');
  assert.equal(reminder.remindShiftBeforeRace('sedan', trigger(), { storage: globalThis.localStorage, windowRef: { location: { hostname: 'localhost' } } }),
    false, 'Not in automated or local runs');
  assert.match(await read('../turn/garage/garage.js'),
    /if \(remindShiftBeforeRace\(state\.choice\.carId, shift\.trigger, \{ documentRef, windowRef \}\)\) return;\n      finish\(\{ \.\.\.state\.choice \}\);/,
    'RACE asks first, after the locked-car check and before racing');
});

test('the DRIFT lesson names LOCK, which is on the drive pad from the first lap', async () => {
  const { TURN_TUTORIAL_LESSONS } = await import('../turn/tutorial/turn-tutorial-lessons.js');
  const drift = TURN_TUTORIAL_LESSONS.find((lesson) => lesson.id === 'drift');
  assert.match(drift.prompt, /LOCK/, 'Taught where DRIFT is');
  const boost = TURN_TUTORIAL_LESSONS.find((lesson) => lesson.id === 'boost');
  assert.match(boost.doneText, /refills BOOST/, 'The BOOST loop is said once BOOST has been spent, where a slide shows it');
  assert.equal(drift.doneText, undefined, 'Not after DRIFT: BOOST starts the lap full, so no refill could be seen');
  assert.doesNotMatch(drift.keyboardPrompt, /LOCK/, 'Keyboard players are not told about a move with no key');
  const prompt = await import('node:fs').then((fs) => fs.readFileSync(new URL('../turn/tutorial/tutorial-prompt.js', import.meta.url), 'utf8'));
  // The shared prompt shows a lesson's keyboardPrompt to players driving by keyboard.
  assert.match(prompt, /text\.textContent = keyboard && view\.keyboardPrompt \? view\.keyboardPrompt : view\.prompt;/);
  assert.match(prompt, /return lesson\?\.keyboardPrompt \? \{ \.\.\.view, keyboardPrompt: lesson\.keyboardPrompt \} : view;/);
  // LOCK is part of the DRIFT zone, so a slide into LOCK still counts as drifting.
  const controls = await import('node:fs').then((fs) => fs.readFileSync(new URL('../turn/ui/gameplay-controls.js', import.meta.url), 'utf8'));
  assert.match(controls, /globalThis\.__turnDriftHeld = nextZone === 'drift';/);
});

test('tutorial guidance waits for the race to finish speaking: one voice at a time', async () => {
  const floor = await import('../turn/ui/speech-floor.js');
  assert.equal(floor.estimatedSpeechMs(''), 0, 'Nothing to say holds nothing');
  assert.equal(floor.estimatedSpeechMs('Race resumed.'), 900 + 2 * 440, 'The estimate race-speech.js has used for the lap result');
  assert.equal(floor.speechFloorWait(), 0, 'Free until something is said or played');
  floor.holdSpeechFloor(400, 'race-speech');
  floor.holdSpeechFloor(100, 'race-speech');
  floor.holdSpeechFloor(200, 'pace-notes');
  const wait = floor.speechFloorWait();
  assert.ok(wait > 300 && wait <= 400, 'A shorter hold never cuts a longer one short');
  // Speech cut short (a pause, a restart, leaving) lets go of its own hold, not others'.
  floor.releaseSpeechFloor('race-speech');
  assert.ok(floor.speechFloorWait() > 100 && floor.speechFloorWait() <= 200, 'The pace note still holds');
  floor.releaseSpeechFloor('pace-notes');
  assert.equal(floor.speechFloorWait(), 0);
  const { lapAnnouncementPriorityMs } = await import('../turn/ui/race-speech.js');
  assert.equal(lapAnnouncementPriorityMs('Lap.'), 3200, 'Lap priority keeps its floor');
  assert.equal(lapAnnouncementPriorityMs('Lap. Position: first. Time: forty one point two seconds.'), 900 + 9 * 440);
  const read = (path) => import('node:fs').then((fs) => fs.readFileSync(new URL(path, import.meta.url), 'utf8'));
  // Race speech is said at once and holds the floor; so do the track intro, the PAUSED
  // dialog's status and every pace note while it sounds.
  assert.match(await read('../turn/ui/race-speech.js'), /holdSpeechFloor\(priorityMs, FLOOR_OWNER\);/);
  assert.match(await read('../turn/ui/race-speech.js'), /holdSpeechFloor\(estimatedSpeechMs\(ordinalWord\(normalizedPosition\)\), FLOOR_OWNER\);\n      setLiveAnnouncement\(positionAnnouncer, ordinalWord\(normalizedPosition\)\);/);
  // A position held back by the lap result keeps the floor until it has been said.
  assert.match(await read('../turn/ui/race-speech.js'), /holdSpeechFloor\(lapPriorityUntil - performance\.now\(\) \+ estimatedSpeechMs\(ordinalWord\(normalizedPosition\)\), FLOOR_OWNER\);/);
  assert.match(await read('../turn/ui/race-speech.js'), /setLiveAnnouncement\(contextAnnouncer, ''\);\n[^\n]*\n      releaseSpeechFloor\(FLOOR_OWNER\);/,
    'A pause, restart or leave lets go of what race speech held');
  assert.match(await read('../turn/ui/track-intro.js'), /holdSpeechFloor\(estimatedSpeechMs\(intro\.textContent\), 'track-intro'\);/);
  assert.match(await read('../turn/ui/race-pause-menu.js'), /holdSpeechFloor\(estimatedSpeechMs\(message\) \+ 50, 'race-pause'\);/);
  assert.match(await read('../turn/audio/swoosh-pace-notes.js'), /holdSpeechFloor\(\(handle\.endsAt - now\) \* 1000, 'pace-notes'\);/);
  // The tutorial's voice is the speech that waits, holds the floor while it speaks, and a
  // run ends once its last words have been said.
  const prompt = await read('../turn/tutorial/tutorial-prompt.js');
  assert.match(prompt, /if \(!unsaid \|\| paused\(\)\) return;\n    const wait = speechFloorWait\(\);/,
    'Nothing waits on a timer while the race is paused: RESUME picks it up');
  assert.match(prompt, /if \(event\.detail\?\.reason !== 'race-resumed'\) return;/);
  assert.match(prompt, /holdSpeechFloor\(ms, 'tutorial'\);\n    saidUntil = performance\.now\(\) \+ ms;\n    setLiveAnnouncement\(voice, message\);/);
  for (const path of ['../turn/tutorial/tutorial-prompt.js', '../turn/tutorial/drift-attack-coach.js', '../turn/tutorial/flow-tutorial.js']) {
    assert.match(await read(path), /void prompt\.finish\(\)\.then\(stop\);/, path);
  }
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
