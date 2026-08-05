import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_DEPARTURE,
  SHIFT_CATALOG,
  ShiftSimulation,
  VERIFY_TARGET,
  createInitialState,
  formatClock,
  getStage
} from '../sim.mjs';

test('campaign exposes five shifts with four different post-training play styles', () => {
  assert.equal(SHIFT_CATALOG.length, 5);
  assert.equal(SHIFT_CATALOG[0].id, 'first-rounds');
  assert.deepEqual(
    SHIFT_CATALOG.slice(1).map((shift) => shift.kind),
    ['Systems shift', 'Network shift', 'Triage shift', 'Investigation shift']
  );
});

test('first shift teaches one safe action at a time before running flow', () => {
  const sim = new ShiftSimulation();
  assert.equal(getStage(sim.snapshot()), 'brief');
  sim.start();
  assert.equal(sim.snapshot().stage, 'tour');
  assert.equal(sim.snapshot().paused, true);
  assert.deepEqual(sim.snapshot().activeHotspots, ['express-lane']);

  assert.equal(sim.perform('inspect-express'), true);
  assert.equal(sim.snapshot().stage, 'coach-move');
  assert.equal(sim.perform('move-staff'), true);
  assert.equal(sim.snapshot().stage, 'coach-scan');
  assert.equal(sim.perform('inspect-scanner'), true);
  assert.equal(sim.snapshot().stage, 'coach-run');
  assert.equal(sim.perform('resume'), true);
  sim.tick(60);
  assert.equal(sim.snapshot().stage, 'dispatch');
  assert.equal(sim.completeShift(), true);
  assert.equal(sim.snapshot().outcome.grade, '✓');
  assert.match(sim.snapshot().outcome.summary, /four very different shifts/i);
});

test('northbound starts with the researched Sundsvall incident state', () => {
  const state = createInitialState('northbound');
  assert.equal(formatClock(state.time), '17:42');
  assert.equal(formatClock(state.departure), '18:20');
  assert.equal(state.risk, 18);
  assert.equal(getStage(state), 'brief');
});

test('moving crew protects northbound without hiding the root cause', () => {
  const sim = new ShiftSimulation(() => {}, 'northbound');
  sim.start();
  assert.equal(sim.moveStaff(), true);
  const state = sim.snapshot();
  assert.equal(state.expressCrew, 6);
  assert.equal(state.standardCrew, 4);
  assert.equal(state.risk, 9);
  assert.equal(state.ruleFixed, false);
  assert.equal(state.stage, 'investigate');
});

test('holding the truck buys three minutes and spends downstream margin', () => {
  const sim = new ShiftSimulation(() => {}, 'northbound');
  sim.start();
  sim.holdTruck();
  const state = sim.snapshot();
  assert.equal(state.departure, BASE_DEPARTURE + 3);
  assert.equal(state.downstreamMargin, 7);
  assert.equal(state.truckHeld, true);
});

test('parcel selection cannot be repeated for extra score', () => {
  const sim = new ShiftSimulation(() => {}, 'northbound');
  sim.start();
  sim.moveStaff();
  assert.equal(sim.selectPackage(), true);
  const score = sim.snapshot().score;
  assert.equal(sim.selectPackage(), false);
  assert.equal(sim.snapshot().score, score);
});

test('northbound verification only progresses while corrected flow runs', () => {
  const sim = new ShiftSimulation(() => {}, 'northbound');
  sim.start();
  sim.moveStaff();
  sim.selectPackage();
  sim.findSimilar();
  sim.fixRule();
  sim.tick(30);
  assert.equal(sim.snapshot().verified, 0);
  sim.setPaused(false);
  sim.tick(60);
  assert.equal(sim.snapshot().verified, VERIFY_TARGET);
  assert.equal(sim.snapshot().stage, 'dispatch');
});

test('clean northbound root-cause fix earns A plus', () => {
  const sim = new ShiftSimulation(() => {}, 'northbound');
  sim.start();
  sim.moveStaff();
  sim.selectPackage();
  sim.findSimilar();
  sim.fixRule();
  sim.setPaused(false);
  sim.tick(60);
  assert.equal(sim.completeShift(), true);
  assert.equal(sim.snapshot().outcome.grade, 'A+');
});

test('snow shift requires reading depots, then rewards urgent inland routing', () => {
  const sim = new ShiftSimulation(() => {}, 'snow-window');
  sim.start();
  assert.equal(sim.snapshot().stage, 'weather-scan');
  assert.equal(sim.perform('inspect-depot', 'harnosand'), true);
  assert.equal(sim.perform('inspect-depot', 'timra'), true);
  assert.equal(sim.perform('inspect-depot', 'matfors'), true);
  assert.equal(sim.snapshot().stage, 'weather-allocate');
  assert.equal(sim.perform('allocate-truck', 'harnosand'), true);
  assert.equal(sim.perform('choose-route', 'inland'), true);
  assert.equal(sim.perform('resume'), true);
  sim.tick(60);
  assert.equal(sim.snapshot().delivered, 14);
  assert.equal(sim.snapshot().stage, 'dispatch');
  sim.completeShift();
  assert.equal(sim.snapshot().outcome.grade, 'A+');
});

test('scanner shift changes its triage groups on replay variants', () => {
  const first = createInitialState('scanner-fever', 0).triageQueue.map((parcel) => parcel.id);
  const replay = createInitialState('scanner-fever', 1).triageQueue.map((parcel) => parcel.id);
  assert.notDeepEqual(first, replay);
});

test('scanner shift supports promise ordering, repair and live recovery', () => {
  const sim = new ShiftSimulation(() => {}, 'scanner-fever');
  sim.start();
  sim.perform('inspect-scanner');
  const ordered = [...sim.snapshot().triageQueue].sort((a, b) => a.priority - b.priority);
  ordered.forEach((parcel) => assert.equal(sim.perform('prioritize', parcel.id), true));
  assert.equal(sim.snapshot().triageMistakes, 0);
  assert.equal(sim.perform('repair-scanner'), true);
  assert.equal(sim.perform('resume'), true);
  sim.tick(60);
  assert.equal(sim.snapshot().processed, 31);
  assert.equal(sim.snapshot().stage, 'dispatch');
  sim.completeShift();
  assert.equal(sim.snapshot().outcome.grade, 'A+');
});

test('priority parcel shift turns evidence into a recovery choice', () => {
  const sim = new ShiftSimulation(() => {}, 'priority-parcel');
  sim.start();
  assert.equal(sim.selectPackage(), true);
  const correctLocation = sim.snapshot().caseData.correctLocation;
  assert.equal(sim.perform('choose-location', correctLocation), true);
  assert.equal(sim.snapshot().locationCorrect, true);
  assert.equal(sim.perform('choose-recovery', 'courier'), true);
  assert.equal(sim.perform('resume'), true);
  sim.tick(90);
  assert.equal(sim.snapshot().deliveryProgress, 100);
  assert.equal(sim.snapshot().stage, 'dispatch');
  sim.completeShift();
  assert.equal(sim.snapshot().outcome.grade, 'A+');
});

test('no shift can be closed before its live objective is ready', () => {
  for (const shift of SHIFT_CATALOG) {
    const sim = new ShiftSimulation(() => {}, shift.id);
    sim.start();
    assert.equal(sim.completeShift(), false, shift.id);
    assert.equal(sim.snapshot().completed, false, shift.id);
  }
});
