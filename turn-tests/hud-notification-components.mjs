import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import {
  HUD_NOTIFICATION_KIND,
  HUD_NOTIFICATION_POLICY,
  HUD_NOTIFICATION_SLOT,
  createHudNotificationController
} from '../turn/ui/hud-notifications.js';

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) this.values.add(name);
    this.owner.className = [...this.values].join(' ');
  }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.className = '';
    this.classList = new FakeClassList(this);
    this.textContent = '';
    this.hidden = false;
    this.listeners = new Map();
    this.type = '';
  }

  append(...nodes) {
    for (const node of nodes) {
      if (!node) continue;
      if (node.parentElement) node.remove();
      node.parentElement = this;
      this.children.push(node);
    }
  }

  remove() {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    if (index >= 0) siblings.splice(index, 1);
    this.parentElement = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  addEventListener(type, callback) {
    this.listeners.set(type, callback);
  }

  click() {
    this.listeners.get('click')?.({ currentTarget: this });
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

function createTimers() {
  let nextId = 1;
  const pending = new Map();
  return {
    set(callback, delay) {
      const id = nextId++;
      pending.set(id, { callback, delay });
      return id;
    },
    clear(id) {
      pending.delete(id);
    },
    runNext() {
      const entry = [...pending.entries()].sort((a, b) => a[1].delay - b[1].delay || a[0] - b[0])[0];
      if (!entry) return false;
      pending.delete(entry[0]);
      entry[1].callback();
      return true;
    },
    count() {
      return pending.size;
    }
  };
}

const documentRef = new FakeDocument();
const hud = new FakeElement('div');
const timers = createTimers();
const controller = createHudNotificationController({
  hud,
  documentRef,
  setTimer: (callback, delay) => timers.set(callback, delay),
  clearTimer: (id) => timers.clear(id),
  queueMicrotaskRef: (callback) => callback(),
  exitMs: 20
});

assert.deepEqual(HUD_NOTIFICATION_POLICY, {
  [HUD_NOTIFICATION_SLOT.RACE_STATUS]: 'replace',
  [HUD_NOTIFICATION_SLOT.RACE_CUE]: 'replace',
  [HUD_NOTIFICATION_SLOT.PROGRESSION]: 'queue'
});
assert.equal(hud.children.length, 1, 'The controller mounts one shared HUD notification host');
assert.equal(controller.host.children.length, 4,
  'The host contains three semantic slots and one shared polite announcer');
assert.equal(controller.host.children.at(-1).getAttribute('role'), 'status');
assert.equal(controller.host.children.at(-1).getAttribute('aria-live'), 'polite');
for (const slot of Object.values(HUD_NOTIFICATION_SLOT)) {
  assert.equal(controller.elementFor(slot).getAttribute('aria-live'), 'off',
    `${slot} visuals must not create a second live-region announcement`);
}

assert.equal(controller.publish(HUD_NOTIFICATION_SLOT.RACE_STATUS, {
  id: 'lap-result-1',
  kind: HUD_NOTIFICATION_KIND.INFO,
  kicker: 'LAP',
  title: '2/3 · 0:23.305',
  priority: 20,
  announcement: 'Lap two of three. 23.305 seconds.'
}), true);
assert.equal(controller.inspect()[HUD_NOTIFICATION_SLOT.RACE_STATUS].active.id, 'lap-result-1');
assert.equal(controller.host.children.at(-1).textContent, 'Lap two of three. 23.305 seconds.');
assert.equal(controller.publish(HUD_NOTIFICATION_SLOT.RACE_STATUS, {
  id: 'low-priority',
  title: 'Ignore me',
  priority: 10
}), false, 'Lower-priority race state cannot displace a current higher-priority state');
assert.equal(controller.publish(HUD_NOTIFICATION_SLOT.RACE_STATUS, {
  id: 'lap-void-1',
  kind: HUD_NOTIFICATION_KIND.DANGER,
  kicker: 'LAP VOID',
  title: 'STAY ON THE TRACK!',
  priority: 40
}), true);
assert.equal(controller.inspect()[HUD_NOTIFICATION_SLOT.RACE_STATUS].active.kind, HUD_NOTIFICATION_KIND.DANGER);

let activated = 0;
assert.equal(controller.publish(HUD_NOTIFICATION_SLOT.RACE_CUE, {
  id: 'go',
  kind: HUD_NOTIFICATION_KIND.COMMAND,
  title: 'GO!',
  actionLabel: 'Start racing',
  onActivate: () => { activated += 1; },
  announce: false
}), true);
const cuePlate = controller.elementFor(HUD_NOTIFICATION_SLOT.RACE_CUE).children[0];
assert.equal(cuePlate.tagName, 'BUTTON', 'Actionable notification variants use real button semantics');
assert.equal(cuePlate.getAttribute('aria-label'), 'Start racing');
cuePlate.click();
assert.equal(activated, 1);

const customBody = new FakeElement('span');
customBody.textContent = 'DRIFT 722 · FLOW 2,089';
controller.publish(HUD_NOTIFICATION_SLOT.RACE_STATUS, {
  id: 'lap-result-custom',
  kind: HUD_NOTIFICATION_KIND.INFO,
  contentNode: customBody,
  announcement: 'Lap result with scoring summary.',
  priority: 50
});
const statusPlate = controller.elementFor(HUD_NOTIFICATION_SLOT.RACE_STATUS).children[0];
assert.equal(statusPlate.children[1].className, 'turn-hud-notification__body',
  'Complex status content can use the shared shell without flattening the lap/score structure');
assert.equal(statusPlate.children[1].children[0], customBody);

assert.equal(controller.publish(HUD_NOTIFICATION_SLOT.PROGRESSION, {
  id: 'achievement:mayday',
  kind: HUD_NOTIFICATION_KIND.ACHIEVEMENT,
  kicker: 'ACHIEVEMENT UNLOCKED',
  title: 'MAYDAY!',
  badge: '+100 TROPHIES',
  announce: false
}), true);
assert.equal(controller.publish(HUD_NOTIFICATION_SLOT.PROGRESSION, {
  id: 'reward:awd',
  kind: HUD_NOTIFICATION_KIND.REWARD,
  kicker: 'TROPHY ROAD REWARD',
  title: 'AWD · TRACTION',
  badge: 'UNLOCKED',
  announce: false
}), true);
assert.equal(controller.publish(HUD_NOTIFICATION_SLOT.PROGRESSION, {
  id: 'reward:awd',
  kind: HUD_NOTIFICATION_KIND.REWARD,
  title: 'DUPLICATE'
}), false, 'Queued progression notifications de-duplicate stable ids');
assert.equal(controller.inspect()[HUD_NOTIFICATION_SLOT.PROGRESSION].active.id, 'achievement:mayday');
assert.deepEqual(
  controller.inspect()[HUD_NOTIFICATION_SLOT.PROGRESSION].queued.map((item) => item.id),
  ['reward:awd']
);
controller.dismiss(HUD_NOTIFICATION_SLOT.PROGRESSION);
assert.equal(controller.elementFor(HUD_NOTIFICATION_SLOT.PROGRESSION).children[0].dataset.state, 'leaving');
assert.equal(timers.runNext(), true, 'The short exit timer can complete the current progression notification');
assert.equal(controller.inspect()[HUD_NOTIFICATION_SLOT.PROGRESSION].active.id, 'reward:awd',
  'Progression notifications advance sequentially rather than stacking');
assert.equal(controller.elementFor(HUD_NOTIFICATION_SLOT.PROGRESSION).children.length, 1);

controller.destroy();
assert.equal(hud.children.length, 0);
assert.equal(timers.count(), 0, 'Destroy clears all notification timers');

const [source, css] = await Promise.all([
  fs.readFile(new URL('../turn/ui/hud-notifications.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/hud-notifications.css', import.meta.url), 'utf8')
]);

assert.match(source, /RACE_STATUS: 'race-status'/);
assert.match(source, /RACE_CUE: 'race-cue'/);
assert.match(source, /PROGRESSION: 'progression'/);
assert.match(source, /\[HUD_NOTIFICATION_SLOT\.PROGRESSION\]: 'queue'/);
assert.match(source, /announcer\.setAttribute\('role', 'status'\)/);
assert.match(source, /announcer\.setAttribute\('aria-live', 'polite'\)/);
assert.doesNotMatch(source, /role['"],?\s*['"]alert|aria-live['"],?\s*['"]assertive/,
  'Shared HUD notifications stay non-interruptive by default');
assert.doesNotMatch(source, /offsetWidth|offsetHeight|getBoundingClientRect/,
  'Component entrance/exit must not depend on forced layout reads');
assert.match(css, /data-slot="race-cue"[\s\S]*--turn-hud-notification-radius: var\(--turn-radius-pill, 999px\)/,
  'Component 2 uses the maximally rounded GO-style pill');
assert.match(css, /data-slot="progression"[\s\S]*width: min\(520px, 46vw\)/,
  'Component 3 has a deliberately more compact maximum footprint');
assert.match(css, /\.turn-score-event-callout\[data-event="bank"\][\s\S]*var\(--turn-green-500/);
assert.match(css, /\.turn-score-event-callout\[data-event="loss"\][\s\S]*var\(--turn-red-500/);
assert.match(css, /\.turn-score-event-callout\[data-event="milestone"\][\s\S]*var\(--turn-yellow-400/);
assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none;/,
  'All shared notification motion has a reduced-motion path');
assert.doesNotMatch(css, /filter\s*:/,
  'HUD notifications avoid filter effects in the race compositor');

console.log('TURN HUD notification component and semantic-slot regression passed.');
