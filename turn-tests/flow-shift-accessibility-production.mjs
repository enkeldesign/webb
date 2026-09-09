import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { getCarDefinition } from '../turn/vehicle/catalog.js';

const DEFAULT_GAINS = Object.freeze(['speed', 'acceleration', 'boostPower']);
const workflow = await fs.readFile(new URL('../.github/workflows/turn-lab-tests.yml', import.meta.url), 'utf8');

class ListenerTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event?.type) || [])]) listener.call(this, event);
    return event?.defaultPrevented !== true;
  }

  emit(type, detail) {
    return this.dispatchEvent(new FakeCustomEvent(type, { detail }));
  }
}

class FakeCustomEvent {
  constructor(type, { detail } = {}) {
    this.type = type;
    this.detail = detail;
    this.defaultPrevented = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {}
}

class FakeClassList {
  constructor(element) {
    this.element = element;
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
  }

  toggle(name, force) {
    const active = force === undefined ? !this.contains(name) : Boolean(force);
    if (active) this.values.add(name);
    else this.values.delete(name);
    return active;
  }

  contains(name) {
    return this.values.has(name) || this.element.className.split(/\s+/).includes(name);
  }
}

class FakeStyle {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, String(value));
  }

  removeProperty(name) {
    this.values.delete(name);
  }
}

class FakeElement extends ListenerTarget {
  constructor(tagName, ownerDocument) {
    super();
    this.tagName = String(tagName || 'div').toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.className = '';
    this.classList = new FakeClassList(this);
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.id = '';
    this.innerHTML = '';
    this.offsetWidth = 96;
    this.open = false;
    this.parentElement = null;
    this.style = new FakeStyle();
    this.textContent = '';
    this.type = '';
    this.queryCache = new Map();
  }

  appendChild(node) {
    node.parentElement?.removeChild?.(node);
    node.parentElement = this;
    this.children.push(node);
    return node;
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  removeChild(node) {
    this.children = this.children.filter((candidate) => candidate !== node);
    if (node.parentElement === this) node.parentElement = null;
  }

  replaceChildren(...nodes) {
    for (const child of this.children) {
      if (child.parentElement === this) child.parentElement = null;
    }
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'id') this.id = String(value);
    if (name === 'open') this.open = true;
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'open') this.open = false;
  }

  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName.toLowerCase() === selector.toLowerCase();
  }

  closest(selector) {
    let current = this;
    while (current) {
      if (current.matches(selector)) return current;
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    const existing = this.ownerDocument.findDescendant(this, selector);
    if (existing) return existing;
    if (!['strong', 'i', '.nuke-cancel', '.nuke-confirm'].includes(selector)) return null;
    if (this.queryCache.has(selector)) return this.queryCache.get(selector);
    const node = this.ownerDocument.createElement(selector.startsWith('.') ? 'button' : selector);
    if (selector.startsWith('.')) node.className = selector.slice(1);
    this.queryCache.set(selector, node);
    this.appendChild(node);
    return node;
  }

  getBoundingClientRect() {
    return { left: 0, right: 200, top: 0, bottom: 200, width: 200, height: 200 };
  }

  setPointerCapture() {}

  releasePointerCapture() {}

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  dispatch(type, properties = {}) {
    const event = Object.assign(new FakeCustomEvent(type), {
      target: this,
      currentTarget: this,
      pointerId: 0,
      clientX: 100,
      clientY: 100,
      key: '',
      repeat: false
    }, properties);
    this.dispatchEvent(event);
    return event;
  }
}

class FakeDocument extends ListenerTarget {
  constructor() {
    super();
    this.elements = [];
    this.hidden = false;
    this.documentElement = this.createElement('html');
    this.head = this.createElement('head');
    this.body = this.createElement('body');
    this.fixed = new Map();
  }

  createElement(tagName) {
    const element = new FakeElement(tagName, this);
    this.elements.push(element);
    return element;
  }

  register(selector, element) {
    this.fixed.set(selector, element);
    return element;
  }

  querySelector(selector) {
    return this.fixed.get(selector) || this.elements.find((element) => element.matches(selector)) || null;
  }

  getElementById(id) {
    return this.elements.find((element) => element.id === id) || null;
  }

  findDescendant(root, selector) {
    for (const child of root.children) {
      if (child.matches(selector)) return child;
      const nested = this.findDescendant(child, selector);
      if (nested) return nested;
    }
    return null;
  }
}

function createMemoryStorage(initial) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function createDocumentFixture() {
  const documentRef = new FakeDocument();
  const pedals = documentRef.createElement('div');
  const gasButton = documentRef.register('#gasButton', documentRef.createElement('button'));
  const brakeButton = documentRef.register('#brakeButton', documentRef.createElement('button'));
  const calibrateButton = documentRef.register('#calibrateButton', documentRef.createElement('button'));
  const manualSteer = documentRef.register('#manualSteer', documentRef.createElement('div'));
  const utilityGroup = documentRef.register('.utility-group', documentRef.createElement('div'));
  const hud = documentRef.register('#hud', documentRef.createElement('div'));
  const controls = documentRef.register('#controls', documentRef.createElement('div'));
  pedals.append(gasButton, brakeButton);
  return { documentRef, pedals, gasButton, brakeButton, calibrateButton, manualSteer, utilityGroup, hud, controls };
}

