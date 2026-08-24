import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FLOW_STAGES,
  MODE_CONFIGS,
  applyImpact,
  createRunSnapshot,
  createRunState,
  stageForFlow,
  stepBalance
} from './game-core.mjs';

test('all three modes expose distinct balance rules', () => {
  assert.deepEqual(Object.keys(MODE_CONFIGS), ['easy', 'medium', 'hard']);
  assert.equal(MODE_CONFIGS.easy.projectiles, false);
  assert.equal(MODE_CONFIGS.medium.projectiles, false);
  assert.equal(MODE_CONFIGS.hard.projectiles, true);
  assert.ok(MODE_CONFIGS.easy.failAngle > MODE_CONFIGS.medium.failAngle);
  assert.ok(MODE_CONFIGS.hard.scoreRate > MODE_CONFIGS.easy.scoreRate);
});

test('an unattended inverted object eventually falls', () => {
  const state = createRunState('easy', 42);
  for (let frame = 0; frame < 1200 && !state.failed; frame += 1) {
    stepBalance(state, { x: 0, y: 0 }, 1 / 60);
  }
  assert.equal(state.failed, true);
  assert.equal(state.failureReason, 'tilt');
  assert.ok(state.time > 0.5);
});

test('counter-control keeps EASY stable long enough to build an epic combo', () => {
  const state = createRunState('easy', 103);
  for (let frame = 0; frame < 60 * 42 && !state.failed; frame += 1) {
    const x = clamp(-state.angleX * 1.55 - state.angularVelocityX * 0.52, -1, 1);
    const y = clamp(-state.angleY * 1.55 - state.angularVelocityY * 0.52, -1, 1);
    stepBalance(state, { x, y }, 1 / 60);
  }
  assert.equal(state.failed, false);
  assert.ok(state.stage >= 3, `expected stage 4 or higher, got ${state.stage + 1}`);
  assert.ok(state.score > 10000);
});

test('flow stages follow the declared thresholds', () => {
  for (let index = 0; index < FLOW_STAGES.length; index += 1) {
    assert.equal(stageForFlow(FLOW_STAGES[index].threshold), index);
  }
  assert.equal(stageForFlow(-10), 0);
  assert.equal(stageForFlow(999), FLOW_STAGES.length - 1);
});

test('HARD supports a physical jump arc and side projectiles', () => {
  const state = createRunState('hard', 88);
  state.angleX = 0;
  state.angleY = 0;
  state.angularVelocityX = 0;
  state.angularVelocityY = 0;
  state.projectileTimer = 0;
  let maximumJump = 0;
  let sawJump = false;
  let sawProjectile = false;

  for (let frame = 0; frame < 120; frame += 1) {
    const events = stepBalance(state, { x: 0, y: 0, jump: frame === 0 }, 1 / 60);
    maximumJump = Math.max(maximumJump, state.jumpY);
    sawJump ||= events.some((event) => event.type === 'jump');
    sawProjectile ||= events.some((event) => event.type === 'projectile');
  }

  assert.equal(sawJump, true);
  assert.equal(sawProjectile, true);
  assert.ok(maximumJump >= 0.7);
  assert.equal(state.jumpY, 0);
});

test('impacts disturb the balance and drain flow', () => {
  const state = createRunState('hard', 19);
  state.angularVelocityX = 0;
  state.flow = 24;
  applyImpact(state, -1, 1);
  assert.ok(state.angularVelocityX < -0.9);
  assert.equal(state.flow, 14);
  assert.equal(state.nearSaveArmed, true);
});

test('runs with the same seed and input remain deterministic', () => {
  const first = createRunState('medium', 20260824);
  const second = createRunState('medium', 20260824);
  for (let frame = 0; frame < 360; frame += 1) {
    const input = { x: Math.sin(frame / 33) * 0.08, y: Math.cos(frame / 41) * 0.06 };
    stepBalance(first, input, 1 / 60);
    stepBalance(second, input, 1 / 60);
  }
  assert.deepEqual(serializableState(first), serializableState(second));
});

test('best-run snapshots keep a compact ghost-ready frame stream', () => {
  const state = createRunState('easy', 7);
  state.time = 12.34567;
  state.score = 1234.7;
  state.maxStageReached = 2;
  const frames = Array.from({ length: 5000 }, (_, index) => [index, 0, 0, 0, 0, 0]);
  const snapshot = createRunSnapshot(state, frames);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.mode, 'easy');
  assert.equal(snapshot.time, 12.346);
  assert.equal(snapshot.score, 1235);
  assert.equal(snapshot.maxCombo, 3);
  assert.equal(snapshot.frames.length, 4800);
});

function serializableState(state) {
  return {
    time: state.time,
    score: state.score,
    flow: state.flow,
    stage: state.stage,
    angleX: state.angleX,
    angleY: state.angleY,
    angularVelocityX: state.angularVelocityX,
    angularVelocityY: state.angularVelocityY,
    windX: state.windX,
    windY: state.windY,
    rngState: state.rngState,
    failed: state.failed
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
