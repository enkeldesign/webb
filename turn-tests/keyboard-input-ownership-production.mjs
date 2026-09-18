import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  KEYBOARD_DRIVE_BINDINGS,
  createKeyboardDrivingController,
  keyboardDriveActionForEvent
} from '../turn/input/keyboard-driving-controls.js';
import { createKeyboardDriveOwnership } from '../turn/input/keyboard-drive-ownership.js';

class FakeElement {
  constructor(kind = 'game') {
    this.kind = kind;
  }

  closest(selector) {
    if (this.kind === 'drive-pad' && selector === '.drive-pad') return this;
    const matches = {
      button: ['button', '[role="button"]'],
      input: ['input'],
      radio: ['input', '[role="radio"]'],
      slider: ['input', '[role="slider"]'],
      link: ['a', '[role="link"]'],
      textbox: ['textarea', '[role="textbox"]']
    };
    return (matches[this.kind] || []).some((token) => selector.includes(token)) ? this : null;
  }
}

function createEnvironment() {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const mutationObservers = [];
  let dialogOpen = false;
  let roleDialogOpen = false;

  const bodyClasses = new Set();
  const controls = { hidden: false };
  const document = {
    hidden: false,
    body: {
      classList: {
        contains(name) { return bodyClasses.has(name); }
      }
    },
    querySelector(selector) {
      if (selector === '#controls') return controls;
      if (selector === 'dialog[open]') return dialogOpen ? {} : null;
      if (selector === '[role="dialog"]:not([hidden])') return roleDialogOpen ? {} : null;
      return null;
    },
    addEventListener(name, listener) { documentListeners.set(name, listener); },
    removeEventListener(name, listener) {
      if (documentListeners.get(name) === listener) documentListeners.delete(name);
    }
  };

  const window = {
    document,
    addEventListener(name, listener) {
      const listeners = windowListeners.get(name) || [];
      listeners.push(listener);
      windowListeners.set(name, listeners);
    },
    removeEventListener(name, listener) {
      const listeners = (windowListeners.get(name) || []).filter((candidate) => candidate !== listener);
      windowListeners.set(name, listeners);
    }
  };

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      mutationObservers.push(this);
    }
    observe() {}
    disconnect() {}
  }

  const environment = {
    window,
    document,
    Element: FakeElement,
    MutationObserver: FakeMutationObserver
  };

  function dispatchWindow(name, event = {}) {
    for (const listener of windowListeners.get(name) || []) listener(event);
  }

  function dispatchDocument(name, event = {}) {
    documentListeners.get(name)?.(event);
  }

  function notifyMutation() {
    for (const observer of mutationObservers) observer.callback([]);
  }

  return {
    environment,
    controls,
    bodyClasses,
    setDialogOpen(value) { dialogOpen = Boolean(value); },
    setRoleDialogOpen(value) { roleDialogOpen = Boolean(value); },
    dispatchWindow,
    dispatchDocument,
    notifyMutation
  };
}

function keyEvent({ code, key, target = new FakeElement('game'), repeat = false } = {}) {
  let prevented = false;
  return {
    code,
    key,
    target,
    repeat,
    preventDefault() { prevented = true; },
    get defaultPrevented() { return prevented; }
  };
}

assert.equal(KEYBOARD_DRIVE_BINDINGS.KeyW, 'gas');
assert.equal(KEYBOARD_DRIVE_BINDINGS.Space, 'brake');
assert.equal(keyboardDriveActionForEvent({ code: 'ArrowLeft' }), 'steer-left');
assert.equal(keyboardDriveActionForEvent({ code: 'KeyD' }), 'steer-right');
assert.equal(keyboardDriveActionForEvent({ key: 'W' }), 'gas');
assert.equal(keyboardDriveActionForEvent({ key: ' ' }), 'brake');
assert.equal(keyboardDriveActionForEvent({ code: 'KeyR' }), 'reset');
assert.equal(keyboardDriveActionForEvent({ code: 'Tab', key: 'Tab' }), null);

const harness = createEnvironment();
const state = {
  running: true,
  manualSteering: 0,
  touchGas: false,
  touchBrake: false
};
let resetCount = 0;
const ownership = createKeyboardDriveOwnership({
  environment: harness.environment,
  getState: () => state,
  controls: harness.controls
});
const controller = createKeyboardDrivingController({
  environment: harness.environment,
  state,
  resetCar: () => { resetCount += 1; },
  controls: harness.controls,
  ownership
});
assert.equal(controller.installed, true);

const wDown = keyEvent({ code: 'KeyW', key: 'w' });
harness.dispatchWindow('keydown', wDown);
assert.equal(state.touchGas, true, 'W must accelerate while the race owns keyboard driving');
assert.equal(wDown.defaultPrevented, true, 'Consumed driving keys must suppress browser defaults');

const arrowUpDown = keyEvent({ code: 'ArrowUp', key: 'ArrowUp' });
harness.dispatchWindow('keydown', arrowUpDown);
harness.dispatchWindow('keyup', keyEvent({ code: 'KeyW', key: 'w' }));
assert.equal(state.touchGas, true, 'Releasing one of two held GAS keys must keep the other GAS key active');
harness.dispatchWindow('keyup', keyEvent({ code: 'ArrowUp', key: 'ArrowUp' }));
assert.equal(state.touchGas, false);

