import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const [homeLayout, repair, appBarCss] = await Promise.all([
  fs.readFile(new URL('../turn/m8-home-fixed-layout.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/pwa-short-viewport-repair-r184.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/home-app-bar.css', import.meta.url), 'utf8')
]);

// The Home menu lives in the app bar's sheet; on short screens it scrolls inside the
// sheet, vertically only.
const sheetMenuRule = appBarCss.match(/\.turn-home-sheet \.m8-home-menu \{[^}]*\}/)?.[0] || '';
for (const verticalOnlyMenuRule of [
  'overflow-y: auto',
  'overflow-x: hidden',
  'overscroll-behavior-x: none',
  'touch-action: pan-y'
]) {
  assert.ok(
    sheetMenuRule.includes(verticalOnlyMenuRule),
    `Short-viewport Home menu must keep scrolling vertical-only: ${verticalOnlyMenuRule}`
  );
}

assert.match(
  homeLayout,
  /pwa-short-viewport-repair-r184\.js\?build=\$\{buildKey\}&revision=r184-start-settle-first-activation/,
  'Production Home must load the cache-distinct minimal viewport repair module'
);

const parseableRepair = repair.replace('export function installShortViewportAutoRepair', 'function installShortViewportAutoRepair');
assert.doesNotThrow(() => new Function(parseableRepair), 'Production short-viewport repair must remain valid JavaScript');

for (const requiredRepair of [
  "measureHeight('100dvh')",
  "measureHeight('100lvh')",
  'BAD_GAP_MIN = 40',
  'Math.abs(sample.clientH - sample.dvh) <= 2',
  'Math.abs(sample.visualH - sample.dvh) <= 2',
  'AUTO_SETTLE_MS = 160',
  'AUTO_CONFIRM_MS = 90',
  'META_PULSE_MS = 120',
  "document.addEventListener('turn:home-ready'",
  "home.addEventListener('click', onFirstHomeActivation",
  "'first-home-activation'",
  "meta.setAttribute('content', pulse)",
  "meta.setAttribute('content', original)",
  'autoAttempted',
  'interactionAttempted'
]) {
  assert.ok(repair.includes(requiredRepair), `Production repair must include ${requiredRepair}`);
}

assert.doesNotMatch(repair, /screen\.(?:width|height)/,
  'Physical screen dimensions must never participate in viewport repair');
assert.doesNotMatch(repair, /TURN viewport repair bench|COPY REPAIR RESULT|COLOR LAYERS|AUTO_RETRY_DELAYS|STARTUP_CHECKS_MS/,
  'Production must not clone TURN LAB diagnostics, UI, or long-running watchdog machinery');
assert.doesNotMatch(repair, /document\.addEventListener\('click'|window\.addEventListener\('click'/,
  'The first-interaction fallback must stay scoped to Home rather than becoming a global click delegate');

// Behaviour: every meta pulse visibly shakes the whole page while iOS relays it out, so
// a pulse runs only where it can help, and never again on a device where one failed.
const { installShortViewportAutoRepair } = await import('../turn/pwa-short-viewport-repair-r184.js');
const storage = new Map();
const fakeStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) };
globalThis.getComputedStyle = () => ({ display: 'block', visibility: 'visible' });

async function viewportScenario({ dvh, lvh, top, recoverOnPulse = false }) {
  delete globalThis.__turnShortViewportRepairR184;
  const view = { dvh, lvh, top };
  const pulses = [];
  const listeners = new Map();
  const homeListeners = new Map();
  const probeHeight = (css) => {
    const value = css.match(/height:([^;]+);/)[1];
    if (value === '100dvh') return view.dvh;
    if (value === '100lvh') return view.lvh;
    return view.top;
  };
  const root = {
    classList: { contains: (name) => name === 'turn-standalone' || name === 'turn-home-ready' },
    dataset: {},
    get clientHeight() { return view.dvh; }
  };
  const meta = {
    content: 'width=device-width, initial-scale=1, viewport-fit=cover',
    getAttribute() { return this.content; },
    setAttribute(_, value) {
      if (value !== this.content && /user-scalable=no/.test(value)) {
        pulses.push(value);
        if (recoverOnPulse) view.dvh = view.lvh;
      }
      this.content = value;
    }
  };
  globalThis.document = {
    documentElement: root,
    visibilityState: 'visible',
    hidden: false,
    body: { appendChild() {} },
    createElement: () => {
      const probe = { style: { cssText: '' }, setAttribute() {}, remove() {} };
      probe.getBoundingClientRect = () => ({ height: probeHeight(probe.style.cssText) });
      return probe;
    },
    querySelector: (selector) => (selector === 'meta[name="viewport"]' ? meta : null),
    addEventListener: (type, listener) => listeners.set(type, listener)
  };
  globalThis.window = {
    setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
    clearTimeout: (id) => globalThis.clearTimeout(id),
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    localStorage: fakeStorage,
    visualViewport: { get height() { return view.dvh; } },
    get innerHeight() { return view.dvh; }
  };
  const home = {
    isConnected: true,
    hidden: false,
    getBoundingClientRect: () => ({ width: 393, height: view.dvh }),
    addEventListener: (type, listener) => homeListeners.set(type, listener)
  };
  installShortViewportAutoRepair({ home });
  const wait = (ms) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));
  listeners.get('turn:home-ready')?.();
  await wait(600);
  homeListeners.get('click')?.();
  await wait(400);
  return { pulses: pulses.length, result: root.dataset.turnViewportRepair };
}

// The status-bar gap (iPhone standalone: 793 of 852, inset 59) is the case the pulse
// cannot recover: no pulse at load, none on the first tap.
storage.clear();
assert.deepEqual(await viewportScenario({ dvh: 793, lvh: 852, top: 59 }), { pulses: 0, result: 'skipped' },
  'A status-bar gap never shakes the page with a viewport pulse');
// Another gap: one attempt; when it fails, no second pulse on the first tap, and none on
// the next launch.
storage.clear();
assert.deepEqual(await viewportScenario({ dvh: 700, lvh: 852, top: 59 }), { pulses: 1, result: 'skipped' },
  'A failed pulse is not repeated on the first Home tap');
assert.equal(storage.get('turn-viewport-pulse-ineffective-v1'), '1');
assert.deepEqual(await viewportScenario({ dvh: 700, lvh: 852, top: 59 }), { pulses: 0, result: 'skipped' },
  'A device where the pulse failed never pulses again');
// Where the pulse does recover, it still does.
storage.clear();
assert.deepEqual(await viewportScenario({ dvh: 700, lvh: 852, top: 59, recoverOnPulse: true }), { pulses: 1, result: 'recovered' },
  'A recoverable short viewport is still repaired');
delete globalThis.document;
delete globalThis.window;

// Drift Camera adds its opt-in control to the same Home Settings surface. Keep its
// preference and camera-direction contract in the production Home regression path.
await import('./drift-camera-production.mjs');

console.log('TURN short iOS viewport production repair and vertical-only Home menu passed.');
