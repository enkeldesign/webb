import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  SCORE_FEEDBACK_CHANNEL,
  SCORE_FEEDBACK_COMMIT_INTERVAL_MS,
  SCORE_FEEDBACK_EVENT,
  createScoreFeedback
} from '../turn/scoring/score-feedback.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) { if (force) this.values.add(name); else this.values.delete(name); }
  remove(...names) { for (const name of names) this.values.delete(name); }
  contains(name) { return this.values.has(name); }
}

class FakeStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
  getPropertyValue(name) { return this.values.get(name) || ''; }
}

class FakeElement {
  constructor() {
    this.hidden = false;
    this.textContent = '';
    this.dataset = {};
    this.style = new FakeStyle();
    this.classList = new FakeClassList();
    this.children = [];
  }
  querySelectorAll(selector) { return selector === 'span' ? this.children : []; }
}

function makeFixture() {
  const selectors = [
    '[data-score-feedback-drift-readout]',
    '[data-score-feedback-state]',
    '[data-score-feedback-label]',
    '[data-score-feedback-current]',
    '[data-score-feedback-multiplier]',
    '[data-score-feedback-total]',
    '[data-score-feedback-meter-fill]',
    '[data-score-feedback-flow-meter-fill]',
    '[data-score-feedback-flow-readout]',
    '[data-score-feedback-flow-state]',
    '[data-score-feedback-flow-current]',
    '[data-score-feedback-flow-multiplier]',
    '[data-score-feedback-flow-total]',
    '[data-score-feedback-flow-techniques]',
    '[data-score-feedback-drift-callout]',
    '[data-score-feedback-drift-callout-label]',
    '[data-score-feedback-drift-callout-score]',
    '[data-score-feedback-flow-callout]',
    '[data-score-feedback-flow-callout-label]',
    '[data-score-feedback-flow-callout-score]',
    '[data-score-feedback-announcer]'
  ];
  const elements = new Map(selectors.map((selector) => [selector, new FakeElement()]));
  elements.get('[data-score-feedback-flow-techniques]').children = Array.from({ length: 5 }, () => new FakeElement());
  const root = new FakeElement();
  root.querySelector = (selector) => elements.get(selector) || null;
  return { root, elements };
}

function element(fixture, selector) { return fixture.elements.get(selector); }

const fixture = makeFixture();
const sounds = [];
const feedback = createScoreFeedback({
  root: fixture.root,
  onSound: (type, channel) => sounds.push(`${channel}:${type}`)
});

assert.equal(fixture.root.hidden, true, 'An idle ScoreFeedback root stays out of the HUD');
feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.DRIFT, true, 0);
assert.equal(fixture.root.hidden, false, 'An available scoring row remains visible at zero');
assert.equal(element(fixture, '[data-score-feedback-state]').hidden, false);
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '0');
assert.equal(fixture.root.dataset.driftGaugeVisible, 'true');
assert.equal(fixture.root.dataset.driftGaugeExtended, 'false', 'An available zero-state DRIFT row keeps its paper but retracts its gauge');
assert.equal(fixture.root.dataset.driftComboTier, '1');
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-gauge-fill-a'), 'hsl(195 44% 50%)', 'DRIFT starts with a deliberately muted cyan at x1');

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
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0.72');
assert.equal(element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0', 'The FLOW gauge stays dormant while only DRIFT is active');
assert.equal(fixture.root.dataset.driftGaugeVisible, 'true');
assert.equal(fixture.root.dataset.driftGaugeExtended, 'true', 'The DRIFT gauge extends as soon as it has a non-zero fill');
assert.equal(fixture.root.dataset.driftComboTier, '3');
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-gauge-fill-a'), 'hsl(195 60% 50%)', 'DRIFT cyan gains saturation at each higher combo tier');
assert.equal(fixture.root.dataset.flowGaugeVisible, 'false');
assert.equal(fixture.root.dataset.flowGaugeExtended, 'false');
assert.equal(fixture.root.dataset.gaugeChannel, 'drift');
assert.equal(fixture.root.dataset.gaugeHeat, 'warm');

driftState.unbanked = 1820;
feedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, driftState, 100 + SCORE_FEEDBACK_COMMIT_INTERVAL_MS / 2);
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '1,740', 'Rapid score ticks are not committed at physics frequency');
feedback.commit(100 + SCORE_FEEDBACK_COMMIT_INTERVAL_MS);
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '1,820');

feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.BANK, { score: 1820, multiplier: 3 }, 300);
assert.equal(element(fixture, '[data-score-feedback-drift-callout-label]').textContent, '✓ BANKED ×3');
assert.equal(element(fixture, '[data-score-feedback-drift-callout-score]').textContent, '+1,820');
assert.equal(element(fixture, '[data-score-feedback-drift-callout]').dataset.event, 'bank');
assert.equal(element(fixture, '[data-score-feedback-flow-callout]').hidden, true);
assert.deepEqual(sounds, ['drift:bank']);

