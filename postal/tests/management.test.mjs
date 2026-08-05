import test from 'node:test';
import assert from 'node:assert/strict';
import '../management-sim.mjs';
import { SHIFT_CATALOG, ShiftSimulation } from '../sim.mjs';

function routeEveryWaitingBatch(simulation) {
  const state = simulation.snapshot();
  for (const incident of state.incidents.filter((item) => item.active)) {
    simulation.perform('resolve-incident', incident.target);
  }
  for (const job of simulation.snapshot().jobs.filter((item) => item.status === 'waiting')) {
    assert.equal(simulation.perform('select-job', job.id), true, `select ${job.id}`);
    assert.equal(simulation.perform('route-selected', job.target), true, `route ${job.id}`);
  }
}

function finishShift(shiftId) {
  const simulation = new ShiftSimulation(() => {}, shiftId);
  simulation.start();
  for (let step = 0; step < 5000 && !simulation.snapshot().completed; step += 1) {
    routeEveryWaitingBatch(simulation);
    simulation.tick(0.25);
  }
  return simulation;
}

function assignResourceTo(simulation, resourceId, target) {
  for (let step = 0; step < 8; step += 1) {
    const resource = simulation.snapshot().resources.find((item) => item.id === resourceId);
    if (resource.assignment === target) return resource;
    assert.equal(simulation.perform('cycle-resource', resourceId), true);
  }
  assert.fail(`${resourceId} could not be assigned to ${target}`);
}

test('live shifts expose assignable teams, regional trucks and national linehauls', () => {
  const simulation = new ShiftSimulation(() => {}, 'sweden-night');
  simulation.start();
  const state = simulation.snapshot();
  assert.deepEqual(state.resources.map((resource) => resource.id), ['T1', 'T2', 'R1', 'R2', 'S1', 'S2']);
  assert.ok(state.activeHotspots.includes('resource-R1'));
  assert.ok(state.activeHotspots.includes('resource-S1'));
  assert.equal(state.resources.find((resource) => resource.id === 'R1').assignmentLabel, 'Any regional route');
});

test('matching a team to the selected lane gives that team the batch and completes it faster', () => {
  const planned = new ShiftSimulation(() => {}, 'town-rush');
  planned.start();
  planned.tick(1.5);
  const plannedJob = planned.snapshot().jobs.find((job) => job.status === 'waiting');
  assert.ok(plannedJob);
  assignResourceTo(planned, 'T1', plannedJob.target);
  planned.perform('select-job', plannedJob.id);
  planned.perform('route-selected', plannedJob.target);
  const plannedProcessing = planned.snapshot().jobs.find((job) => job.id === plannedJob.id);

  const flexible = new ShiftSimulation(() => {}, 'town-rush');
  flexible.start();
  flexible.tick(1.5);
  const flexibleJob = flexible.snapshot().jobs.find((job) => job.id === plannedJob.id);
  flexible.perform('select-job', flexibleJob.id);
  flexible.perform('route-selected', flexibleJob.target);
  const flexibleProcessing = flexible.snapshot().jobs.find((job) => job.id === flexibleJob.id);

  assert.equal(plannedProcessing.resourceId, 'T1');
  assert.equal(planned.snapshot().resources.find((resource) => resource.id === 'T1').busy, true);
  assert.ok(
    plannedProcessing.completesAt - plannedProcessing.startedAt < flexibleProcessing.completesAt - flexibleProcessing.startedAt,
    'planned matching work should be faster than a flexible assignment'
  );
});

test('a completed live shift can close its report and continue into recurring overtime waves', () => {
  const simulation = finishShift('town-rush');
  const completed = simulation.snapshot();
  assert.equal(completed.completed, true);
  assert.equal(completed.jobs.length, SHIFT_CATALOG.find((shift) => shift.id === 'town-rush').jobs);

  assert.equal(simulation.perform('continue-operations'), true);
  let state = simulation.snapshot();
  assert.equal(state.completed, false);
  assert.equal(state.paused, false);
  assert.equal(state.stage, 'overtime');
  assert.equal(state.overtime, true);
  assert.ok(state.jobs.length > completed.jobs.length);
  assert.ok(state.jobs.some((job) => job.status === 'scheduled'));

  simulation.tick(500);
  state = simulation.snapshot();
  assert.equal(state.completed, false);
  assert.equal(state.overtime, true);
  assert.ok(state.overtimeWave >= 2);
});

test('the calm first shift remains a bounded tutorial rather than endless overtime', () => {
  const simulation = new ShiftSimulation(() => {}, 'first-rounds');
  simulation.start();
  simulation.perform('select-job', 'TRAINING-01');
  simulation.perform('route-selected', 'express-lane');
  simulation.tick(12);
  simulation.perform('visit-level', 'network');
  simulation.perform('select-job', 'TRAINING-01');
  simulation.perform('route-selected', 'network-harnosand');
  simulation.tick(20);
  assert.equal(simulation.snapshot().completed, true);
  assert.equal(simulation.perform('continue-operations'), false);
});
