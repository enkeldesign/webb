import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  FLOW_CHAIN_WINDOW_MS,
  createFlowScorer
} from '../turn/scoring/flow.js';
import {
  FLOW_HUD_STORAGE_KEY,
  createFlowRuntime
} from '../turn/scoring/flow-runtime.js';
import {
  FLOW_RECORDS_STORAGE_KEY,
  getBestFlowRecord
} from '../turn/scoring/flow-records.js';

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

class TurnEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
    this.events = [];
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    this.events.push(event);
    for (const listener of this.listeners.get(event.type) || []) listener(event);
    return true;
  }

  emit(type, detail) {
    this.dispatchEvent(new TurnEvent(type, { detail }));
  }
}

function makeFeedback() {
  return {
    visible: false,
    states: [],
    events: [],
    updateState(channel, snapshot, now) {
      this.states.push({ channel, snapshot: { ...snapshot, tokens: [...snapshot.tokens] }, now });
    },
    setChannelVisible(_channel, visible) {
      this.visible = visible;
    },
    clearChannel() {},
    publishEvent(channel, type, detail, now) {
      this.events.push({ channel, type, detail, now });
    }
  };
}

const scorer = createFlowScorer();
scorer.beginLap(0);
assert.equal(scorer.acceptTechnique({ technique: 'shift', basePoints: 0, now: 10 }), null,
  'A button event with no verified outcome cannot score');
const drift = scorer.acceptTechnique({ technique: 'drift', token: 'DRIFT', basePoints: 100, now: 100 });
const boost = scorer.acceptTechnique({ technique: 'boost', token: 'BOOST', basePoints: 100, now: 300 });
const repeatedBoost = scorer.acceptTechnique({ technique: 'boost', token: 'BOOST', basePoints: 100, now: 500 });
assert.equal(drift.awarded, 100);
assert.ok(boost.awarded > drift.awarded, 'Variety builds the FLOW multiplier');
assert.ok(repeatedBoost.awarded < boost.awarded / 2, 'Repeated techniques have sharply diminished value');
assert.deepEqual(scorer.inspect().tokens.slice(-3), ['DRIFT', 'BOOST', 'BOOST']);
assert.equal(scorer.expireChain(500 + FLOW_CHAIN_WINDOW_MS), true);
assert.equal(scorer.inspect().multiplier, 1);
assert.ok(scorer.inspect().lapScore > 0, 'A broken chain never erases banked FLOW score');
const firstLap = scorer.completeLap(6000);
assert.ok(firstLap.score > 0);
assert.ok(scorer.acceptTechnique({ technique: 'drift', token: 'DRIFT', basePoints: 50, now: 6100 }),
  'Completing one lap must immediately arm FLOW for the next continuous lap');

