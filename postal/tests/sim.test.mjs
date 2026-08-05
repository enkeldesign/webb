import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARRIERS,
  SHIFT_CATALOG,
  ShiftSimulation,
  createInitialState,
  formatClock,
  getStage
} from '../sim.mjs';

function routeEveryWaitingBatch(sim) {
  const state = sim.snapshot();
  for (const incident of state.incidents.filter((item) => item.active)) {
    sim.perform('resolve-incident', incident.target);
  }
  for (const job of sim.snapshot().jobs.filter((item) => item.status === 'waiting')) {
    assert.equal(sim.perform('select-job', job.id), true, `select ${job.id}`);
    assert.equal(sim.perform('route-selected', job.target), true, `route ${job.id} to ${job.target}`);
  }
}

function finishPerfectly(shiftId) {
  const sim = new ShiftSimulation(() => {}, shiftId);
  sim.start();
  for (let step = 0; step < 4000 && !sim.snapshot().completed; step += 1) {
    routeEveryWaitingBatch(sim);
    sim.tick(0.25);
  }
  return sim;
}

test('campaign difficulty expands from guided town play to all three live levels', () => {
  assert.equal(SHIFT_CATALOG.length, 5);
  assert.equal(SHIFT_CATALOG[0].id, 'first-rounds');
  assert.deepEqual(SHIFT_CATALOG[1].activeLevels, ['terminal']);
  assert.deepEqual(SHIFT_CATALOG[2].activeLevels, ['terminal', 'network']);
  assert.deepEqual(SHIFT_CATALOG[3].activeLevels, ['terminal', 'network', 'sweden']);
  assert.deepEqual(SHIFT_CATALOG[4].activeLevels, ['terminal', 'network', 'sweden']);
  assert.ok(SHIFT_CATALOG[1].jobs < SHIFT_CATALOG[2].jobs);
  assert.ok(SHIFT_CATALOG[2].jobs < SHIFT_CATALOG[4].jobs);
});

test('all four fictional partner carriers participate in live work', () => {
  assert.deepEqual(Object.values(CARRIERS).map((carrier) => carrier.name), ['NordPost', 'DLH', 'Brang', 'USP']);
  const liveCarrierIds = new Set(createInitialState('friday-surge').jobs.map((job) => job.carrierId));
  assert.deepEqual([...liveCarrierIds].sort(), ['brang', 'dlh', 'nordpost', 'usp']);
  const nationalDestinations = new Set(createInitialState('sweden-night').jobs.map((job) => job.destinationId));
  assert.ok(nationalDestinations.has('stockholm'));
  assert.ok(nationalDestinations.has('gothenburg'));
});

test('first shift teaches selection and world routing without deadline pressure', () => {
  const sim = new ShiftSimulation();
  assert.equal(getStage(sim.snapshot()), 'brief');
  sim.start();
  assert.equal(sim.snapshot().stage, 'coach-select');
  assert.equal(sim.snapshot().paused, true);
  assert.equal(sim.snapshot().jobs[0].status, 'waiting');

  assert.equal(sim.perform('select-job', 'TRAINING-01'), true);
  assert.equal(sim.snapshot().stage, 'coach-town-target');
  assert.deepEqual(sim.snapshot().activeHotspots, ['express-lane']);
  assert.equal(sim.perform('route-selected', 'express-lane'), true);
  assert.equal(sim.snapshot().stage, 'coach-town-run');
  sim.tick(12);

  assert.equal(sim.snapshot().stage, 'coach-open-region');
  assert.equal(sim.snapshot().paused, true);
  assert.deepEqual(sim.snapshot().availableScenes, ['terminal', 'network']);
  assert.equal(sim.perform('visit-level', 'network'), true);
  assert.equal(sim.snapshot().stage, 'coach-region-select');
  assert.equal(sim.perform('select-job', 'TRAINING-01'), true);
  assert.equal(sim.perform('route-selected', 'network-harnosand'), true);
  sim.tick(20);
  assert.equal(sim.snapshot().completed, true);
  assert.equal(sim.snapshot().outcome.grade, '✓');
});

test('live shifts begin in real time with no question stage', () => {
  for (const shift of SHIFT_CATALOG.slice(1)) {
    const sim = new ShiftSimulation(() => {}, shift.id);
    sim.start();
    assert.equal(sim.snapshot().stage, 'live', shift.id);
    assert.equal(sim.snapshot().paused, false, shift.id);
    assert.ok(sim.snapshot().availableScenes.length >= 1, shift.id);
  }
});

test('a batch is selected, routed through its scene target and occupies capacity', () => {
  const sim = new ShiftSimulation(() => {}, 'town-rush');
  sim.start();
  sim.tick(1.5);
  const job = sim.snapshot().jobs.find((item) => item.status === 'waiting');
  assert.ok(job);
  assert.equal(sim.perform('select-job', job.id), true);
  assert.equal(sim.snapshot().selectedJobId, job.id);
  assert.equal(sim.perform('route-selected', job.target), true);
  assert.equal(sim.snapshot().selectedJobId, null);
  assert.equal(sim.snapshot().jobs.find((item) => item.id === job.id).status, 'processing');
  assert.equal(sim.snapshot().resourceStatus.terminal.busy, 1);
});