harness.dispatchWindow('keydown', keyEvent({ code: 'KeyA', key: 'a' }));
assert.equal(state.manualSteering, -1);
harness.dispatchWindow('keydown', keyEvent({ code: 'KeyD', key: 'd' }));
assert.equal(state.manualSteering, 1, 'Most recently held steering direction must win');
harness.dispatchWindow('keyup', keyEvent({ code: 'KeyD', key: 'd' }));
assert.equal(state.manualSteering, -1, 'Releasing the latest steering key must return to the still-held direction');
harness.dispatchWindow('keyup', keyEvent({ code: 'KeyA', key: 'a' }));
assert.equal(state.manualSteering, 0);

const buttonSpace = keyEvent({ code: 'Space', key: ' ', target: new FakeElement('button') });
harness.dispatchWindow('keydown', buttonSpace);
assert.equal(state.touchBrake, false, 'Space on a button must retain native button behavior instead of braking');
assert.equal(buttonSpace.defaultPrevented, false);

for (const kind of ['input', 'radio', 'slider', 'textbox']) {
  const event = keyEvent({ code: 'ArrowRight', key: 'ArrowRight', target: new FakeElement(kind) });
  harness.dispatchWindow('keydown', event);
  assert.equal(state.manualSteering, 0, `Arrow keys on ${kind} controls must remain native UI input`);
  assert.equal(event.defaultPrevented, false);
}

const rDown = keyEvent({ code: 'KeyR', key: 'r' });
harness.dispatchWindow('keydown', rDown);
assert.equal(resetCount, 1, 'R must reset during active race ownership');
assert.equal(rDown.defaultPrevented, true);
harness.dispatchWindow('keydown', keyEvent({ code: 'KeyR', key: 'r', repeat: true }));
assert.equal(resetCount, 1, 'Held R must not repeatedly reset the race');

const inputR = keyEvent({ code: 'KeyR', key: 'r', target: new FakeElement('input') });
harness.dispatchWindow('keydown', inputR);
assert.equal(resetCount, 1, 'R typed into an input must not reset the race');
assert.equal(inputR.defaultPrevented, false);

state.running = false;
const inactiveW = keyEvent({ code: 'KeyW', key: 'w' });
harness.dispatchWindow('keydown', inactiveW);
assert.equal(state.touchGas, false, 'Keyboard driving must be inert outside an active race');
assert.equal(inactiveW.defaultPrevented, false);
state.running = true;

harness.bodyClasses.add('turn-home-open');
const homeW = keyEvent({ code: 'KeyW', key: 'w' });
harness.dispatchWindow('keydown', homeW);
assert.equal(state.touchGas, false, 'Home must own its keyboard while open');
assert.equal(homeW.defaultPrevented, false);
harness.bodyClasses.delete('turn-home-open');

harness.dispatchWindow('keydown', keyEvent({ code: 'KeyS', key: 's' }));
assert.equal(state.touchBrake, true);
harness.setDialogOpen(true);
harness.notifyMutation();
assert.equal(state.touchBrake, false, 'Opening a dialog while a drive key is held must clear that held input');
assert.equal(controller.getHeldCount(), 0);
harness.setDialogOpen(false);

harness.dispatchWindow('keydown', keyEvent({ code: 'KeyW', key: 'w' }));
assert.equal(state.touchGas, true);
harness.dispatchWindow('blur');
assert.equal(state.touchGas, false, 'Window blur must clear held keyboard driving input');

harness.dispatchWindow('keydown', keyEvent({ code: 'KeyA', key: 'a' }));
assert.equal(state.manualSteering, -1);
harness.dispatchDocument('focusin', { target: new FakeElement('slider') });
assert.equal(state.manualSteering, 0, 'Focusing an interactive control must release held steering');

harness.dispatchWindow('keydown', keyEvent({ code: 'KeyW', key: 'w' }));
state.running = false;
harness.dispatchWindow('turn:ui-state-change', { detail: { running: false, reason: 'home-open' } });
assert.equal(state.touchGas, false, 'Route/UI ownership loss must clear held GAS');
state.running = true;

harness.dispatchWindow('keydown', keyEvent({ code: 'KeyS', key: 's' }));
harness.environment.document.hidden = true;
harness.dispatchDocument('visibilitychange');
assert.equal(state.touchBrake, false, 'Backgrounding the document must clear held BRAKE');
harness.environment.document.hidden = false;

controller.release();

const [mainSource, qeSource, ownershipSource] = await Promise.all([
  fs.readFile(new URL('../turn/main.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/input/qe-drive-controls.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/input/keyboard-drive-ownership.js', import.meta.url), 'utf8')
]);

assert.match(mainSource, /createKeyboardDrivingController/);
assert.doesNotMatch(
  mainSource,
  /window\.addEventListener\('keydown', \(event\) => \{[\s\S]*state\.touchGas = true/,
  'main.js must not retain an ungated parallel keyboard-driving listener'
);
assert.match(qeSource, /createKeyboardDriveOwnership/,
  'Q/E Drift and Boost must use the same keyboard ownership rule as steering, GAS, BRAKE and reset');
assert.match(ownershipSource, /dialog\[open\]/);
assert.match(ownershipSource, /\[role="dialog"\]:not\(\[hidden\]\)/);
assert.match(ownershipSource, /turn-home-open/);
assert.match(ownershipSource, /turn-lot-open/);
assert.match(ownershipSource, /turn-spectating/);

console.log('TURN keyboard driving ownership, native-control protection and held-input release regression passed.');