const originalCustomEvent = globalThis.CustomEvent;
globalThis.CustomEvent = TurnEvent;
try {
  const state = { lapActive: true, trackId: 'mountain', vehicleId: 'sedan' };
  const storage = new MemoryStorage();
  const eventTarget = new EventTargetStub();
  const feedback = makeFeedback();
  const timers = [];
  const runtime = createFlowRuntime({
    state,
    storage,
    eventTarget,
    scoreFeedback: feedback,
    isUnlocked: () => true,
    wallClock: () => 123456,
    setTimer(callback, delay) {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimer() {}
  });
  runtime.beginLap(0);

  eventTarget.emit('turn:shift-change', {
    intentional: true,
    active: true,
    amount: 1,
    gainKeys: ['drift', 'control', 'boostDuration'],
    lossKeys: ['speed', 'acceleration', 'boostPower'],
    boostCharge: 0,
    at: 100
  });
  assert.equal(runtime.scorer.inspect().lapScore, 0, 'SHIFT alone scores zero');
  eventTarget.emit('turn:drift-score-event', { type: 'build', at: 250 });
  eventTarget.emit('turn:drive-technique-state', { lockRequested: true, at: 400 });
  eventTarget.emit('turn:drift-score-event', {
    type: 'bank',
    score: 900,
    duration: 2.4,
    reason: 'exit',
    at: 2600
  });
  const afterDrift = runtime.scorer.inspect();
  assert.ok(afterDrift.lapScore > 0);
  assert.deepEqual(afterDrift.tokens.slice(-4), ['SHIFT', 'LOCK', 'DRIFT', 'EXIT'],
    'A proven empty-tank SHIFT into a controlled LOCK drift scores even when the drift outlasts the causal window');

  eventTarget.emit('turn:shift-change', {
    intentional: true,
    active: false,
    amount: 1,
    gainKeys: ['acceleration', 'boostPower', 'boostDuration'],
    at: 2700
  });
  const beforeOutcome = runtime.scorer.inspect().lapScore;
  eventTarget.emit('turn:shift-outcome', { useful: true, speedGain: 2.5, at: 3300 });
  assert.ok(runtime.scorer.inspect().lapScore > beforeOutcome,
    'SHIFTing out of a drift is rewarded after its acceleration gain is observed');

  const beforeBoost = runtime.scorer.inspect().lapScore;
  eventTarget.emit('turn:boost-outcome', {
    useful: true,
    speedGain: 4,
    duration: 1.1,
    overchargeSpent: 0.2,
    at: 3900
  });
  eventTarget.emit('turn:overcharge-catch', { amount: 0.45, at: 4200 });
  assert.ok(runtime.scorer.inspect().lapScore > beforeBoost);

  eventTarget.emit('turn:drift-score-event', { type: 'build', at: 4300 });
  const beforeMidDriftShift = runtime.scorer.inspect().lapScore;
  eventTarget.emit('turn:shift-change', {
    intentional: true,
    active: true,
    amount: 1,
    gainKeys: ['drift', 'control', 'boostDuration'],
    lossKeys: ['speed', 'acceleration', 'boostPower'],
    boostCharge: 0,
    zone: 'drift',
    at: 4400
  });
  assert.equal(runtime.scorer.inspect().lapScore, beforeMidDriftShift,
    'SHIFTing during a drift still waits for a meaningful result');
  eventTarget.emit('turn:drift-score-event', {
    type: 'bank',
    score: 1200,
    duration: 2.6,
    reason: 'exit',
    at: 7000
  });
  assert.ok(runtime.scorer.inspect().lapScore > beforeMidDriftShift,
    'A useful +DRIFT/+CONTROL/+BOOST TANK change during a banked drift contributes to FLOW');

  eventTarget.emit('turn:shift-change', {
    intentional: true,
    active: false,
    amount: 1,
    gainKeys: ['speed', 'acceleration', 'boostPower'],
    lossKeys: ['control', 'drift', 'boostDuration'],
    boostCharge: 0.8,
    overcharge: 0.35,
    zone: 'gas',
    at: 7100
  });
  eventTarget.emit('turn:drive-technique-state', {
    zone: 'boost',
    previousZone: 'gas',
    at: 7200
  });
  const beforeContextualBoost = runtime.scorer.inspect().lapScore;
  eventTarget.emit('turn:boost-outcome', {
    useful: true,
    speedGain: 5,
    duration: 2.3,
    overchargeSpent: 0.3,
    at: 9500
  });
  assert.ok(runtime.scorer.inspect().lapScore > beforeContextualBoost,
    'A SHIFT captured on BOOST entry remains eligible through a useful boost longer than the causal window');
  assert.ok(eventTarget.events.some((event) => (
    event.type === 'turn:flow-score-event'
      && event.detail?.technique === 'shift'
      && event.detail?.outcome === 'drift-exit-overcharge-boost'
  )), 'FLOW exposes the proven SHIFT/OVERCHARGE/BOOST link as a semantic score event');

  runtime.setHudVisible(false, { now: 10000 });
  assert.equal(storage.getItem(FLOW_HUD_STORAGE_KEY), 'off');
  const hiddenCommitCount = feedback.states.length;
  eventTarget.emit('turn:boost-outcome', {
    useful: true,
    speedGain: 3,
    duration: 1,
    at: 10300
  });
  assert.equal(feedback.states.length, hiddenCommitCount,
    'Hidden FLOW presentation does not stop semantic scoring or perform HUD commits');

  const result = runtime.completeLap({ now: 11000, time: 52, valid: true, ranked: true });
  assert.ok(result.score > 0);
  assert.equal(result.newBest, true);
  assert.equal(result.maxMultiplier > 1, true);
  assert.equal(getBestFlowRecord('mountain', storage).score, result.score);
  assert.equal(getBestFlowRecord('mountain', storage).hitAt, 123456);
  assert.ok(JSON.parse(storage.getItem(FLOW_RECORDS_STORAGE_KEY)).tracks.mountain);
  assert.ok(eventTarget.events.some((event) => event.type === 'turn:flow-lap-result'));
} finally {
  globalThis.CustomEvent = originalCustomEvent;
}

const [flowSource, runtimeSource, controlsSource] = await Promise.all([
  fs.readFile(new URL('../turn/scoring/flow.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/flow-runtime.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/gameplay-controls.js', import.meta.url), 'utf8')
]);
assert.doesNotMatch(flowSource, /requestAnimationFrame|setInterval|querySelector|localStorage/);
assert.doesNotMatch(runtimeSource, /requestAnimationFrame|setInterval|driftSlipAngle|velocity|heading/,
  'FLOW is event-driven and never re-analyzes vehicle drift');
assert.match(runtimeSource, /turn:drift-score-event/);
assert.match(runtimeSource, /turn:shift-outcome/);
assert.match(controlsSource, /turn:boost-outcome/);
assert.match(controlsSource, /turn:overcharge-catch/);
assert.match(controlsSource, /reason === 'lap-started' \|\| reason === 'lap-completed'[\s\S]*resetScoringOutcomeTracking\(\{ continueBoost: true \}\)/,
  'Semantic SHIFT and Boost outcomes must be split at lap boundaries');
assert.doesNotMatch(controlsSource, /advanceShiftOutcome\(now\)/,
  'SHIFT outcome checks must use short causal timers rather than a per-frame poll');

console.log('TURN FLOW scoring, SHIFT outcomes, records and event-driven regressions passed.');
