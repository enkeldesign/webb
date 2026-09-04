import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  SCORE_FEEDBACK_CHANNEL,
  SCORE_FEEDBACK_COMMIT_INTERVAL_MS,
  SCORE_FEEDBACK_EVENT,
  createScoreFeedback
} from '../turn/scoring/score-feedback.js';

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  toggle(name, force) {
    if (force) this.values.add(name);
    else this.values.delete(name);
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, String(value));
  }

  getPropertyValue(name) {
    return this.values.get(name) || '';
  }
}

class FakeElement {
  constructor() {
    this.hidden = false;
    this.textContent = '';
    this.dataset = {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
  }
}

function makeFixture() {
  const selectors = [
    '[data-score-feedback-state]',
    '[data-score-feedback-label]',
    '[data-score-feedback-current]',
    '[data-score-feedback-multiplier]',
    '[data-score-feedback-total]',
    '[data-score-feedback-meter-fill]',
    '[data-score-feedback-flow-meter-fill]',
    '[data-score-feedback-callout]',
    '[data-score-feedback-callout-label]',
    '[data-score-feedback-callout-score]',
    '[data-score-feedback-announcer]'
  ];
  const elements = new Map(selectors.map((selector) => [selector, new FakeElement()]));
  const root = new FakeElement();
  root.querySelector = (selector) => elements.get(selector) || null;
  return { root, elements };
}

function element(fixture, selector) {
  return fixture.elements.get(selector);
}

const fixture = makeFixture();
const sounds = [];
const feedback = createScoreFeedback({
  root: fixture.root,
  onSound: (type, channel) => sounds.push(`${channel}:${type}`)
});

assert.equal(fixture.root.hidden, true, 'An idle ScoreFeedback root stays out of the HUD');

const driftState = {
  active: true,
  score: 4820,
  unbanked: 1740,
  multiplier: 3,
  intensity: 0.72,
  phase: 'intensify',
  label: 'DRIFT'
};
feedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, driftState, 100);
assert.equal(fixture.root.hidden, false);
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '1,740');
assert.equal(element(fixture, '[data-score-feedback-total]').textContent, '4,820');
assert.equal(element(fixture, '[data-score-feedback-multiplier]').textContent, '×3');
assert.equal(
  element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'),
  '0.72'
);
assert.equal(
  element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-progress'),
  '0',
  'The future FLOW gauge stays dormant while only DRIFT is active'
);
assert.equal(fixture.root.dataset.driftGaugeVisible, 'true');
assert.equal(fixture.root.dataset.flowGaugeVisible, 'false');
assert.equal(fixture.root.dataset.gaugeChannel, 'drift');
assert.equal(fixture.root.dataset.gaugeHeat, 'warm');

driftState.unbanked = 1820;
feedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, driftState, 100 + SCORE_FEEDBACK_COMMIT_INTERVAL_MS / 2);
assert.equal(
  element(fixture, '[data-score-feedback-current]').textContent,
  '1,740',
  'Rapid score ticks are not committed at physics frequency'
);
feedback.commit(100 + SCORE_FEEDBACK_COMMIT_INTERVAL_MS);
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '1,820');

feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.BANK, {
  score: 1820,
  multiplier: 3
}, 300);
assert.equal(element(fixture, '[data-score-feedback-callout-label]').textContent, '✓ BANKED ×3');
assert.equal(element(fixture, '[data-score-feedback-callout-score]').textContent, '+1,820');
assert.equal(element(fixture, '[data-score-feedback-callout]').dataset.event, 'bank');
assert.deepEqual(sounds, ['drift:bank']);

const lowerPriorityAccepted = feedback.publishEvent(
  SCORE_FEEDBACK_CHANNEL.FLOW,
  SCORE_FEEDBACK_EVENT.TECHNIQUE,
  { label: 'BOOST › DRIFT' },
  350
);
assert.equal(lowerPriorityAccepted, false, 'A technique event cannot replace an active release');
assert.equal(element(fixture, '[data-score-feedback-callout]').dataset.event, 'bank');

feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.PERSONAL_BEST, {
  score: 8420
}, 400);
assert.equal(element(fixture, '[data-score-feedback-callout-label]').textContent, 'NEW BEST');
await Promise.resolve();
assert.equal(
  element(fixture, '[data-score-feedback-announcer]').textContent,
  'New drift best.',
  'Higher-priority semantic events may replace an announcement inside the rate limit'
);

const flowState = {
  active: true,
  score: 18420,
  unbanked: 0,
  multiplier: 5.1,
  intensity: 0.84,
  phase: 'intensify',
  label: 'FLOW'
};
feedback.updateState(SCORE_FEEDBACK_CHANNEL.FLOW, flowState, 500);
assert.equal(fixture.root.dataset.channel, 'flow', 'FLOW becomes persistent context when both channels are active');
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '18,420');
assert.equal(
  element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'),
  '0.72',
  'DRIFT keeps its own independent gauge value when FLOW becomes active'
);
assert.equal(
  element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-progress'),
  '0.84',
  'FLOW can drive the same gauge contract independently'
);
assert.equal(fixture.root.dataset.flowGaugeVisible, 'true');
assert.equal(fixture.root.dataset.flowHeat, 'hot');

feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.BANK, {
  label: 'DRIFT +2,840 ×4',
  score: 2840,
  multiplier: 4
}, 3000);
assert.equal(fixture.root.dataset.channel, 'flow');
assert.equal(element(fixture, '[data-score-feedback-callout-label]').textContent, 'DRIFT +2,840 ×4');

feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.DRIFT, false, 3100);
assert.equal(element(fixture, '[data-score-feedback-callout]').hidden, true);
assert.equal(fixture.root.hidden, false, 'Hiding DRIFT presentation leaves active FLOW context visible');
assert.equal(fixture.root.dataset.driftGaugeVisible, 'false');
assert.equal(fixture.root.dataset.flowGaugeVisible, 'true');
assert.equal(feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.BANK, {
  score: 9999
}, 3150), false, 'A hidden channel cannot take presentation priority from a visible channel');
assert.equal(feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.FLOW, SCORE_FEEDBACK_EVENT.TECHNIQUE, {
  label: 'CLEAN LINE'
}, 3160), true);
assert.equal(element(fixture, '[data-score-feedback-callout-label]').textContent, 'CLEAN LINE');
feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.FLOW, false, 3200);
assert.equal(fixture.root.hidden, true, 'Presentation visibility is independent per scoring channel');

feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.FLOW, true, 3300);
feedback.updateState(SCORE_FEEDBACK_CHANNEL.FLOW, flowState, 3400);
feedback.clearChannel(SCORE_FEEDBACK_CHANNEL.DRIFT, 3500);
assert.equal(fixture.root.dataset.channel, 'flow', 'Clearing DRIFT must not reset FLOW');
assert.equal(feedback.inspect().flow.score, 18420);

feedback.reset(4000);
assert.equal(fixture.root.hidden, true);
assert.equal(feedback.inspect().drift.score, 0);
assert.equal(
  element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'),
  '0'
);
assert.equal(
  element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-progress'),
  '0'
);

const [source, css, index, nextIndex, labIndex, main] = await Promise.all([
  fs.readFile(new URL('../turn/scoring/score-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/score-feedback.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(source, /requestAnimationFrame/);
assert.doesNotMatch(source, /createElement|appendChild|replaceChildren/,
  'ScoreFeedback must reuse the fixed document nodes');
assert.match(source, /data-score-feedback-flow-meter-fill/,
  'The shared engine must already understand the optional future FLOW gauge mount');
assert.match(css, /--score-feedback-paper-height: 104px/,
  'Each scoring paper row has a stable gameplay height');
assert.match(css, /--score-feedback-gauge-height:/,
  'The horizontal instrument has an explicit stable height');
assert.match(css, /transform: scaleX\(var\(--score-feedback-progress, 0\)\)/,
  'Score gauges fill horizontally without layout work');
assert.doesNotMatch(css, /transform: scaleY\(var\(--score-feedback-progress, 0\)\)/,
  'The old vertical fill contract is gone');
assert.match(css, /background: linear-gradient\(\s*to right,/,
  'The channel colour also travels along the x-axis');
for (const [mountName, markup] of [
  ['TURN', index],
  ['TURN NEXT', nextIndex],
  ['TURN LAB', labIndex]
]) {
  assert.match(
    markup,
    /data-score-feedback-label>DRIFT<\/span><span>COMBO<\/span>/,
    `${mountName} exposes COMBO vocabulary in accessible markup`
  );
}
assert.match(css, /data-score-channel="flow"/,
  'The reusable horizontal gauge primitive has a FLOW channel treatment ready for #739');
assert.match(css, /top: calc\(var\(--score-feedback-paper-height\) \+ 30px\)/,
  'The future FLOW gauge is aligned to its own fixed paper row');
assert.match(css, /@keyframes turn-score-gauge-rush/,
  'High-intensity scoring keeps a transform-driven peripheral-noise layer');
assert.match(css, /translateX/,
  'Gauge rush/noise follows the horizontal scoring axis');
assert.match(css, /score-feedback-meter::before/,
  'A type-coloured zero remnant survives inside the black track');
assert.doesNotMatch(css, /filter\s*:/,
  'ScoreFeedback buildup avoids filter effects on the low-end hot path');
assert.doesNotMatch(css, /transition:[^;]*(?:width|height|top|left)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(index, /id="scoreFeedback"/);
assert.match(nextIndex, /id="scoreFeedback"/,
  'TURN NEXT must provide the fixed ScoreFeedback DOM expected by the canonical runtime');
assert.match(labIndex, /id="scoreFeedback"/,
  'TURN LAB must provide the fixed ScoreFeedback DOM expected by the canonical runtime');
assert.match(index, /data-score-feedback-announcer role="status" aria-live="polite"/);
assert.doesNotMatch(index, /data-score-feedback-current[^>]*aria-live/);
assert.match(main, /scoreFeedback\.commit\(now\)/,
  'ScoreFeedback commits through TURN\'s existing throttled HUD path');

console.log('TURN shared ScoreFeedback engine regression passed.');