test('a wrong physical destination costs score and time but leaves the batch selected', () => {
  const sim = new ShiftSimulation(() => {}, 'town-rush');
  sim.start();
  sim.tick(1.5);
  const job = sim.snapshot().jobs.find((item) => item.status === 'waiting');
  sim.perform('select-job', job.id);
  const score = sim.snapshot().score;
  const deadline = job.deadline;
  const wrong = job.target === 'express-lane' ? 'standard-lane' : 'express-lane';
  assert.equal(sim.perform('route-selected', wrong), true);
  const state = sim.snapshot();
  assert.equal(state.mistakes, 1);
  assert.equal(state.selectedJobId, job.id);
  assert.ok(state.score <= score);
  assert.equal(state.jobs.find((item) => item.id === job.id).deadline, deadline - 2);
});

test('switching levels clears a batch from the previous level', () => {
  const sim = new ShiftSimulation(() => {}, 'sweden-night');
  sim.start();
  sim.tick(2);
  const job = sim.snapshot().jobs.find((item) => item.stage === 'terminal' && item.status === 'waiting');
  sim.perform('select-job', job.id);
  assert.equal(sim.snapshot().selectedJobId, job.id);
  sim.perform('visit-level', 'sweden');
  assert.equal(sim.snapshot().selectedJobId, null);
  assert.equal(sim.snapshot().jobs.find((item) => item.id === job.id).status, 'waiting');
});

test('scarce teams create a real queue instead of a prompted choice', () => {
  const sim = new ShiftSimulation(() => {}, 'town-rush');
  sim.start();
  sim.tick(13);
  const waiting = sim.snapshot().jobs.filter((job) => job.status === 'waiting').slice(0, 3);
  assert.equal(waiting.length, 3);
  for (const job of waiting) {
    sim.perform('select-job', job.id);
    sim.perform('route-selected', job.target);
  }
  const state = sim.snapshot();
  assert.equal(state.resourceStatus.terminal.busy, 2);
  assert.equal(state.jobs.filter((job) => job.status === 'queued').length, 1);
});

test('one national batch visibly progresses through town, region and Sweden', () => {
  const sim = new ShiftSimulation(() => {}, 'sweden-night');
  sim.start();
  sim.tick(1.5);
  let job = sim.snapshot().jobs.find((item) => item.status === 'waiting' && item.path.length === 3);
  assert.ok(job);
  assert.equal(job.stage, 'terminal');
  sim.perform('select-job', job.id);
  sim.perform('route-selected', job.target);
  sim.tick(12);

  job = sim.snapshot().jobs.find((item) => item.id === job.id);
  assert.equal(job.stage, 'network');
  assert.equal(job.status, 'waiting');
  sim.perform('select-job', job.id);
  sim.perform('route-selected', job.target);
  sim.tick(16);

  job = sim.snapshot().jobs.find((item) => item.id === job.id);
  assert.equal(job.stage, 'sweden');
  assert.equal(job.status, 'waiting');
  assert.match(job.target, /^sweden-(stockholm|gothenburg)$/);
  sim.perform('select-job', job.id);
  sim.perform('route-selected', job.target);
  sim.tick(22);
  assert.equal(sim.snapshot().jobs.find((item) => item.id === job.id).status, 'delivered');
});

test('advanced shifts create unattended work on several levels at once', () => {
  const sim = new ShiftSimulation(() => {}, 'friday-surge');
  sim.start();
  sim.tick(34);
  const state = sim.snapshot();
  const occupiedLevels = Object.entries(state.levelCounts).filter(([, count]) => count > 0).map(([level]) => level);
  assert.ok(occupiedLevels.length >= 2, occupiedLevels.join(', '));
});

test('disruptions appear in real time and are cleared directly in their scene', () => {
  const sim = new ShiftSimulation(() => {}, 'town-rush');
  sim.start();
  sim.tick(39);
  let state = sim.snapshot();
  const incident = state.incidents.find((item) => item.type === 'scanner-jam');
  assert.equal(incident.active, true);
  assert.ok(state.activeHotspots.includes('scanner'));
  assert.equal(sim.perform('resolve-incident', 'scanner'), true);
  state = sim.snapshot();
  assert.equal(state.incidents.find((item) => item.type === 'scanner-jam').resolved, true);
  assert.equal(state.incidents.find((item) => item.type === 'scanner-jam').active, false);
});

test('perfect attention can clear every increasingly difficult live shift', () => {
  for (const shift of SHIFT_CATALOG.slice(1)) {
    const sim = finishPerfectly(shift.id);
    const state = sim.snapshot();
    assert.equal(state.completed, true, shift.id);
    assert.equal(state.delivered, shift.jobs, shift.id);
    assert.equal(state.missed, 0, shift.id);
    assert.equal(state.outcome.grade, 'A+', shift.id);
  }
});

test('ignoring the town floor creates missed promises and still ends the shift', () => {
  const sim = new ShiftSimulation(() => {}, 'town-rush');
  sim.start();
  sim.tick(160);
  const state = sim.snapshot();
  assert.equal(state.completed, true);
  assert.ok(state.missed > 0);
  assert.ok(state.onTime < 100);
  assert.notEqual(state.outcome.grade, 'A+');
  assert.ok(!state.outcome.medals.some((medal) => medal.label === 'Perfect sorting'));
});

test('replays vary carrier and destination order without changing the rules', () => {
  const first = createInitialState('friday-surge', 0).jobs.slice(0, 6).map((job) => `${job.carrierId}:${job.destinationId}`);
  const replay = createInitialState('friday-surge', 1).jobs.slice(0, 6).map((job) => `${job.carrierId}:${job.destinationId}`);
  assert.notDeepEqual(first, replay);
});

test('clock and stage helpers remain deterministic', () => {
  assert.equal(formatClock(17 * 60 + 42), '17:42');
  assert.equal(getStage(createInitialState('town-rush')), 'brief');
});
