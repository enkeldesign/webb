import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

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
    dismissed: [],
    activeEvent: { active: false },
    updateState(channel, state, now) {
      this.states.push({ channel, score: state.score, unbanked: state.unbanked, now });
    },
    publishEvent(channel, type, detail, now) {
      this.events.push({ channel, type, detail: { ...detail }, now });
      this.activeEvent = { active: true, channel, type };
    },
    setChannelVisible(_channel, visible) {
      this.visible = visible;
    },
    clearChannel(channel) {
      this.cleared.push(channel);
      if (this.activeEvent.channel === channel) this.activeEvent = { active: false };
    },
    dismissEvent(channel) {
      this.dismissed.push(channel);
      if (this.activeEvent.channel === channel) this.activeEvent = { active: false };
    },
    inspect() {
      return { activeEvent: { ...this.activeEvent } };
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
  state.offRoad = false;
  state.collided = false;
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

const visibleStorage = new MemoryStorage();
const visibleFeedback = makeFeedback();
const visibleState = {
  speed: 0,
  driftSlipAngle: 0,
  offRoad: false,
  collided: false,
  lapActive: false,
  trackId: 'harbor',
  vehicleId: 'vintage-racer'
};
const visibleRuntime = createDriftAttackRuntime({
  state: visibleState,
  scoreFeedback: visibleFeedback,
  storage: visibleStorage,
  eventTarget: new EventTargetStub(),
  isUnlocked: () => true,
  wallClock: () => 654321
});

const visibleFirstLap = scoreLap(visibleRuntime, visibleState);
const visibleFirstResult = visibleRuntime.completeLap({
  now: visibleFirstLap.now,
  time: visibleFirstLap.time,
  valid: true,
  ranked: true
});
assert.equal(visibleFirstResult.newBest, true);
assert.ok(visibleFeedback.events.some((event) => event.type === 'personal-best'),
  'A new DRIFT PB keeps its separate pink celebration');
const neutralBank = visibleFeedback.events.find((event) => event.type === 'bank');
assert.equal(neutralBank?.detail.label, '✓ BANKED',
  'Neutral ×1 must not spend release emphasis on the default multiplier');

const finishCelebrationsBefore = visibleFeedback.events.filter((event) =>
  event.type === 'personal-best' || event.type === 'lap-result'
).length;
const visibleSecondLap = scoreLap(visibleRuntime, visibleState, visibleFirstLap.now + 1000);
const visibleSecondResult = visibleRuntime.completeLap({
  now: visibleSecondLap.now,
  time: visibleSecondLap.time,
  valid: true,
  ranked: true
});
assert.equal(visibleSecondResult.newBest, false);
assert.equal(visibleFeedback.events.filter((event) =>
  event.type === 'personal-best' || event.type === 'lap-result'
).length, finishCelebrationsBefore,
'An ordinary lap must use the yellow lap card without a duplicate pink DRIFT LAP card');

let recoveryNow = visibleSecondLap.now + 2000;
visibleRuntime.beginLap(recoveryNow);
visibleState.speed = 25;
visibleState.driftSlipAngle = radians(60);
visibleState.collided = false;
for (let index = 0; index < 30; index += 1) {
  recoveryNow += 1000 / 60;
  visibleRuntime.advance(1 / 60, recoveryNow);
}
visibleState.collided = true;
for (let index = 0; index < 8; index += 1) {
  recoveryNow += 1000 / 60;
  visibleRuntime.advance(1 / 60, recoveryNow);
}
visibleState.collided = false;
assert.ok(visibleFeedback.events.some((event) => event.type === 'loss'));
const dismissalsAfterLoss = visibleFeedback.dismissed.length;
for (let index = 0; index < 8; index += 1) {
  recoveryNow += 1000 / 60;
  visibleRuntime.advance(1 / 60, recoveryNow);
}
assert.ok(visibleFeedback.dismissed.length > dismissalsAfterLoss,
  'Starting a fresh drift must dismiss stale LOSS feedback without clearing the persistent score row');

const failingStorage = {
  getItem() {
    return null;
  },
  setItem() {
    throw new Error('storage unavailable');
  }
};
const failingRuntime = createDriftAttackRuntime({
  state: { ...visibleState },
  scoreFeedback: makeFeedback(),
  storage: failingStorage,
  eventTarget: new EventTargetStub(),
  isUnlocked: () => true
});
assert.equal(failingRuntime.setHudVisible(false, { now: 10 }), false,
  'A failed persistence write is still reported to Settings');
assert.equal(failingRuntime.isHudVisible(), false,
  'The current session must still honor the HUD visibility choice when persistence fails');

const [scorekeeperRecordsSource, flowScorerSource] = await Promise.all([
  fs.readFile(new URL('../turn/scoring/scorekeeper-records.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/flow.js', import.meta.url), 'utf8')
]);
assert.match(scorekeeperRecordsSource, /data-score-feedback-flow-techniques[\s\S]*remove\?\.\(\)/,
  'The unreadable rolling FLOW token strip must be removed before ScoreFeedback can retain its DOM nodes');
assert.match(scorekeeperRecordsSource, /getBestDriftRecord/);
assert.match(scorekeeperRecordsSource, /getBestFlowRecord/);
assert.match(scorekeeperRecordsSource, /data-score-feedback-\$\{channel\}-\$\{kind\}/,
  'DRIFT and FLOW LAST/BEST hooks must use the shared channel/kind builder');
assert.match(scorekeeperRecordsSource, /makeReadout\(documentRef, channel, 'last', 'LAST'\)/);
assert.match(scorekeeperRecordsSource, /makeReadout\(documentRef, channel, 'best', 'BEST'\)/);
assert.match(scorekeeperRecordsSource, /score-feedback-history/,
  'LAST and BEST must share a stable secondary scorekeeper row beneath the active LAP score');
assert.match(scorekeeperRecordsSource, /setLast\(drift\.last, event\?\.detail\?\.score\)/);
assert.match(scorekeeperRecordsSource, /setLast\(flow\.last, event\?\.detail\?\.score\)/);
assert.match(scorekeeperRecordsSource, /clearLastLap\(\)[\s\S]*race-started/,
  'LAST is session context and must clear when a race session is restarted');
assert.match(scorekeeperRecordsSource, /--score-feedback-paper-width: clamp\(148px, 18\.5vw, 198px\)/,
  'The scorekeeper paper should be narrower than the original 226px maximum');
assert.match(scorekeeperRecordsSource, /font-size: clamp\(1\.22rem, 3vw, 1\.78rem\)/,
  'The live score should be reduced so LAP, LAST and BEST gain hierarchy');
assert.match(scorekeeperRecordsSource, /turn:drift-lap-result/);
assert.match(scorekeeperRecordsSource, /turn:flow-lap-result/);
assert.doesNotMatch(scorekeeperRecordsSource, /requestAnimationFrame|setInterval|setTimeout/,
  'LAST/BEST are lifecycle/event-driven and must not introduce another racing-loop or polling path');
assert.match(flowScorerSource, /feedbackState\.tokens\.includes/,
  'FLOW must retain its tiny internal token history because repetition/variety is scoring logic, not HUD decoration');

console.log('TURN DRIFT ATTACK runtime, hidden-HUD and LAP/LAST/BEST scorekeeper regressions passed.');