assert.equal(feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.TECHNIQUE, { label: 'LOW PRIORITY' }, 350), false, 'A lower-priority DRIFT event cannot replace an active DRIFT release');
assert.equal(element(fixture, '[data-score-feedback-drift-callout]').dataset.event, 'bank');
feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.PERSONAL_BEST, { score: 8420 }, 400);
assert.equal(element(fixture, '[data-score-feedback-drift-callout-label]').textContent, 'NEW BEST');
await Promise.resolve();
assert.equal(element(fixture, '[data-score-feedback-announcer]').textContent, 'New drift best.', 'Higher-priority semantic events may replace an announcement inside the rate limit');

const flowState = {
  active: true,
  score: 18420,
  unbanked: 0,
  multiplier: 5.1,
  intensity: 0.84,
  phase: 'intensify',
  label: 'FLOW',
  tokens: ['SHIFT', 'DRIFT', 'LOCK', 'BOOST', 'EXIT']
};
feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.FLOW, true, 500);
feedback.updateState(SCORE_FEEDBACK_CHANNEL.FLOW, flowState, 600);
assert.equal(fixture.root.dataset.channel, 'flow', 'FLOW becomes persistent context when both channels are active');
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '1,820', 'DRIFT keeps its live paper readout when FLOW is active');
assert.equal(element(fixture, '[data-score-feedback-flow-current]').textContent, '18,420');
assert.equal(element(fixture, '[data-score-feedback-flow-total]').textContent, '18,420');
assert.equal(element(fixture, '[data-score-feedback-flow-multiplier]').textContent, '×5.1');
assert.deepEqual(element(fixture, '[data-score-feedback-flow-techniques]').children.map((token) => token.textContent), ['SHIFT', 'DRIFT', 'LOCK', 'BOOST', 'EXIT'], 'FLOW reuses its fixed technique-token pool instead of creating DOM nodes in the scoring path');
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0.72', 'DRIFT keeps its own independent gauge value when FLOW becomes active');
assert.equal(element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0.84', 'FLOW drives its gauge independently');
assert.equal(fixture.root.dataset.flowGaugeVisible, 'true');
assert.equal(fixture.root.dataset.flowGaugeExtended, 'true', 'FLOW owns an independently extending gauge');
assert.equal(fixture.root.dataset.flowComboTier, '5', 'Fractional FLOW multipliers use their floored saturation tier');
assert.equal(element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-gauge-fill-a'), 'hsl(339 76% 65%)', 'FLOW pink gains saturation with the combo tier');
assert.equal(fixture.root.dataset.flowHeat, 'hot');

assert.equal(feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.FLOW, SCORE_FEEDBACK_EVENT.MILESTONE, { score: 2480, multiplier: 7 }, 650), true);
assert.equal(element(fixture, '[data-score-feedback-flow-callout-label]').textContent, 'FLOW ×7');
assert.equal(element(fixture, '[data-score-feedback-flow-callout-score]').textContent, '2,480');
assert.equal(element(fixture, '[data-score-feedback-flow-callout]').dataset.event, 'milestone');
assert.equal(element(fixture, '[data-score-feedback-drift-callout-label]').textContent, 'NEW BEST', 'FLOW does not displace the DRIFT paper event');
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '1,820', 'Embedded DRIFT callout never replaces the current live DRIFT value');
assert.equal(element(fixture, '[data-score-feedback-flow-current]').textContent, '18,420', 'Embedded FLOW callout never replaces the current live FLOW value');
assert.equal(feedback.inspect().activeEvents.flow.active, true);
assert.equal(feedback.inspect().activeEvents.drift.active, true);

feedback.updateState(SCORE_FEEDBACK_CHANNEL.FLOW, { ...flowState, active: false, intensity: 0 }, 700);
assert.equal(element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0', 'An idle moment inside a FLOW combo can reach the true zero gauge state');
assert.equal(fixture.root.dataset.flowGaugeExtended, 'true', 'FLOW keeps an empty gauge extended while its x2+ combo remains alive');
feedback.updateState(SCORE_FEEDBACK_CHANNEL.FLOW, flowState, 800);

feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.BANK, { label: 'DRIFT +2,840 ×4', score: 2840, multiplier: 4 }, 3000);
assert.equal(fixture.root.dataset.channel, 'flow');
assert.equal(element(fixture, '[data-score-feedback-drift-callout-label]').textContent, 'DRIFT +2,840 ×4');
feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.DRIFT, false, 3100);
assert.equal(element(fixture, '[data-score-feedback-drift-callout]').hidden, true);
assert.equal(fixture.root.hidden, false, 'Hiding DRIFT presentation leaves active FLOW context visible');
assert.equal(fixture.root.dataset.driftGaugeVisible, 'false');
assert.equal(fixture.root.dataset.driftGaugeExtended, 'false');
assert.equal(fixture.root.dataset.flowGaugeVisible, 'true');
assert.equal(feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.BANK, { score: 9999 }, 3150), false, 'A hidden channel cannot publish a visual event');
assert.equal(feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.FLOW, SCORE_FEEDBACK_EVENT.TECHNIQUE, { label: 'CLEAN LINE' }, 3160), true);
assert.equal(element(fixture, '[data-score-feedback-flow-callout-label]').textContent, 'CLEAN LINE');
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
assert.equal(feedback.inspect().activeEvents.drift.active, false);
assert.equal(feedback.inspect().activeEvents.flow.active, false);
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0');

feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.DRIFT, true, 4100);
feedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, { active: false, score: 4820, unbanked: 0, multiplier: 1, intensity: 0, phase: 'quiet', label: 'DRIFT' }, 4200);
assert.equal(fixture.root.hidden, false, 'The DRIFT instrument does not flicker out between drifts');
assert.equal(element(fixture, '[data-score-feedback-current]').textContent, '0');
assert.equal(element(fixture, '[data-score-feedback-total]').textContent, '4,820');
assert.equal(fixture.root.dataset.driftGaugeExtended, 'false', 'A quiet x1 DRIFT row preserves its lap total while retracting only the black gauge');
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0');
feedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, { active: false, score: 4820, unbanked: 0, multiplier: 2, intensity: 0, phase: 'quiet', label: 'DRIFT' }, 4300);
assert.equal(fixture.root.dataset.driftGaugeExtended, 'true', 'An empty DRIFT gauge remains extended while an x2+ combo is alive');
assert.equal(fixture.root.dataset.driftComboTier, '2');
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0', 'The held-open gauge exposes the existing cyan zero residue rather than fake fill');
assert.equal(element(fixture, '[data-score-feedback-meter-fill]').style.getPropertyValue('--score-feedback-gauge-fill-a'), 'hsl(195 52% 50%)');
feedback.updateState(SCORE_FEEDBACK_CHANNEL.DRIFT, { active: false, score: 4820, unbanked: 0, multiplier: 1, intensity: 0, phase: 'quiet', label: 'DRIFT' }, 4400);
assert.equal(fixture.root.dataset.driftGaugeExtended, 'false', 'Normal gauge retraction resumes as soon as the combo falls below x2');
feedback.publishEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, SCORE_FEEDBACK_EVENT.LOSS, { score: 120 }, 4500);
feedback.dismissEvent(SCORE_FEEDBACK_CHANNEL.DRIFT, 4550);
assert.equal(element(fixture, '[data-score-feedback-drift-callout]').hidden, true);
assert.equal(element(fixture, '[data-score-feedback-total]').textContent, '4,820', 'Dismissing stale feedback must not clear the persistent lap total');
feedback.clearChannel(SCORE_FEEDBACK_CHANNEL.DRIFT, 4600);
assert.equal(fixture.root.hidden, false, 'Clearing a visible channel leaves its zero-state instrument mounted');
assert.equal(element(fixture, '[data-score-feedback-total]').textContent, '0');
feedback.setChannelVisible(SCORE_FEEDBACK_CHANNEL.DRIFT, false, 4700);
assert.equal(fixture.root.hidden, true, 'The HUD setting still removes the scoring instrument');
assert.equal(element(fixture, '[data-score-feedback-flow-meter-fill]').style.getPropertyValue('--score-feedback-progress'), '0');

