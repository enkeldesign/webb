import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  DRIFT_ATTACK_MAX_SLIP,
  DRIFT_ATTACK_MIN_SLIP,
  DRIFT_ATTACK_SAMPLE_HZ,
  createDriftAttackScorer,
  driftAngleQuality
} from '../turn/scoring/drift-attack.js';
import {
  DRIFT_RECORDS_STORAGE_KEY,
  getBestDriftRecord,
  saveBestDriftRecord
} from '../turn/scoring/drift-records.js';
import { SCORE_FEEDBACK_EVENT } from '../turn/scoring/score-feedback.js';

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

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function runFor(scorer, seconds, dt, {
  speed = 24,
  slip = radians(58),
  offRoad = false,
  collided = false,
  startAt = 0
} = {}) {
  let now = startAt;
  const steps = Math.ceil(seconds / dt);
  for (let index = 0; index < steps; index += 1) {
    now += dt * 1000;
    scorer.advance(dt, now, speed, slip, offRoad, collided && index === 0, true);
  }
  return now;
}

assert.equal(DRIFT_ATTACK_SAMPLE_HZ, 12);
assert.equal(driftAngleQuality(DRIFT_ATTACK_MIN_SLIP - 0.001), 0);
assert.equal(driftAngleQuality(radians(55)), 1);
assert.ok(driftAngleQuality(radians(90)) > 0.8);
assert.equal(driftAngleQuality(DRIFT_ATTACK_MAX_SLIP), 0);

const events = [];
const scorer = createDriftAttackScorer({
  onEvent: (type, detail) => events.push({ type, detail })
});
scorer.beginLap(0);
let now = runFor(scorer, 2, 1 / 60);
assert.ok(scorer.inspect().unbanked > 0, 'Qualifying speed and slip build unbanked score');
assert.ok(scorer.inspect().sampleCount >= 23 && scorer.inspect().sampleCount <= 25,
  'The scorer samples near 12 Hz even when the physics loop runs at 60 Hz');
assert.equal(events[0].type, SCORE_FEEDBACK_EVENT.BUILD);

now = runFor(scorer, 0.45, 1 / 60, { speed: 24, slip: radians(4), startAt: now });
const firstBank = events.find((event) => event.type === SCORE_FEEDBACK_EVENT.BANK);
assert.ok(firstBank?.detail.score > 0);
assert.equal(scorer.inspect().lapScore, firstBank.detail.score);
assert.equal(scorer.inspect().unbanked, 0);

now = runFor(scorer, 0.55, 1 / 60, { speed: 24, slip: radians(-62), startAt: now });
assert.equal(scorer.inspect().multiplier, 2, 'An opposite linked drift increases the multiplier');
assert.ok(events.some((event) =>
  event.type === SCORE_FEEDBACK_EVENT.MILESTONE && event.detail.multiplier === 2
));
const bankedBeforeLoss = scorer.inspect().lapScore;
now = runFor(scorer, 0.1, 1 / 60, {
  speed: 24,
  slip: radians(-62),
  collided: true,
  startAt: now
});
assert.ok(events.some((event) => event.type === SCORE_FEEDBACK_EVENT.LOSS));
assert.equal(scorer.inspect().lapScore, bankedBeforeLoss,
  'A failed drift loses only unbanked score');

const lapResult = scorer.completeLap(now);
assert.equal(lapResult.score, bankedBeforeLoss);
assert.equal(lapResult.bankCount, 1);
assert.equal(scorer.inspect().lapScore, 0, 'Completing a lap starts a fresh DRIFT tally');

const continuityEvents = [];
const continuityStates = [];
const continuityScorer = createDriftAttackScorer({
  onEvent: (type, detail) => continuityEvents.push({ type, detail }),
  onState: (snapshot) => continuityStates.push({ ...snapshot })
});
continuityScorer.beginLap(0);
let continuityNow = runFor(continuityScorer, 0.9, 1 / 60);
continuityNow = runFor(continuityScorer, 0.4, 1 / 60, {
  slip: radians(4),
  startAt: continuityNow
});
continuityNow = runFor(continuityScorer, 0.9, 1 / 60, {
  slip: radians(-62),
  startAt: continuityNow
});
const beforeFinish = continuityScorer.inspect();
assert.equal(beforeFinish.drifting, true);
assert.equal(beforeFinish.multiplier, 2,
  'The continuity fixture must cross the line in an active x2 drift');
