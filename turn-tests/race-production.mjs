import assert from 'node:assert/strict';

import {
  GAME_MODE,
  installGameModeState,
  prepareRaceStartState,
  resetRaceToStage,
  setGameModeState
} from '../turn/race/game-state.js';
import {
  LAP_CHECKPOINTS,
  beginTimedLapState,
  completeLapState,
  crossedForwardGate,
  updateLapProgressState
} from '../turn/race/lap-system.js';
import {
  normalizeReplayFrames,
  recordReplayFrame,
  replayFrameAt
} from '../turn/race/replay-system.js';

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

function makeSamples(count = 100) {
  return Array.from({ length: count }, (_, index) => ({
    point: { x: index * 10, y: 0, z: 0 },
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

test('game mode state bridges lapActive and preserves explicit spectate mode', () => {
  const state = makeState();
  assert.equal(state.mode, GAME_MODE.STAGED);
  assert.equal(state.lapActive, false);
  assert.equal(state.lapInvalid, false);
  assert.equal(state.lapPreviousPosition, null);

  state.lapActive = true;
  assert.equal(state.mode, GAME_MODE.RACING);

  setGameModeState(state, GAME_MODE.SPECTATING);
  state.lapActive = false;
  assert.equal(state.mode, GAME_MODE.SPECTATING);
});

test('staged reset uses the production start offset and clears invalid timing state', () => {
  const samples = makeSamples();
  const state = makeState({
    competitorLaps: [{}, {}],
    lapStartedAt: 1234,
    lapElapsed: 9,
    lapInvalid: true,
    lapPreviousPosition: { x: 1, z: 2 }
  });
  state.lapActive = true;
  state.velocity.set(4, 0, 2);
  state.recording = [{ t: 1 }];

  let positionArgs = null;
  resetRaceToStage({
    state,
    samples,
    setRacePosition: (...args) => { positionArgs = args; }
  });

  assert.equal(state.mode, GAME_MODE.STAGED);
  assert.equal(state.nearestTrackIndex, 76);
  assert.equal(state.progress, 0.76);
  assert.equal(state.position.x, 760);
  assert.equal(state.position.z, 0);
  assert.equal(state.position.y, 0.18);
  assert.deepEqual([state.velocity.x, state.velocity.y, state.velocity.z], [0, 0, 0]);
  assert.equal(state.lapStartedAt, 0);
  assert.equal(state.lapElapsed, 0);
  assert.equal(state.lapInvalid, false);
  assert.deepEqual(state.lapPreviousPosition, { x: 760, z: 0 });
  assert.deepEqual(state.recording, []);
  assert.deepEqual(positionArgs, [null, 3]);

  state.lapStartedAt = 99;
  state.lapElapsed = 4;
  state.lapInvalid = true;
  prepareRaceStartState(state);
  assert.equal(state.lapStartedAt, 0);
  assert.equal(state.lapElapsed, 0);
  assert.equal(state.lapInvalid, false);
});

test('timed lap pins the exact start frame and snapshots the physical position', () => {
  const samples = makeSamples();
  const state = makeState({ steering: -0.35, driftAmount: 0.6 });
  state.position.set(-2, 0, 3);
  let message = '';

  beginTimedLapState({
    state,
    samples,
    now: 5000,
    showMessage: (value) => { message = value; }
  });

  assert.equal(state.mode, GAME_MODE.RACING);
  assert.equal(state.lapStartedAt, 5000);
  assert.equal(state.lapElapsed, 0);
  assert.equal(state.lapCheckpointIndex, 0);
  assert.equal(state.lapInvalid, false);
  assert.deepEqual(state.lapPreviousPosition, { x: -2, z: 3 });
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

test('swept checkpoint gates require a forward crossing inside their width', () => {
  const gate = {
    point: { x: 10, z: 0 },
    tangent: { x: 1, z: 0 }
  };

  assert.equal(
    crossedForwardGate({ x: 9, z: 0 }, { x: 11, z: 0 }, gate, 5),
    true
  );
  assert.equal(
    crossedForwardGate({ x: 11, z: 0 }, { x: 9, z: 0 }, gate, 5),
    false
  );
  assert.equal(
    crossedForwardGate({ x: 9, z: 7 }, { x: 11, z: 7 }, gate, 5),
    false
  );
});

test('ordered production gates advance one checkpoint and invalidate a skipped route', () => {
  const samples = makeSamples();
  const state = makeState({ lapStartedAt: 1000 });
  state.lapActive = true;
  state.velocity.set(10, 0, 0);

  let recorded = 0;
  const run = (now) => updateLapProgressState({
    state,
    nearestAfter: { sample: samples[0] },
    samples,
    trackWidth: 27,
    now,
    beginTimedLap: () => {},
    completeLap: () => {},
    recordGhostFrame: () => { recorded += 1; }
  });

  assert.equal(LAP_CHECKPOINTS.length, 12);

  const first = samples[Math.round(LAP_CHECKPOINTS[0] * samples.length) % samples.length];
  state.lapPreviousPosition = { x: first.point.x - 1, z: first.point.z };
  state.position.set(first.point.x + 1, 0, first.point.z);
  run(2000);
  assert.equal(state.lapCheckpointIndex, 1);
  assert.equal(state.lapInvalid, false);
  assert.equal(recorded, 1);

  state.lapCheckpointIndex = 0;
  state.lapInvalid = false;
  const later = samples[Math.round(LAP_CHECKPOINTS[1] * samples.length) % samples.length];
  state.lapPreviousPosition = { x: later.point.x - 1, z: later.point.z };
  state.position.set(later.point.x + 1, 0, later.point.z);
  run(3000);
  assert.equal(state.lapCheckpointIndex, 0);
  assert.equal(state.lapInvalid, true);
  assert.equal(recorded, 2);
});

test('the physical start gate completes only a valid full checkpoint chain', () => {
  const samples = makeSamples();
  const state = makeState({ lapStartedAt: 1000 });
  state.lapActive = true;
  state.velocity.set(10, 0, 0);
  state.lapCheckpointIndex = LAP_CHECKPOINTS.length;
  state.lapPreviousPosition = { x: -1, z: 0 };
  state.position.set(1, 0, 0);

  let completed = 0;
  updateLapProgressState({
    state,
    nearestAfter: { sample: samples[0] },
    samples,
    trackWidth: 27,
    now: 8000,
    beginTimedLap: () => {},
    completeLap: () => { completed += 1; },
    recordGhostFrame: () => {}
  });

  assert.equal(completed, 1);
});

test('completed laps keep the fastest four rivals and preserve exact vehicle paint', () => {
  const samples = makeSamples();
  const oldLaps = [10, 11, 12, 13].map((time) => ({
    time,
    hitAt: null,
    frames: makeFrames()
  }));
  const state = makeState({
    competitorLaps: oldLaps,
    recording: makeFrames(),
    lapStartedAt: 0,
    bestTime: 10,
    lap: 1,
    vehicleId: 'monster-truck',
    vehicleColor: '#ff4fa3',
    vehicleSecondaryColor: '#abcdef'
  });
  state.lapActive = true;

  let saved = 0;
  const result = completeLapState({
    state,
    samples,
    now: 9000,
    competitorLimit: 4,
    saveGhost: () => { saved += 1; }
  });

  assert.equal(result.completedLap, true);
  assert.equal(result.validLap, true);
  assert.equal(result.finishedTime, 9);
  assert.deepEqual(state.competitorLaps.map((lap) => lap.time), [9, 10, 11, 12]);
  assert.equal(state.bestTime, 9);
  assert.equal(state.ghostVisible, true);
  assert.equal(saved, 1);
  assert.equal(state.lap, 2);
  assert.equal(state.mode, GAME_MODE.RACING);
  assert.equal(state.lapStartedAt, 9000);
  assert.equal(state.lapElapsed, 0);
  assert.equal(state.lapInvalid, false);
  assert.deepEqual(state.recording, []);
  assert.equal(state.competitorLaps[0].carId, 'monster-truck');
  assert.equal(state.competitorLaps[0].carColor, '#ff4fa3');
  assert.equal(state.competitorLaps[0].carSecondaryColor, '#abcdef');
  assert.equal(state.competitorLaps[0].frames[0].t, 0);
  assert.equal(state.competitorLaps[0].frames[0].p, 0);
  assert.equal(state.competitorLaps[0].frames[0].x, samples[0].point.x);
});

test('replay interpolation wraps time, caches identical lookups and uses the shortest angle path', () => {
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
  assert.equal(replayFrameAt(lap, 0.5), middle);

  const wrapped = replayFrameAt(lap, 1.5);
  assert.equal(wrapped.x, 5);
  assert.equal(replayFrameAt({ frames: [lap.frames[0]] }, 0), null);
});

test('replay recording respects its interval and normalization pins the start frame', () => {
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

  const normalized = normalizeReplayFrames([
    { t: 0.2, x: 99, z: 88, h: 0 },
    { t: 0.5, x: 5, z: 6, h: 0 }
  ], {
    startSample: {
      point: { x: 7, z: 9 },
      tangent: { x: 1, z: 0 }
    },
    findProgress: () => 0.5
  });

  assert.deepEqual(normalized[0], {
    t: 0,
    x: 7,
    z: 9,
    h: Math.PI / 2,
    p: 0
  });
  assert.equal(normalized[1].p, 0.5);
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

if (failures > 0) {
  process.exitCode = 1;
} else {
  console.log(`TURN production race regression passed (${tests.length} tests).`);
}
