import assert from 'node:assert/strict';

import {
  GAME_MODE,
  installGameModeState,
  prepareRaceStartState,
  resetRaceToStage,
  setGameModeState
} from '../race/game-state.js';
import {
  LAP_CHECKPOINTS,
  beginTimedLapState,
  completeLapState,
  updateLapProgressState
} from '../race/lap-system.js';
import {
  normalizeReplayFrames,
  recordReplayFrame,
  replayFrameAt
} from '../race/replay-system.js';
import {
  clearRivalsState,
  loadRivalsState,
  saveRivalsState
} from '../race/rival-storage.js';

class Vec3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  copy(other) {
    this.x = other.x;
    this.y = other.y;
    this.z = other.z;
    return this;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }
}

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

function makeSamples(count = 100) {
  return Array.from({ length: count }, (_, index) => ({
    point: { x: index, y: 0, z: index * 2 },
    tangent: { x: 1, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 }
  }));
}

function makeFrames(count = 25, step = 0.05) {
  return Array.from({ length: count }, (_, index) => ({
    t: index * step,
    x: index,
    z: index * 2,
    h: index * 0.01,
    s: 0.1,
    d: 0.2,
    p: index / Math.max(1, count - 1)
  }));
}

function makeState(overrides = {}) {
  const state = {
    position: new Vec3(),
    velocity: new Vec3(),
    competitorLaps: [],
    recording: [],
    steering: 0.2,
    driftAmount: 0.3,
    speed: 0,
    progress: 0,
    lastProgress: 0,
    nearestTrackIndex: 0,
    trackDistance: 0,
    lapCheckpointIndex: 0,
    lapStartedAt: 0,
    lapElapsed: 0,
    lap: 1,
    bestTime: Infinity,
    ghostFrames: [],
    ghostVisible: false,
    ...overrides
  };
  installGameModeState(state);
  return state;
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

test('game mode state bridges lapActive without corrupting spectate mode', () => {
  const state = makeState();
  assert.equal(state.mode, GAME_MODE.STAGED);
  assert.equal(state.lapActive, false);

  state.lapActive = true;
  assert.equal(state.mode, GAME_MODE.RACING);
  assert.equal(state.lapActive, true);

  setGameModeState(state, GAME_MODE.SPECTATING);
  state.lapActive = false;
  assert.equal(state.mode, GAME_MODE.SPECTATING);

  assert.equal(setGameModeState(state, 'not-a-mode'), GAME_MODE.SPECTATING);
});

test('staged reset places the car behind the line and clears race timing', () => {
  const samples = makeSamples(100);
  const state = makeState({ competitorLaps: [{}, {}], lapStartedAt: 1234, lapElapsed: 9 });
  state.lapActive = true;
  state.velocity.set(4, 0, 2);
  state.recording = [{ t: 1 }];

  let message = '';
  let positionArgs = null;
  resetRaceToStage({
    state,
    samples,
    showMessage: (value) => { message = value; },
    setRacePosition: (...args) => { positionArgs = args; }
  });

  assert.equal(state.mode, GAME_MODE.STAGED);
  assert.equal(state.nearestTrackIndex, 76);
  assert.equal(state.progress, 0.76);
  assert.equal(state.position.x, 76);
  assert.equal(state.position.z, 152);
  assert.equal(state.position.y, 0.18);
  assert.deepEqual([state.velocity.x, state.velocity.y, state.velocity.z], [0, 0, 0]);
  assert.equal(state.lapStartedAt, 0);
  assert.equal(state.lapElapsed, 0);
  assert.deepEqual(state.recording, []);
  assert.equal(message, 'READY FOR THE LINE');
  assert.deepEqual(positionArgs, [null, 3]);

  state.lapStartedAt = 99;
  state.lapElapsed = 4;
  prepareRaceStartState(state);
  assert.equal(state.lapStartedAt, 0);
  assert.equal(state.lapElapsed, 0);
});

test('timed lap starts with an exact pinned start frame', () => {
  const samples = makeSamples();
  const state = makeState({ steering: -0.35, driftAmount: 0.6 });
  let message = '';

  beginTimedLapState({ state, samples, now: 5000, showMessage: (value) => { message = value; } });

  assert.equal(state.mode, GAME_MODE.RACING);
  assert.equal(state.lapStartedAt, 5000);
  assert.equal(state.lapElapsed, 0);
  assert.equal(state.lapCheckpointIndex, 0);
  assert.deepEqual(state.recording[0], {
    t: 0,
    x: 0,
    z: 0,
    h: Math.PI / 2,
    s: -0.35,
    d: 0.6,
    p: 0
  });
  assert.equal(message, 'GO!');
});

test('lap progress requires ordered physical checkpoint gates and routes start crossings correctly', () => {
  const samples = makeSamples();
  const state = makeState({ lapStartedAt: 1000, trackDistance: 1 });
  state.lapActive = true;
  state.velocity.set(10, 0, 0);

  let began = 0;
  let completed = 0;
  let recorded = 0;
  const run = (now) => updateLapProgressState({
    state,
    nearestAfter: { sample: samples[Math.round(state.progress * samples.length) % samples.length] },
    samples,
    trackWidth: 27,
    now,
    beginTimedLap: () => { began += 1; },
    completeLap: () => { completed += 1; },
    recordGhostFrame: () => { recorded += 1; }
  });

  assert.ok(LAP_CHECKPOINTS.length >= 10, 'checkpoint chain should be dense enough to reject major shortcuts');

  state.lastProgress = 0.07;
  state.progress = 0.09;
  state.position.set(70, 0, 140);
  run(2000);
  assert.equal(state.lapCheckpointIndex, 0, 'progress jumps far away from the checkpoint must not count');

  const firstIndex = Math.round(LAP_CHECKPOINTS[0] * samples.length) % samples.length;
  state.position.set(samples[firstIndex].point.x, 0, samples[firstIndex].point.z);
  run(2100);
  assert.equal(state.lapCheckpointIndex, 1);
  assert.equal(recorded, 2);

  const secondIndex = Math.round(LAP_CHECKPOINTS[1] * samples.length) % samples.length;
  state.position.set(samples[secondIndex].point.x, 0, samples[secondIndex].point.z);
  state.velocity.set(-10, 0, 0);
  run(2200);
  assert.equal(state.lapCheckpointIndex, 1, 'reverse movement must not claim a checkpoint');

  state.velocity.set(10, 0, 0);
  run(2300);
  assert.equal(state.lapCheckpointIndex, 2);

  state.position.set(samples[0].point.x, 0, samples[0].point.z);
  state.lastProgress = 0.9;
  state.progress = 0.1;
  state.lapCheckpointIndex = 2;
  run(3000);
  assert.equal(began, 1, 'incomplete circuit restarts the timed attempt');
  assert.equal(completed, 0);

  state.lastProgress = 0.9;
  state.progress = 0.1;
  state.lapCheckpointIndex = LAP_CHECKPOINTS.length;
  run(4000);
  assert.equal(completed, 1, 'full ordered physical checkpoint chain completes the lap');

  state.lapActive = false;
  state.lastProgress = 0.9;
  state.progress = 0.1;
  run(5000);
  assert.equal(began, 2, 'first forward crossing starts timing');
  assert.equal(state.lapElapsed, 0);
});

test('completed laps keep the fastest four rivals and immediately continue racing', () => {
  const samples = makeSamples();
  const oldLaps = [10, 11, 12, 13].map((time) => ({ time, hitAt: null, frames: makeFrames() }));
  const state = makeState({
    competitorLaps: oldLaps,
    recording: makeFrames(),
    lapStartedAt: 0,
    bestTime: 10,
    lap: 1
  });
  state.lapActive = true;

  let saved = 0;
  let message = '';
  const result = completeLapState({
    state,
    samples,
    now: 9000,
    competitorLimit: 4,
    saveGhost: () => { saved += 1; },
    showMessage: (value) => { message = value; }
  });

  assert.equal(result.validLap, true);
  assert.equal(result.finishedTime, 9);
  assert.deepEqual(state.competitorLaps.map((lap) => lap.time), [9, 10, 11, 12]);
  assert.equal(state.bestTime, 9);
  assert.equal(state.ghostVisible, true);
  assert.equal(saved, 1);
  assert.match(message, /^NEW BEST /);
  assert.equal(state.lap, 2);
  assert.equal(state.mode, GAME_MODE.RACING);
  assert.equal(state.lapStartedAt, 9000);
  assert.equal(state.lapElapsed, 0);
  assert.deepEqual(state.recording, []);
  assert.equal(state.competitorLaps[0].frames[0].t, 0);
  assert.equal(state.competitorLaps[0].frames[0].p, 0);
  assert.equal(state.competitorLaps[0].frames[0].x, samples[0].point.x);
});

test('replay interpolation wraps time and takes the shortest angle path', () => {
  const lap = {
    time: 1,
    frames: [
      { t: 0, x: 0, z: 0, h: 3.1, s: 0, d: 0, p: 0 },
      { t: 1, x: 10, z: 20, h: -3.1, s: 1, d: 1, p: 1 }
    ]
  };

  const middle = replayFrameAt(lap, 0.5);
  assert.equal(middle.x, 5);
  assert.equal(middle.z, 10);
  assert.equal(middle.s, 0.5);
  assert.equal(middle.p, 0.5);
  assert.ok(Math.abs(Math.abs(middle.h) - Math.PI) < 0.05);

  const wrapped = replayFrameAt(lap, 1.5);
  assert.equal(wrapped.x, 5);
  assert.equal(replayFrameAt({ frames: [lap.frames[0]] }, 0), null);
});

test('replay recording respects interval and normalization pins the first frame', () => {
  const state = {
    recording: [],
    lapElapsed: 0,
    position: new Vec3(4, 0, 8),
    heading: 0.4,
    steering: 0.2,
    driftAmount: 0.3,
    progress: 0.25
  };

  assert.equal(recordReplayFrame(state), true);
  state.lapElapsed = 0.02;
  assert.equal(recordReplayFrame(state), false);
  state.lapElapsed = 0.05;
  assert.equal(recordReplayFrame(state), true);
  assert.equal(state.recording.length, 2);

  const original = [
    { t: 0.2, x: 99, z: 88, h: 0 },
    { t: 0.5, x: 5, z: 6, h: 0 }
  ];
  const normalized = normalizeReplayFrames(original, {
    startSample: { point: { x: 7, z: 9 }, tangent: { x: 1, z: 0 } },
    findProgress: (frame) => frame.x / 10
  });

  assert.equal(original[0].x, 99, 'normalization must not mutate saved input');
  assert.deepEqual(normalized[0], { t: 0, x: 7, z: 9, h: Math.PI / 2, p: 0 });
  assert.equal(normalized[1].p, 0.5);
});

test('rival storage migrates old data, preserves unknown timestamps and keeps the fastest four', () => {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  const samples = makeSamples();
  const findNearestTrack = (frame) => ({ index: Math.max(0, Math.min(99, Math.round(frame.x))) });

  const laps = [
    { time: 13, hitAt: 1300, frames: makeFrames() },
    { time: 8, hitAt: null, frames: makeFrames() },
    { time: 11, hitAt: 1100, frames: makeFrames() },
    { time: 9, hitAt: '900', frames: makeFrames() },
    { time: 12, hitAt: 1200, frames: makeFrames() },
    { time: 10, hitAt: 1000, frames: makeFrames() }
  ];
  storage.setItem('turn-personal-rivals-v1', JSON.stringify({ version: 2, laps }));

  const state = { competitorLaps: [], bestTime: Infinity, ghostFrames: [], ghostVisible: false };
  const loaded = loadRivalsState({ state, samples, findNearestTrack });

  assert.deepEqual(loaded.map((lap) => lap.time), [8, 9, 10, 11]);
  assert.equal(loaded[0].hitAt, null);
  assert.equal(loaded[1].hitAt, 900);
  assert.equal(loaded[0].frames[0].t, 0);
  assert.equal(loaded[0].frames[0].p, 0);
  assert.equal(state.bestTime, 8);
  assert.equal(state.ghostVisible, true);
  assert.equal(saveRivalsState(state), true);

  storage.clear();
  storage.setItem('turn-three-ghost-v4', JSON.stringify({ bestTime: 7.5, frames: makeFrames() }));
  const migratedState = { competitorLaps: [], bestTime: Infinity, ghostFrames: [], ghostVisible: false };
  const migrated = loadRivalsState({ state: migratedState, samples, findNearestTrack });
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].time, 7.5);
  assert.equal(migrated[0].hitAt, null);
  assert.ok(storage.getItem('turn-personal-rivals-v1'));

  clearRivalsState(migratedState);
  assert.deepEqual(migratedState.competitorLaps, []);
  assert.equal(migratedState.bestTime, Infinity);
  assert.equal(migratedState.ghostVisible, false);
  assert.equal(storage.getItem('turn-personal-rivals-v1'), null);
  assert.equal(storage.getItem('turn-three-ghost-v4'), null);
});

let failures = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

if (failures) {
  console.error(`\n${failures} TURN regression test${failures === 1 ? '' : 's'} failed.`);
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} TURN regression tests passed.`);
}