assert.ok(beforeFinish.unbanked > 0);
assert.ok(beforeFinish.feedback.intensity > 0);
const finishResult = continuityScorer.completeLap(continuityNow);
const afterFinish = continuityScorer.inspect();
assert.ok(finishResult.score >= beforeFinish.lapScore + beforeFinish.unbanked - 1,
  'The completed lap must bank the active DRIFT earned up to the finish crossing');
assert.equal(finishResult.bankCount, 2,
  'The finish split counts as a bank for the completed lap without ending the live drift');
assert.equal(afterFinish.lapScore, 0, 'The new lap DRIFT total starts from zero');
assert.equal(afterFinish.unbanked, 0, 'The carried drift starts a fresh per-lap segment at the line');
assert.equal(afterFinish.drifting, true, 'Crossing the line must not end an active drift');
assert.equal(afterFinish.multiplier, beforeFinish.multiplier, 'DRIFT combo must survive the lap boundary');
assert.equal(afterFinish.driftSeconds, beforeFinish.driftSeconds,
  'Ongoing drift duration must survive so post-line scoring keeps the same build rate');
assert.equal(afterFinish.feedback.active, true);
assert.equal(afterFinish.feedback.score, 0);
assert.equal(afterFinish.feedback.unbanked, 0);
assert.equal(afterFinish.feedback.intensity, beforeFinish.feedback.intensity,
  'The visible DRIFT gauge intensity must not collapse at the finish line');
assert.ok(continuityEvents.some((event) =>
  event.type === SCORE_FEEDBACK_EVENT.BANK
    && event.detail.reason === 'lap'
    && event.detail.announce === false
), 'The finish split must expose a silent semantic DRIFT bank for FLOW and lap accounting');
continuityNow = runFor(continuityScorer, 0.2, 1 / 60, {
  slip: radians(-62),
  startAt: continuityNow
});
assert.ok(continuityScorer.inspect().unbanked > 0,
  'The continuing drift must immediately earn points for the new lap');
assert.equal(continuityScorer.inspect().multiplier, 2);
assert.ok(continuityScorer.inspect().driftSeconds > beforeFinish.driftSeconds,
  'The ongoing drift must continue from its pre-line duration rather than restart its intensity curve');
assert.equal(continuityStates.at(-1)?.active, true);

const hysteresisScorer = createDriftAttackScorer();
hysteresisScorer.beginLap(0);
let hysteresisNow = runFor(hysteresisScorer, 1, 1 / 60);
const scoreBeforeGreyBand = hysteresisScorer.inspect().unbanked;
hysteresisNow = runFor(hysteresisScorer, 0.5, 1 / 60, {
  slip: radians(14),
  startAt: hysteresisNow
});
assert.equal(hysteresisScorer.inspect().drifting, true,
  'The 10–18 degree hysteresis band must not flicker a live drift into a bank');
assert.equal(hysteresisScorer.inspect().unbanked, scoreBeforeGreyBand,
  'The hysteresis band preserves, but does not add to, unbanked score');
runFor(hysteresisScorer, 0.4, 1 / 60, {
  slip: radians(4),
  startAt: hysteresisNow
});
assert.equal(hysteresisScorer.inspect().drifting, false,
  'A genuinely settled car banks after the release delay');
assert.ok(hysteresisScorer.inspect().lapScore > 0);

const expiryStates = [];
const expiryScorer = createDriftAttackScorer({
  onState: (snapshot) => expiryStates.push({ ...snapshot })
});
expiryScorer.beginLap(0);
let expiryNow = runFor(expiryScorer, 0.8, 1 / 60);
expiryNow = runFor(expiryScorer, 0.4, 1 / 60, {
  slip: radians(4),
  startAt: expiryNow
});
expiryNow = runFor(expiryScorer, 0.55, 1 / 60, {
  slip: radians(-62),
  startAt: expiryNow
});
assert.equal(expiryScorer.inspect().multiplier, 2,
  'A linked opposite drift reaches x2 before the presentation-expiry check');
