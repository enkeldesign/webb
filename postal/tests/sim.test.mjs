import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_DEPARTURE,
  ShiftSimulation,
  VERIFY_TARGET,
  createInitialState,
  formatClock,
  getStage
} from '../sim.mjs';

test('starts with the researched Sundsvall incident state', () => {
  const state = createInitialState();
  assert.equal(formatClock(state.time), '17:42');
  assert.equal(formatClock(state.departure), '18:20');
  assert.equal(state.risk, 18);
  assert.equal(getStage(state), 'brief');
});

test('moving crew protects the departure without hiding the root cause', () => {
  const sim = new ShiftSimulation();
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
  const sim = new ShiftSimulation();
  sim.start();
  sim.holdTruck();
  const state = sim.snapshot();
  assert.equal(state.departure, BASE_DEPARTURE + 3);
  assert.equal(state.downstreamMargin, 7);
  assert.equal(state.truckHeld, true);
});

test('package investigation pauses time and exposes the rule correction sequence', () => {
  const sim = new ShiftSimulation();
  sim.start();
  sim.moveStaff();
  sim.selectPackage();
  assert.equal(sim.snapshot().paused, true);
  assert.equal(sim.snapshot().stage, 'compare');
  sim.findSimilar();
  assert.equal(sim.snapshot().stage, 'rule');
  sim.fixRule();
  assert.equal(sim.snapshot().stage, 'verify');
  assert.equal(sim.snapshot().ruleFixed, true);
});

test('verification only progresses while the corrected flow is running', () => {
  const sim = new ShiftSimulation();
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

test('a clean root-cause fix can finish with an A plus result', () => {
  const sim = new ShiftSimulation();
  sim.start();
  sim.moveStaff();
  sim.selectPackage();
  sim.findSimilar();
  sim.fixRule();
  sim.setPaused(false);
  sim.tick(60);
  assert.equal(sim.completeShift(), true);
  const state = sim.snapshot();
  assert.equal(state.completed, true);
  assert.equal(state.outcome.grade, 'A+');
  assert.ok(state.outcome.medals.some((medal) => medal.label === 'Root cause found'));
});

test('cannot dispatch before twelve corrected parcels are verified', () => {
  const sim = new ShiftSimulation();
  sim.start();
  sim.moveStaff();
  assert.equal(sim.completeShift(), false);
  assert.equal(sim.snapshot().completed, false);
});