const [source, css, hudCss, recordsSource, index, nextIndex, labIndex, main] = await Promise.all([
  fs.readFile(new URL('../turn/scoring/score-feedback.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/score-feedback.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/hud-notifications.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/scoring/scorekeeper-records.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-next/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn-lab/index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8')
]);

assert.doesNotMatch(source, /requestAnimationFrame/);
assert.doesNotMatch(source, /createElement|appendChild|replaceChildren/, 'ScoreFeedback must reuse fixed document nodes');
assert.match(source, /activeEvents/, 'ScoreFeedback owns independent channel-local event state');
assert.match(source, /data-score-feedback-drift-callout/);
assert.match(source, /data-score-feedback-flow-callout/);
assert.match(source, /installHudNotificationRuntime/, 'The shared scoring composition activates the standardized in-race HUD');
assert.match(recordsSource, /ensureEventCallout\(documentRef, root, 'drift'\)/);
assert.match(recordsSource, /ensureEventCallout\(documentRef, root, 'flow'\)/);
assert.match(recordsSource, /className = 'turn-score-event-callout'/, 'Scorekeeper composition creates one fixed event plate in each paper');
assert.match(source, /data-score-feedback-flow-meter-fill/);
assert.match(source, /GAUGE_SATURATION_AT_X1 = 44/);
assert.match(source, /driftGaugeProgress > 0 \|\| driftComboHeld/);
assert.match(source, /flowGaugeProgress > 0 \|\| flowComboHeld/);
assert.match(css, /--score-feedback-paper-height: 104px/);
assert.match(css, /--score-feedback-gauge-height: calc\(var\(--score-feedback-paper-height\) - 14px\)/);
assert.match(css, /top: var\(--score-feedback-gauge-inset-y\)/);
assert.match(css, /transform: scaleX\(var\(--score-feedback-progress, 0\)\)/);
assert.doesNotMatch(css, /transform: scaleY\(var\(--score-feedback-progress, 0\)\)/);
assert.match(css, /background: linear-gradient\(\s*to right,/);
for (const [mountName, markup] of [['TURN', index], ['TURN NEXT', nextIndex], ['TURN LAB', labIndex]]) {
  assert.match(markup, /data-score-feedback-label>DRIFT<\/span><span>COMBO<\/span>/, `${mountName} exposes COMBO vocabulary`);
  assert.match(markup, /data-score-feedback-flow-current>0<\/strong>/, `${mountName} includes the FLOW paper row`);
  assert.equal((markup.match(/data-score-feedback-flow-techniques/g) || []).length, 1, `${mountName} includes one fixed FLOW technique pool`);
  assert.equal((markup.match(/class="score-feedback-gauge-shell"/g) || []).length, 2, `${mountName} mounts one shell for each scoring gauge`);
  assert.match(markup, /class="score-feedback-gauge-shell" data-score-channel="drift" aria-hidden="true">\s*<div class="score-feedback-meter">/);
  assert.ok(markup.indexOf('class="score-feedback-gauge-shell" data-score-channel="drift"') < markup.indexOf('class="score-feedback-state"'), `${mountName} keeps gauge behind paper`);
}
assert.match(hudCss, /\.turn-score-event-callout \{[\s\S]*?right: 7px;[\s\S]*?bottom: 6px;/, 'Component 4 occupies the BEST corner instead of the live-value area');
assert.match(hudCss, /:root\.turn-left-handed-controls \.turn-score-event-callout \{[\s\S]*?right: auto;[\s\S]*?left: 7px;/, 'Component 4 mirrors to the opposite BEST corner for left-handed play');
assert.match(hudCss, /\.turn-score-event-callout\[data-event="bank"\][\s\S]*?var\(--turn-green-500/);
assert.match(hudCss, /\.turn-score-event-callout\[data-event="loss"\][\s\S]*?var\(--turn-red-500/);
assert.match(hudCss, /\.turn-score-event-callout\[data-event="milestone"\][\s\S]*?var\(--turn-yellow-400/);
assert.match(css, /\.score-feedback-state \{[\s\S]*?z-index: 1;/);
assert.match(css, /\.score-feedback-gauge-shell \{[\s\S]*?z-index: 0;/);
assert.match(css, /\.score-feedback-gauge-shell \{[\s\S]*?opacity: \.75;/);
assert.match(css, /\.score-feedback-gauge-shell \{[\s\S]*?transform: translateZ\(0\) scaleX\(1\)/);
assert.match(css, /data-drift-gauge-extended="false"[\s\S]*?data-flow-gauge-extended="false"[\s\S]*?transform: translateZ\(0\) scaleX\(0\);[\s\S]*?transition-delay: 180ms;/);
assert.match(css, /\.score-feedback-row \{[\s\S]*?height: var\(--score-feedback-paper-height\)/);
assert.match(css, /--score-feedback-gauge-track: var\(--turn-ink\);/);
assert.doesNotMatch(css, /#(?:000(?:000)?|08090a)\b/i);
assert.match(css, /data-score-channel="flow"/);
assert.match(css, /\.score-feedback-row \{[\s\S]*?position: relative;[\s\S]*?height: var\(--score-feedback-paper-height\)/);
assert.match(css, /@keyframes turn-score-gauge-rush/);
assert.match(css, /translateX/);
assert.match(css, /score-feedback-meter::before/);
assert.doesNotMatch(css, /filter\s*:/);
assert.doesNotMatch(css, /transition:[^;]*(?:width|height|top|left)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.score-feedback-gauge-shell,[\s\S]*?transition: none;/);
assert.match(index, /id="scoreFeedback"/);
assert.match(nextIndex, /id="scoreFeedback"/);
assert.match(labIndex, /id="scoreFeedback"/);
assert.match(index, /data-score-feedback-announcer role="status" aria-live="polite"/);
assert.doesNotMatch(index, /data-score-feedback-current[^>]*aria-live/);
assert.match(main, /scoreFeedback\.commit\(now\)/);

console.log('TURN shared ScoreFeedback engine regression passed.');
