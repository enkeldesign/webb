import assert from 'node:assert/strict';

import {
  DRIFT_HUD_STORAGE_KEY,
  createDriftAttackRuntime,
  driftHudVisible
} from '../turn/scoring/drift-attack-runtime.js';

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
}

function makeFeedback() {
  return {
    visible: true,
    states: [],
    events: [],
    cleared: [],
    updateState(channel, state, now) {
      this.states.push({ channel, score: state.score, unbanked: state.unbanked, now });
    },
    publishEvent(channel, type, detail, now) {
      this.events.push({ channel, type, detail: { ...detail }, now });
    },
    setChannelVisible(_channel, visible) {
      this.visible = visible;
    },
    clearChannel(channel) {
      this.cleared.push(channel);
    }
  };
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function scoreLap(runtime, state, startAt = 0) {
  runtime.beginLap(startAt);
  let now = startAt;
  state.lapActive = true;
  state.speed = 25;
  state.driftSlipAngle = radians(60);
  for (let index = 0; index < 180; index += 1) {
    now += 1000 / 60;
    runtime.advance(1 / 60, now);
  }
  state.driftSlipAngle = radians(3);
  for (let index = 0; index < 24; index += 1) {
    now += 1000 / 60;
    runtime.advance(1 / 60, now);
  }
  return { now, time: (now - startAt) / 1000 };
}

const storage = new MemoryStorage();
const eventTarget = new EventTargetStub();
const feedback = makeFeedback();
const state = {
  speed: 0,
  driftSlipAngle: 0,
  offRoad: false,
  collided: false,
  lapActive: false,
  trackId: 'mountain',
  vehicleId: 'sedan-sports'
};

const runtime = createDriftAttackRuntime({
  state,
  scoreFeedback: feedback,
  storage,
  eventTarget,
  isUnlocked: () => true,
  wallClock: () => 123456
});

assert.equal(runtime.isEnabled(), true);
assert.equal(runtime.isHudVisible(), true);
assert.equal(driftHudVisible(storage), true);
assert.equal(runtime.setHudVisible(false, { now: 10 }), true);
assert.equal(storage.getItem(DRIFT_HUD_STORAGE_KEY), 'off');
assert.equal(feedback.visible, false);
const hiddenStateCommits = feedback.states.length;
const hiddenPresentationEvents = feedback.events.length;

const firstLap = scoreLap(runtime, state);
const firstResult = runtime.completeLap({
  now: firstLap.now,
  time: firstLap.time,
  valid: true,
  ranked: true
});
assert.ok(firstResult.score > 0, 'Scoring continues while the live HUD is hidden');
assert.equal(firstResult.newBest, true);
assert.equal(firstResult.bestScore, firstResult.score);
assert.equal(runtime.getBestRecord('mountain').carId, 'sedan-sports');
assert.equal(runtime.getBestRecord('mountain').hitAt, 123456);
assert.equal(feedback.states.length, hiddenStateCommits,
  'Hidden-HUD scoring must not perform numeric presentation commits');
assert.equal(feedback.events.length, hiddenPresentationEvents,
  'Hidden-HUD scoring must not send transient presentation events');
assert.ok(eventTarget.events.some((event) => event.type === 'turn:drift-score-event'));
assert.ok(eventTarget.events.some((event) => event.type === 'turn:drift-lap-result'));

const secondLap = scoreLap(runtime, state, firstLap.now + 1000);
const unrankedResult = runtime.completeLap({
  now: secondLap.now,
  time: secondLap.time,
  valid: true,
  ranked: false
});
assert.equal(unrankedResult.eligible, false);
assert.equal(unrankedResult.saved, false);
assert.equal(runtime.getBestRecord('mountain').score, firstResult.score,
  'An unranked car cannot replace the persisted DRIFT best');

let unlocked = false;
const dormantFeedback = makeFeedback();
const dormant = createDriftAttackRuntime({
  state: { ...state, lapActive: true },
  scoreFeedback: dormantFeedback,
  storage: new MemoryStorage(),
  eventTarget: new EventTargetStub(),
  isUnlocked: () => unlocked
});
assert.equal(dormant.isEnabled(), false);
assert.equal(dormant.advance(1, 1000), false);
assert.equal(dormant.scorer.inspect().sampleCount, 0, 'Locked DRIFT processing remains dormant');
unlocked = true;
assert.equal(dormant.refreshEntitlement(2000), true);
assert.equal(dormantFeedback.visible, true);

console.log('TURN DRIFT ATTACK runtime, hidden-HUD and dormant-lock regressions passed.');
