import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [index, script, styles, manifest, productionMotion] = await Promise.all([
  fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../portrait-play-r1.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../portrait-play-r1.css', import.meta.url), 'utf8'),
  fs.readFile(new URL('../site.webmanifest', import.meta.url), 'utf8'),
  fs.readFile(new URL('../../turn/input/motion.js', import.meta.url), 'utf8')
]);

assert.match(index, /\/turn-lab\/portrait-play-r1\.css\?revision=r1/);
assert.match(index, /\/turn-lab\/portrait-play-r1\.js\?revision=r1/);
assert.match(index, /site\.webmanifest\?revision=portrait-play-r1/);
assert.ok(
  index.indexOf('/turn-lab/portrait-play-r1.js') < index.indexOf('./orientation-compat.js'),
  'The LAB profile and orientation-lock shim must run before production orientation compatibility'
);
assert.equal(JSON.parse(manifest).orientation, 'any', 'TURN LAB must remain installable in portrait');

assert.match(script, /PORTRAIT_STEERING_DEGREES = 24/);
assert.match(script, /PORTRAIT_HORIZON_DEGREES = 16/);
assert.match(script, /PORTRAIT_CAMERA_ZOOM = 0\.78/);
assert.match(script, /type\.startsWith\('landscape'\)/);
assert.match(script, /TURN LAB is ready\. Portrait play is available/);
assert.match(script, /Hold the phone or tablet in portrait or landscape/);
assert.match(script, /runtime\.state\?\.sensorMode === true/);
assert.match(script, /renderer\.setSize = function usePortraitGameViewport/);
assert.match(script, /screenDegrees = relativeRoll/);