expiryNow = runFor(expiryScorer, 0.4, 1 / 60, {
  slip: radians(4),
  startAt: expiryNow
});
const linkedExpiryAt = expiryScorer.inspect().chainExpiresAt;
assert.ok(linkedExpiryAt > expiryNow,
  'Banking an x2 drift keeps the chain alive for the normal link window');
expiryScorer.advance(1 / 60, linkedExpiryAt + 1, 5, 0, false, false, true);
assert.equal(expiryScorer.inspect().multiplier, 1,
  'DRIFT combo state returns to x1 when the chain window expires');
assert.equal(expiryStates.at(-1)?.multiplier, 1,
  'Chain expiry publishes the x1 state so a held-open HUD gauge can retract promptly');
assert.equal(expiryStates.at(-1)?.active, false);
assert.equal(expiryStates.at(-1)?.intensity, 0);

function simulatedScore(dt) {
  const candidate = createDriftAttackScorer();
  candidate.beginLap(0);
  let timestamp = runFor(candidate, 4, dt);
  timestamp = runFor(candidate, 0.5, dt, { slip: radians(2), startAt: timestamp });
  return candidate.completeLap(timestamp).score;
}

const scoreAt60Fps = simulatedScore(1 / 60);
const scoreAt23Fps = simulatedScore(1 / 23);
assert.ok(Math.abs(scoreAt60Fps - scoreAt23Fps) / scoreAt60Fps < 0.035,
  `Elapsed-time scoring should remain stable as rendering slows (${scoreAt60Fps} vs ${scoreAt23Fps})`);

const idleScorer = createDriftAttackScorer();
idleScorer.beginLap(0);
runFor(idleScorer, 30, 1 / 60, { speed: 5, slip: radians(60) });
assert.equal(idleScorer.inspect().sampleCount, 0, 'Below qualification speed the scorer sleeps');

const offRoadScorer = createDriftAttackScorer();
offRoadScorer.beginLap(0);
runFor(offRoadScorer, 1, 1 / 60, { speed: 26, slip: radians(60), offRoad: true });
assert.equal(offRoadScorer.inspect().unbanked, 0,
  'A qualifying-looking slide cannot begin scoring while off road');

const storage = new MemoryStorage();
const firstSave = saveBestDriftRecord({
  trackId: 'mountain',
  score: 8420,
  carId: 'sedan-sports',
  lapTime: 47.2,
  hitAt: 1000
}, storage);
assert.equal(firstSave.isNewBest, true);
assert.deepEqual(getBestDriftRecord('mountain', storage), {
  score: 8420,
  carId: 'sedan-sports',
  hitAt: 1000,
  lapTime: 47.2
});
const slowerSave = saveBestDriftRecord({
  trackId: 'mountain',
  score: 7910,
  carId: 'classic',
  lapTime: 45,
  hitAt: 2000
}, storage);
assert.equal(slowerSave.saved, false);
assert.equal(getBestDriftRecord('mountain', storage).score, 8420);
assert.equal(JSON.parse(storage.getItem(DRIFT_RECORDS_STORAGE_KEY)).tracks.mountain.score, 8420);
assert.deepEqual(saveBestDriftRecord({ trackId: 'harbor', score: 1200 }, null), {
  record: null,
  isNewBest: false,
  saved: false
}, 'Unavailable storage must not report a phantom persisted best');

const source = await fs.readFile(new URL('../turn/scoring/drift-attack.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /requestAnimationFrame|querySelector|createElement|localStorage/);
assert.doesNotMatch(source, /syncFeedback\(\s*\{/,
  'The 10–15 Hz sample path must reuse its presentation snapshot without object churn');
assert.doesNotMatch(source, /driftHeld|boostActive|shiftActive|overcharge/i,
  'Inputs and helper systems must not score directly');

console.log('TURN DRIFT ATTACK core and per-track record regressions passed.');