const globalKeys = [
  'window',
  'document',
  'localStorage',
  '__TURN_SHARED_LOCAL_STORAGE__',
  '__turnAchievements',
  '__turnRuntime',
  '__turnVehicleTuning',
  '__turnFlowShiftRuntime',
  '__turnGameplayControlsInstalled',
  'addEventListener',
  'removeEventListener',
  'dispatchEvent',
  'CustomEvent',
  'setTimeout',
  'clearTimeout'
];
const previousGlobals = new Map(globalKeys.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const defineGlobal = (key, value) => Object.defineProperty(globalThis, key, {
  configurable: true,
  enumerable: true,
  writable: true,
  value
});

const eventTarget = new ListenerTarget();
const fixture = createDocumentFixture();
const supercar = getCarDefinition('supercar');
const storage = createMemoryStorage({
  'turn-vehicle-shift-v1': JSON.stringify({
    version: 1,
    profiles: {
      supercar: {
        enabled: true,
        reducedStats: DEFAULT_GAINS
      }
    }
  })
});
const state = {
  vehicleId: supercar.id,
  vehiclePerkUnlocked: true,
  vehicleStats: supercar.stats,
  vehicleTuning: supercar.tuning,
  vehicleEffectiveTuning: supercar.tuning,
  lapActive: true,
  running: true,
  speed: 0,
  shiftActive: false
};

try {
  defineGlobal('window', globalThis);
  defineGlobal('document', fixture.documentRef);
  defineGlobal('localStorage', storage);
  defineGlobal('__TURN_SHARED_LOCAL_STORAGE__', storage);
  defineGlobal('__turnAchievements', {
    store: { isRewardUnlocked: (rewardId) => rewardId === 'shift' }
  });
  defineGlobal('__turnRuntime', { state, competitorCars: [] });
  defineGlobal('__turnVehicleTuning', supercar.tuning);
  defineGlobal('__turnFlowShiftRuntime', undefined);
  defineGlobal('__turnGameplayControlsInstalled', false);
  defineGlobal('addEventListener', eventTarget.addEventListener.bind(eventTarget));
  defineGlobal('removeEventListener', eventTarget.removeEventListener.bind(eventTarget));
  defineGlobal('dispatchEvent', eventTarget.dispatchEvent.bind(eventTarget));
  defineGlobal('CustomEvent', FakeCustomEvent);
  defineGlobal('setTimeout', () => 1);
  defineGlobal('clearTimeout', () => {});

  await import(`../turn/ui/gameplay-controls.js?flow-shift-accessibility=${Date.now()}`);

  const shiftBubble = fixture.documentRef.querySelector('.drive-shift-bubble');
  const driveStack = fixture.documentRef.querySelector('.drive-stack');
  const drivePad = fixture.documentRef.querySelector('.drive-pad');
  const shiftStatus = fixture.documentRef.elements.find((element) => (
    element.getAttribute('role') === 'status'
  ));
  assert.ok(shiftBubble && driveStack && drivePad && shiftStatus,
    'The production gameplay controls must expose SHIFT and its live region');
  assert.equal(shiftBubble.disabled, false, 'The configured unlocked SHIFT control must be interactive');

  eventTarget.emit('turn:flow-score-event', { type: 'score', multiplier: 2 });
  assert.equal(
    shiftBubble.getAttribute('aria-label'),
    'FLOW SHIFT ready. Activate to add its three attribute points without reductions.'
  );
  assert.equal(shiftBubble.getAttribute('aria-pressed'), 'false');
  assert.equal(shiftStatus.textContent, '', 'Entering Great FLOW must not add an unsolicited SHIFT announcement');

  const assertOrientation = ({ gear, pressed, label, announcement }) => {
    assert.equal(state.shiftActive, gear === 'up');
    assert.equal(shiftBubble.dataset.flowShiftGear, gear);
    assert.equal(shiftBubble.getAttribute('aria-pressed'), String(pressed));
    assert.equal(driveStack.classList.contains('is-shift-active'), pressed,
      'The visible dot and pressed state must share the UP-gear meaning');
    assert.equal(shiftBubble.getAttribute('aria-label'), label);
    if (announcement !== undefined) assert.equal(shiftStatus.textContent, announcement);
  };

  shiftBubble.dispatch('click');
  assertOrientation({
    gear: 'up',
    pressed: true,
    label: 'FLOW SHIFT. UP gear active. Activate to move the three-point boost to the default gear.',
    announcement: 'FLOW SHIFT. UP gear active. Control, drift, and boost tank gain one point with no reductions.'
  });

  drivePad.dispatch('pointerdown', { pointerId: 1 });
  drivePad.dispatch('pointerup', { pointerId: 1 });
  assertOrientation({
    gear: 'up',
    pressed: true,
    label: 'FLOW SHIFT. UP gear active. Activate to move the three-point boost to the default gear.',
    announcement: 'FLOW SHIFT. UP gear active. Control, drift, and boost tank gain one point with no reductions.'
  });

  shiftBubble.dispatch('click');
  assertOrientation({
    gear: 'base',
    pressed: false,
    label: 'FLOW SHIFT. Default gear active. Activate to move the three-point boost to the UP gear.',
    announcement: 'FLOW SHIFT. Default gear active.'
  });

  drivePad.dispatch('pointerdown', { pointerId: 2 });
  drivePad.dispatch('pointercancel', { pointerId: 2 });
  assertOrientation({
    gear: 'base',
    pressed: false,
    label: 'FLOW SHIFT. Default gear active. Activate to move the three-point boost to the UP gear.',
    announcement: 'FLOW SHIFT. Default gear active.'
  });

  shiftBubble.dispatch('click');
  assertOrientation({
    gear: 'up',
    pressed: true,
    label: 'FLOW SHIFT. UP gear active. Activate to move the three-point boost to the default gear.',
    announcement: 'FLOW SHIFT. UP gear active.'
  });

  const assertUpRecovery = (description, recover) => {
    shiftBubble.setAttribute('aria-label', 'stale generic SHIFT label');
    recover();
    assertOrientation({
      gear: 'up',
      pressed: true,
      label: 'FLOW SHIFT. UP gear active. Activate to move the three-point boost to the default gear.',
      announcement: 'FLOW SHIFT. UP gear active.'
    });
    assert.equal(shiftStatus.textContent, 'FLOW SHIFT. UP gear active.',
      `${description} must not create an automatic live-region announcement`);
  };

  assertUpRecovery('lost pointer capture', () => {
    drivePad.dispatch('pointerdown', { pointerId: 3 });
    drivePad.dispatch('lostpointercapture', { pointerId: 3 });
  });
  assertUpRecovery('window blur', () => eventTarget.emit('blur'));
  assertUpRecovery('window focus', () => eventTarget.emit('focus'));
  fixture.documentRef.hidden = true;
  fixture.documentRef.emit('visibilitychange');
  fixture.documentRef.hidden = false;
  assertUpRecovery('visibility restoration', () => fixture.documentRef.emit('visibilitychange'));
  assertUpRecovery('pageshow', () => eventTarget.emit('pageshow'));

  const style = fixture.documentRef.getElementById('turn-flow-shift-button-r255');
  assert.ok(style, 'FLOW SHIFT presentation styles must install once the production button exists');
  assert.match(style.textContent, /@media \(forced-colors: active\)/);
  assert.match(
    style.textContent,
    /\.drive-stack\.is-shift-active \.drive-shift-bubble i \{[\s\S]*border: 2px solid ButtonText;[\s\S]*background: ButtonText;/,
    'The UP-gear dot must retain a system-color outline when forced colors suppress backgrounds'
  );
  assert.match(style.textContent, /@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none;/,
    'FLOW SHIFT bump feedback must remain motion-free when reduced motion is requested');

  eventTarget.emit('turn:flow-score-event', { type: 'chain-expired', multiplier: 1 });
  assert.equal(
    shiftBubble.getAttribute('aria-label'),
    'SHIFT active after FLOW. Activate to move SHIFT to the other three attributes.'
  );
  assert.equal(shiftBubble.getAttribute('aria-pressed'), 'true');
  shiftBubble.setAttribute('aria-label', 'stale generic SHIFT label');
  eventTarget.emit('focus');
  assert.equal(shiftBubble.dataset.flowShiftGear, 'none');
  assert.equal(shiftBubble.getAttribute('aria-pressed'), 'true');
  assert.equal(
    shiftBubble.getAttribute('aria-label'),
    'SHIFT active after FLOW. Activate to move SHIFT to the other three attributes.',
    'Focus recovery must preserve the deliberate carried-after-FLOW description'
  );
  assert.equal(shiftStatus.textContent, 'FLOW SHIFT. UP gear active.',
    'FLOW loss and recovery must not create an unsolicited live-region announcement');
} finally {
  globalThis.__turnFlowShiftRuntime?.cleanup?.();
  for (const [key, descriptor] of previousGlobals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else delete globalThis[key];
  }
}

assert.match(workflow, /node turn-tests\/flow-shift-accessibility-production\.mjs/,
  'The full TURN regression workflow must run the FLOW SHIFT accessibility interaction');

console.log('TURN FLOW SHIFT orientation announcements, recovery labels and forced-colors dot passed.');