assert.match(styles, /@media \(orientation: portrait\)/);
assert.match(styles, /--turn-portrait-stage-height/);
assert.match(styles, /#game[\s\S]*height: var\(--turn-portrait-stage-height\) !important/);
assert.match(styles, /\.controls[\s\S]*inset: var\(--turn-portrait-stage-height\) 0 0 !important/);
assert.match(styles, /grid-template-rows: 29% 47% 24%/);
assert.match(styles, /\.rotate-panel[\s\S]*display: none !important/);
assert.match(styles, /\.turn-lab-portrait-meter/);

assert.match(productionMotion, /steeringEnterThreshold: degToRad\(2\.2\)/);
assert.match(productionMotion, /steeringExitThreshold: degToRad\(0\.9\)/);
assert.match(productionMotion, /id: 'ipad-damped'/);

const rootClasses = new Set();
const eventHandlers = new Map();
const nativeLocks = [];
const rendererSizes = [];
const styleValues = new Map();
const meterOutput = { textContent: '' };
let meter = null;

function listen(target, type, callback) {
  const key = `${target}:${type}`;
  const handlers = eventHandlers.get(key) || [];
  handlers.push(callback);
  eventHandlers.set(key, handlers);
}

const orientationMedia = {
  matches: true,
  addEventListener(type, callback) { listen('media', type, callback); }
};
const orientation = {
  async lock(type) { nativeLocks.push(type); },
  addEventListener(type, callback) { listen('orientation', type, callback); }
};
const root = {
  dataset: { turnDeployment: 'lab' },
  classList: {
    add(...names) { for (const name of names) rootClasses.add(name); },
    toggle(name, active) {
      if (active) rootClasses.add(name);
      else rootClasses.delete(name);
    }
  }
};
const game = {
  getBoundingClientRect() {
    return orientationMedia.matches
      ? { width: 402, height: 498 }
      : { width: 874, height: 402 };
  }
};
const hud = {
  appendChild(node) { meter = node; }
};
const documentRef = {
  documentElement: root,
  hidden: false,
  querySelector(selector) {
    if (selector === '.turn-lab-portrait-meter') return meter;
    if (selector === '#hud') return hud;
    if (selector === '#game') return game;
    return null;
  },
  createElement() {
    return {
      hidden: false,
      className: '',
      innerHTML: '',
      setAttribute() {},
      querySelector(selector) {
        return selector === '.turn-lab-portrait-meter-value' ? meterOutput : null;
      },
      style: {
        setProperty(name, value) { styleValues.set(name, value); }
      }
    };
  },
  addEventListener(type, callback) { listen('document', type, callback); }
};
const camera = {
  aspect: 0,
  zoom: 1,
  updates: 0,
  updateProjectionMatrix() { this.updates += 1; }
};
const renderer = {
  domElement: {
    style: {
      setProperty(name, value) { styleValues.set(`canvas:${name}`, value); }
    }
  },
  setSize(width, height, updateStyle) {
    rendererSizes.push([width, height, updateStyle]);
    return this;
  }
};
const runtime = {
  camera,
  renderer,
  state: {
    running: true,
    sensorMode: true,
    roll: 12 * Math.PI / 180,
    neutralRoll: 0,
    steering: -0.5
  }
};
const context = {
  console: { info() {} },
  document: documentRef,
  screen: { orientation },
  innerWidth: 402,
  innerHeight: 874,
  matchMedia() { return orientationMedia; },
  addEventListener(type, callback) { listen('window', type, callback); },
  visualViewport: {
    addEventListener(type, callback) { listen('visualViewport', type, callback); }
  },
  requestAnimationFrame() { return 1; },
  cancelAnimationFrame() {},
  setTimeout(callback) { callback(); return 1; },
  clearTimeout() {},
  __TURN_MOTION_SAFE_ZONE__: Object.freeze({ steeringDegrees: 14, horizonDegrees: 14 })
};
context.window = context;
context.globalThis = context;

vm.runInNewContext(script, context, { filename: 'portrait-play-r1.js' });

assert.ok(rootClasses.has('turn-lab-portrait'));
assert.equal(context.__TURN_MOTION_SAFE_ZONE__.steeringDegrees, 24);
assert.equal(context.__TURN_MOTION_SAFE_ZONE__.horizonDegrees, 16);
assert.equal(Object.isFrozen(context.__TURN_MOTION_SAFE_ZONE__), true);

await orientation.lock('landscape');
assert.deepEqual(nativeLocks, [], 'Portrait LAB must absorb the production landscape lock');
await orientation.lock('portrait-primary');
assert.deepEqual(nativeLocks, ['portrait-primary'], 'Non-landscape lock requests must retain native behavior');

for (const callback of eventHandlers.get('window:turn:runtime-ready') || []) {
  callback({ detail: runtime });
}

assert.ok(runtime.__turnLabPortraitPlayInstalled);
assert.ok(rendererSizes.length >= 1);
assert.deepEqual(rendererSizes.at(-1), [402, 498, false]);
assert.equal(camera.aspect, 402 / 498);
assert.equal(camera.zoom, 0.78);
assert.ok(camera.updates >= 1);
assert.equal(meter.hidden, false);
assert.equal(meterOutput.textContent, 'RIGHT · 12.0° · 50%');
assert.equal(styleValues.get('--turn-portrait-steer'), '0.5');
assert.equal(styleValues.get('canvas:width'), '100%');
assert.equal(styleValues.get('canvas:height'), '100%');

runtime.renderer.setSize(96, 64, false);
assert.deepEqual(
  rendererSizes.at(-1),
  [96, 64, false],
  'Explicit thumbnail renders must bypass the portrait viewport override'
);

runtime.renderer.setSize(402, 874);
assert.deepEqual(
  rendererSizes.at(-1),
  [402, 498, false],
  'Normal renderer resizes must remain pinned to the portrait game stage'
);

orientationMedia.matches = false;
for (const callback of eventHandlers.get('media:change') || []) callback();
assert.equal(camera.zoom, 1, 'Returning to landscape must restore production camera zoom');
assert.deepEqual(rendererSizes.at(-1), [874, 402, false]);

console.log('TURN LAB portrait viewport, steering parity, camera and orientation contract passed.');
