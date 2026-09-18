import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const handoff = await fs.readFile(
  new URL('../../turn/ui/startup-screen-reader-handoff-r529.js', import.meta.url),
  'utf8'
);
const index = await fs.readFile(new URL('../../turn/index.html', import.meta.url), 'utf8');

function createHarness({ width, height }) {
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const documentListeners = new Map();
  const windowListeners = new Map();
  const nodesById = new Map();

  class FakeElement {
    constructor(tagName = 'div') {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.hidden = false;
      this.dataset = {};
      this.style = {};
      this.textContent = '';
      this.attributes = new Map();
      this.children = [];
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    hasAttribute(name) { return this.attributes.has(name); }
    appendChild(child) {
      this.children.push(child);
      if (child?.id) nodesById.set(child.id, child);
      return child;
    }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    matches() { return false; }
    closest() { return null; }
    focus() {}
  }

  class FakeMutationObserver {
    observe() {}
    disconnect() {}
  }

  const body = new FakeElement('body');
  const head = new FakeElement('head');
  const document = {
    body,
    head,
    documentElement: { clientWidth: width, clientHeight: height },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById(id) { return nodesById.get(id) || null; },
    createElement(tagName) { return new FakeElement(tagName); },
    addEventListener(name, listener) { documentListeners.set(name, listener); }
  };

  const visualViewportListeners = new Map();
  const visualViewport = {
    width,
    height,
    addEventListener(name, listener) { visualViewportListeners.set(name, listener); },
    removeEventListener(name) { visualViewportListeners.delete(name); }
  };

  const window = {
    innerWidth: width,
    innerHeight: height,
    visualViewport,
    addEventListener(name, listener) { windowListeners.set(name, listener); },
    removeEventListener(name) { windowListeners.delete(name); },
    setTimeout(callback, delay = 0) {
      const id = nextTimerId++;
      timers.set(id, { callback, at: now + Number(delay || 0) });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };

  const context = {
    window,
    document,
    performance: { now: () => now },
    MutationObserver: FakeMutationObserver,
    Element: FakeElement,
    NodeFilter: { SHOW_TEXT: 4 },
    requestAnimationFrame(callback) {
      callback(now);
      return 1;
    },
    queueMicrotask(callback) { callback(); },
    console
  };

  vm.runInNewContext(handoff, context, { filename: 'startup-screen-reader-handoff-r529.js' });

  function dispatchHomeReady() {
    const listener = documentListeners.get('turn:home-ready');
    assert.equal(typeof listener, 'function', 'Startup handoff must subscribe to turn:home-ready');
    listener({ type: 'turn:home-ready' });
  }

  function advance(milliseconds) {
    const target = now + milliseconds;
    while (true) {
      const due = [...timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      const [id, timer] = due;
      timers.delete(id);
      now = timer.at;
      timer.callback();
    }
    now = target;
  }

  return {
    dispatchHomeReady,
    advance,
    status: () => nodesById.get('turn-screen-reader-status') || null
  };
}

const portrait = createHarness({ width: 390, height: 844 });
portrait.dispatchHomeReady();
assert.equal(
  portrait.status()?.textContent,
  'TURN is ready. Rotate your device to landscape.',
  'Portrait Home readiness must immediately explain the required current orientation action'
);
assert.equal(portrait.status()?.getAttribute('aria-live'), 'assertive');

const landscape = createHarness({ width: 844, height: 390 });
landscape.dispatchHomeReady();
assert.equal(
  landscape.status(),
  null,
  'Landscape readiness must wait for the viewport to settle before speaking onboarding'
);
landscape.advance(1199);
assert.equal(landscape.status(), null, 'Landscape onboarding must not speak before the 1200 ms settle window');
landscape.advance(1);
assert.match(
  landscape.status()?.textContent || '',
  /^TURN is ready\. Non-visual onboarding\./,
  'Stable landscape readiness must hand off directly into the non-visual onboarding message'
);
assert.equal(landscape.status()?.getAttribute('aria-live'), 'assertive');

assert.match(index, /startup-screen-reader-handoff-r529\.js/,
  'Production TURN must load the screen-reader startup handoff before app startup');

console.log('TURN startup readiness announces portrait orientation immediately and settled landscape onboarding after 1200 ms.');
