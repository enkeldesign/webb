import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { setImmediate as settle } from 'node:timers/promises';
// Reuse the repository's vendored copy of the exact production Three version.
// CI watches these vendor files; no network download or WebGL driver is needed.
import * as THREE from '../postal/vendor/three.module.min.js';
import * as catalog from '../turn/vehicle/catalog.js';
import * as wheelRig from '../turn/vehicle/wheel-animation-rig.js';
import {
  createCarVisualResourceOwner,
  disposeCarVisual,
  retainCarVisualResources
} from '../turn/vehicle/car-visual-resources.js';

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const entry = await read('turn/index.html');
assert.ok(entry.includes(`three@0.${THREE.REVISION}.0/build/three.module.js`),
  'Resource tests must use the same Three version as production');

async function moduleUnderTest(path, bindings, exports, suffix = '') {
  const source = (await read(path))
    .replace(/^import[\s\S]*?;\n/gm, '')
    .replace(/^export\s*\{[^}]*\}(?:\s*from\s*['"][^'"]+['"])?;\n/gm, '')
    .replace(/^export (?=(?:async )?function|const|class)/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(new URL(`../${path}`, import.meta.url).href));
  return vm.runInNewContext(`${source}\n${suffix}\n({ ${exports.join(', ')} })`, {
    console, URL, performance, ...bindings
  }, { filename: path });
}

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = end ? source.indexOf(end, from + start.length) : source.length;
  assert.ok(from >= 0 && to > from, `Missing production function ${start}`);
  return source.slice(from, to);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const disposalCounts = new Map();
const owned = new Set();
const visualResources = new Map();
function observeResource(resource) {
  if (disposalCounts.has(resource)) return resource;
  const dispose = resource.dispose;
  assert.equal(typeof dispose, 'function', 'Registered resources must expose disposal');
  disposalCounts.set(resource, 0);
  resource.dispose = function () {
    disposalCounts.set(resource, disposalCounts.get(resource) + 1);
    return dispose.call(this);
  };
  return resource;
}
function trackedOwner(root) {
  const owner = createCarVisualResourceOwner(root);
  const resources = new Set();
  visualResources.set(root, resources);
  return {
    has: owner.has,
    own(resource) {
      observeResource(resource);
      resources.add(resource);
      owned.add(resource);
      return owner.own(resource);
    }
  };
}
function assertReleased(resources, count = 1) {
  for (const resource of resources) assert.equal(disposalCounts.get(resource), count,
    `${resource.type || resource.constructor.name} must be disposed exactly ${count} times`);
}
const liveOwnedCount = () => [...owned].filter((resource) => !disposalCounts.get(resource)).length;

// Real Three objects, with a deterministic source loader in place of GLB I/O.
// The factory, paint/livery, wheel installation and resource ownership run intact.
const source = new THREE.Group();
const sourceTexture = observeResource(new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1));
const sourceMaterial = observeResource(new THREE.MeshStandardMaterial({ map: sourceTexture }));
sourceMaterial.name = 'body';
const bodyGeometry = observeResource(new THREE.BoxGeometry(2, 1, 4));
const body = new THREE.Mesh(bodyGeometry, sourceMaterial);
body.name = 'body';
source.add(body);
const wheelGeometry = observeResource(new THREE.BufferGeometry());
wheelGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
  0, -0.5, -0.5, 0.4, 0.5, -0.5, 0, 0.5, 0.5,
  0, -0.5, -0.5, 0.4, 0.5, -0.5, 0, 0.5, 0.5
], 3));
wheelGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([
  11 / 32, 0.5, 11 / 32, 0.5, 11 / 32, 0.5,
  15 / 32, 0.5, 15 / 32, 0.5, 15 / 32, 0.5
], 2));
wheelGeometry.setIndex([0, 1, 2, 3, 4, 5]);
for (const role of ['front-left', 'front-right', 'back-left', 'back-right']) {
  const wheel = new THREE.Mesh(wheelGeometry, sourceMaterial);
  wheel.name = `wheel-${role}`;
  source.add(wheel);
}
const borrowed = [sourceTexture, sourceMaterial, bodyGeometry, wheelGeometry];
const gamut = await moduleUnderTest('turn/vehicle/wide-gamut.js', { THREE }, ['makeWideGamutSpec', 'setThreeColor']);
const learner = await moduleUnderTest('turn/vehicle/learner-car-livery.js', { THREE },
  ['installLearnerCarLivery', 'getLearnerSignFaceTexture']);
borrowed.push(observeResource(learner.getLearnerSignFaceTexture()));
const supercar = await moduleUnderTest('turn/vehicle/supercar-kenney-wheels.js', { THREE }, ['installSupercarKenneyWheels']);
const semantic = await moduleUnderTest('turn/vehicle/semantic-car-finish.js', { THREE, ...gamut },
  ['getKenneyPaletteAsset', 'installSemanticCarFinish', 'recolorSemanticCarFinish']);
let sourceReads = 0;
let failPaint = false;
const models = await moduleUnderTest('turn/vehicle/car-models.js', {
  THREE, ...catalog, ...gamut, ...wheelRig, ...learner, ...supercar, ...semantic,
  createCarVisualResourceOwner: trackedOwner, disposeCarVisual, retainCarVisualResources,
  readCarSource: async () => { sourceReads += 1; return source; },
  installSemanticCarFinish(options) {
    if (failPaint) throw new Error('injected paint failure');
    return semantic.installSemanticCarFinish(options);
  }
}, ['createCarVisual', 'recolorCarVisual', 'competitorGhostTemplateCache', 'CAR_OUTLINE_MATERIAL'],
'loadCarSource = readCarSource;');
borrowed.push(observeResource(models.CAR_OUTLINE_MATERIAL));

for (const carId of ['sedan', 'classic', 'supercar', 'police', 'ambulance', 'firetruck']) {
  const first = await models.createCarVisual({ carId, color: '#123456', secondaryColor: '#abcdef' });
  const second = await models.createCarVisual({ carId, color: '#654321', secondaryColor: '#fedcba' });
  const resources = visualResources.get(first);
  assert.ok(resources.size >= 5, `${carId} owns its prepared materials`);
  if (carId === 'classic') {
    const sign = first.getObjectByName('kenney-taxi-roof-sign-learner-livery');
    assert.ok(resources.has(sign.geometry));
    assert.ok(sign.material.every((material) => resources.has(material)));
    assert.equal(resources.has(sign.material[1].map), false, 'Learner sign texture is shared');
  }
  if (carId === 'supercar') {
    assert.ok([...resources].filter((resource) => resource.isBufferGeometry).length >= 12,
      'Split tyres/rims and empty original wheel geometry are owned');
  }
  if (first.userData.turnEmergencyLightRig) {
    assert.equal([...resources].filter((resource) => resource.isPointLight).length, 2,
      'Non-mesh light resources participate in ownership');
    assert.equal([...resources].filter((resource) => resource.isBufferGeometry).length, 6);
  }
  disposeCarVisual(first);
  disposeCarVisual(first);
  assertReleased(resources);
  assertReleased(visualResources.get(second), 0);
  assertReleased(borrowed, 0);
  models.recolorCarVisual(second, '#112233', '#445566');
  assert.equal(second.userData.turnCarColor, '#112233');
  assert.equal(second.userData.turnCarSecondaryColor, '#445566');
  assert.ok(second.userData.wheelSpinners.length, 'Authored wheel references survive another visual disposal');
  disposeCarVisual(second);
}
assert.equal(liveOwnedCount(), 0);

failPaint = true;
await assert.rejects(models.createCarVisual({ carId: 'sedan' }), /injected paint failure/);
failPaint = false;
assert.equal(liveOwnedCount(), 0, 'Factory failure releases partially prepared resources');

const ghostOptions = { carId: 'classic', color: '#123456', secondaryColor: '#abcdef', ghost: true, targetLength: 5.5 };
const originalGhost = await models.createCarVisual(ghostOptions);
assert.equal([...models.competitorGhostTemplateCache.values()][0].visual, originalGhost,
  'The cache retains the prepared graph directly without an extra first-rival clone');
const ghostResources = visualResources.get(originalGhost);
const readsBeforeCloning = sourceReads;
const ghostClone = await models.createCarVisual(ghostOptions);
assert.equal(sourceReads, readsBeforeCloning, 'Fast rival cloning never reloads or rebuilds a source');
disposeCarVisual(originalGhost);
assertReleased(ghostResources, 0);
const laterClone = await models.createCarVisual(ghostOptions);
assert.ok(laterClone.children.length, 'Disposing the first live car cannot empty its cached template');
assert.ok(laterClone.userData.wheelSpinners.length);
for (let i = 0; i < 40; i += 1) {
  const visual = await models.createCarVisual({ ...ghostOptions, carId: 'sedan', color: `#${(i + 100).toString(16).padStart(6, '0')}` });
  disposeCarVisual(visual);
  assert.ok(models.competitorGhostTemplateCache.size <= 16);
  assert.ok(liveOwnedCount() <= 16 * 5 + ghostResources.size,
    'Evicted templates release resources while the bounded cache and live clones retain theirs');
}
assertReleased(ghostResources, 0, 'Live rivals outlive template eviction');
disposeCarVisual(ghostClone);
assertReleased(ghostResources, 0);
disposeCarVisual(laterClone);
assertReleased(ghostResources);
for (const template of models.competitorGhostTemplateCache.values()) disposeCarVisual(template.lease);
models.competitorGhostTemplateCache.clear();
assert.equal(liveOwnedCount(), 0);
assertReleased(borrowed, 0);

const [concurrentFirst, concurrentSecond] = await Promise.all([
  models.createCarVisual(ghostOptions), models.createCarVisual(ghostOptions)
]);
disposeCarVisual(concurrentFirst);
assertReleased(visualResources.get(concurrentFirst));
assertReleased(visualResources.get(concurrentSecond), 0);
for (const template of models.competitorGhostTemplateCache.values()) disposeCarVisual(template.lease);
models.competitorGhostTemplateCache.clear();
assertReleased(visualResources.get(concurrentSecond), 0, 'Eviction cannot release a still-installed concurrent result');
disposeCarVisual(concurrentSecond);
assert.equal(liveOwnedCount(), 0);

function ownedVisual() {
  const root = new THREE.Group();
  const resources = trackedOwner(root);
  root.add(new THREE.Mesh(resources.own(new THREE.BoxGeometry()), resources.own(new THREE.MeshBasicMaterial())));
  return root;
}

const main = await read('turn/main.js');
const requests = [];
const installCarVisual = vm.runInNewContext(
  `${section(main, 'async function installCarVisual(', '\nasync function applyVehicleSelection')}\ninstallCarVisual`,
  { disposeCarVisual, createCarVisual: (options) => { const request = { ...deferred(), options }; requests.push(request); return request.promise; } }
);
const host = new THREE.Group();
const fallback = new THREE.Mesh(bodyGeometry, sourceMaterial);
host.add(fallback);
host.userData.turnProceduralParts = [fallback];
const selection = (color) => ({ carId: 'sedan', color, secondaryColor: '#abcdef' });
const firstRequest = installCarVisual(host, selection('#111111'));
await installCarVisual(host, selection('#111111'));
assert.equal(requests.length, 1, 'Duplicate pending identities share one creation');
const newerRequest = installCarVisual(host, selection('#222222'));
const newest = ownedVisual();
requests[1].resolve(newest);
await newerRequest;
const stale = ownedVisual();
requests[0].resolve(stale);
await firstRequest;
assertReleased(visualResources.get(stale));
assert.equal(newest.parent, host);
assert.equal(fallback.visible, false);
const pendingOther = installCarVisual(host, selection('#333333'));
await installCarVisual(host, selection('#222222'));
const abandoned = ownedVisual();
requests[2].resolve(abandoned);
await pendingOther;
assertReleased(visualResources.get(abandoned));
assert.equal(newest.parent, host, 'Reselecting the installed identity invalidates a different pending result');
const replacementRequest = installCarVisual(host, selection('#444444'));
const replacement = ownedVisual();
requests[3].resolve(replacement);
await replacementRequest;
assertReleased(visualResources.get(newest));
assert.equal(host.children.filter((child) => child.userData.turnAssetVisual).length, 1);
const staleFailure = installCarVisual(host, selection('#555555'));
const currentFailure = installCarVisual(host, selection('#666666'));
requests[4].reject(new Error('old load failure'));
await staleFailure;
assert.equal(host.userData.turnVisualPendingKey, 'sedan|#666666|#abcdef|0');
requests[5].reject(new Error('current load failure'));
await assert.rejects(currentFailure, /current load failure/);
assert.equal(host.userData.turnVisualPendingKey, null);
assert.equal(replacement.parent, host, 'A failed replacement preserves the installed visual');
disposeCarVisual(host);
assertReleased(visualResources.get(replacement));
assertReleased(borrowed, 0);

class Element {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.dataset = {};
    this.classList = { add() {}, remove() {} };
    this.isConnected = true;
    this.width = 240;
    this.height = 140;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  appendChild(child) { child.remove?.(); this.children.push(child); child.parentElement = this; }
  replaceChildren(...children) {
    for (const child of [...this.children]) child.remove();
    for (const child of children) this.appendChild(child);
  }
  remove() {
    const siblings = this.parentElement?.children;
    if (siblings) siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }
  getBoundingClientRect() { return { width: 240, height: 140 }; }
  setAttribute() {}
  getContext() { return { clearRect() {}, drawImage() {} }; }
}

function browserHarness({ idle = true, reducedMotion = false } = {}) {
  const frames = new Map();
  const idles = new Map();
  const timers = new Map();
  const renderers = [];
  const observers = [];
  const warnings = [];
  let serial = 0;
  const schedule = (queue, callback) => { const id = ++serial; queue.set(id, callback); return id; };
  class Renderer {
    constructor() {
      this.domElement = new Element();
      this.disposals = 0;
      this.contextLosses = 0;
      this.renders = 0;
      this.loop = null;
      renderers.push(this);
    }
    setSize() {}
    setPixelRatio() {}
    setClearColor() {}
    getRenderTarget() { return this.target || null; }
    setRenderTarget(target) { this.target = target; }
    setAnimationLoop(callback) { this.loop = callback; }
    compile() { if (this.failCompile) throw new Error('compile failed'); }
    compileAsync() { return this.compilation?.promise || Promise.resolve(); }
    render() {
      assert.equal(this.disposals, 0, 'No render after renderer teardown');
      assert.equal(this.contextLosses, 0);
      if (this.failRender) throw new Error('render failed');
      this.renders += 1;
    }
    dispose() { this.disposals += 1; this.loop = null; }
    forceContextLoss() { this.contextLosses += 1; }
  }
  class Observer {
    constructor(callback) { this.callback = callback; this.active = false; observers.push(this); }
    observe() { this.active = true; }
    disconnect() { this.active = false; }
  }
  const bindings = {
    THREE: { ...THREE, WebGLRenderer: Renderer, Clock: class { getElapsedTime() { return 0; } } },
    document: { hidden: false }, devicePixelRatio: 2,
    console: { warn: (...args) => warnings.push(args), log() {} },
    matchMedia: () => ({ matches: reducedMotion }),
    ResizeObserver: Observer, IntersectionObserver: Observer,
    requestAnimationFrame: (callback) => schedule(frames, callback),
    cancelAnimationFrame: (id) => frames.delete(id),
    setTimeout: (callback) => schedule(timers, callback),
    clearTimeout: (id) => timers.delete(id)
  };
  if (idle) {
    bindings.requestIdleCallback = (callback) => schedule(idles, callback);
    bindings.cancelIdleCallback = (id) => idles.delete(id);
  }
  bindings.window = bindings;
  function run(queue) {
    const entries = [...queue];
    queue.clear();
    for (const [, callback] of entries) callback(100);
  }
  function assertStopped() {
    assert.equal(frames.size + idles.size + timers.size, 0, 'Teardown leaves no frame, idle or timer callbacks');
    assert.ok(observers.every((observer) => !observer.active), 'Teardown disconnects every observer');
    for (const renderer of renderers) {
      assert.equal(renderer.disposals, 1);
      assert.equal(renderer.contextLosses, 1, 'Each short-lived context is explicitly released once');
      assert.equal(renderer.loop, null);
    }
  }
  return { bindings, frames, idles, timers, renderers, observers, warnings, run, assertStopped };
}

for (const idle of [true, false]) {
  const env = browserHarness({ idle });
  const pending = [];
  const onboarding = await moduleUnderTest('turn/ui/rival-onboarding.js', {
    ...catalog, ...env.bindings, disposeCarVisual,
    createCarVisual: () => { const request = deferred(); pending.push(request); return request.promise; }
  }, ['createGhostPreview']);
  for (let i = 0; i < 24; i += 1) {
    const preview = onboarding.createGhostPreview({ modelHost: new Element(), carId: 'classic' });
    const next = ownedVisual();
    const resources = visualResources.get(next);
    if (i % 3 === 0) {
      preview.start();
      preview.dispose();
      pending.at(-1).resolve(next);
      await settle();
    } else {
      pending.at(-1).resolve(next);
      await settle();
      assert.equal(env.idles.size + env.timers.size, 1);
      if (i % 3 === 1) {
        env.run(idle ? env.idles : env.timers);
        preview.start();
        env.run(env.frames);
      }
      preview.dispose();
    }
    preview.dispose();
    assertReleased(resources);
    env.assertStopped();
  }
  const compiling = onboarding.createGhostPreview({ modelHost: new Element() });
  compiling.renderer.compilation = deferred();
  const visual = ownedVisual();
  pending.at(-1).resolve(visual);
  await settle();
  compiling.dispose();
  assert.equal(compiling.renderer.disposals, 0, 'The native compiler must finish before renderer state is destroyed');
  assertReleased(visualResources.get(visual), 0, 'In-flight compilation still owns its materials');
  assert.equal(env.frames.size + env.idles.size + env.timers.size, 0);
  assert.equal(compiling.renderer.domElement.parentElement, null, 'Closing never waits to detach the preview');
  compiling.renderer.compilation.resolve();
  await settle();
  assertReleased(visualResources.get(visual));
  env.assertStopped();

  let failures = 0;
  const failed = onboarding.createGhostPreview({ modelHost: new Element(), onError: () => { failures += 1; } });
  pending.at(-1).reject(new Error('model unavailable'));
  await settle();
  failed.dispose();
  assert.equal(failures, 1);
  env.assertStopped();

  const failedCompile = onboarding.createGhostPreview({ modelHost: new Element(), onError: () => { failures += 1; } });
  failedCompile.renderer.compilation = deferred();
  failedCompile.renderer.failCompile = true;
  const compileVisual = ownedVisual();
  pending.at(-1).resolve(compileVisual);
  await settle();
  failedCompile.renderer.compilation.reject(new Error('async compile unavailable'));
  await settle();
  env.run(idle ? env.idles : env.timers);
  assert.equal(failures, 2);
  assertReleased(visualResources.get(compileVisual));
  env.assertStopped();
}

const onboardingSource = await read('turn/ui/rival-onboarding.js');
for (const cancelWarmup of [true, false]) {
  const env = browserHarness();
  const renderer = new env.bindings.THREE.WebGLRenderer();
  renderer.compilation = deferred();
  const rival = ownedVisual();
  rival.userData.turnAssetVisual = true;
  const car = new THREE.Group();
  car.userData.turnVisualKey = 'prepared-rival';
  car.add(rival);
  const runtime = { renderer, scene: new THREE.Scene(), competitorCars: [car], state: { trackId: 'airport', competitorLaps: [{}] } };
  const warmup = vm.runInNewContext(`
    let raceWarmGeneration = 1, raceWarmIdleHandle = 0, raceWarmTimer = 0, warmedRaceIdentity = '';
    ${section(onboardingSource, '  function raceRivalVisuals(', '  function scheduleRaceRivalWarmup(')}
    ({ warm: () => warmRaceRivalRenderer(1), cancel: () => { raceWarmGeneration += 1; } })
  `, {
    ...env.bindings, __turnRuntime: runtime, disposeCarVisual, retainCarVisualResources,
    RACE_RIVAL_WARM_TARGET_SIZE: 64, RACE_RIVAL_WARM_MAX_RETRIES: 6, RACE_RIVAL_WARM_RETRY_MS: 80
  });
  const pending = warmup.warm();
  if (cancelWarmup) {
    disposeCarVisual(rival);
    warmup.cancel();
  }
  assertReleased(visualResources.get(rival), 0, 'Race GPU preparation retains resources across replacement/reset');
  renderer.compilation.resolve();
  await pending;
  assert.equal(renderer.renders, cancelWarmup ? 0 : 1);
  assert.equal(renderer.getRenderTarget(), null, 'Rival warm-up restores the gameplay render target');
  if (!cancelWarmup) {
    assertReleased(visualResources.get(rival), 0, 'Completed prewarming releases its lease, not the live rival');
    disposeCarVisual(rival);
  }
  assertReleased(visualResources.get(rival));
  assert.equal(renderer.disposals + renderer.contextLosses, 0, 'Preview cleanup never destroys the race renderer');
}

const lotEnv = browserHarness();
const lotRequests = [];
const lot = await moduleUnderTest('turn/garage/lot-showroom-experiment.js', {
  ...catalog, ...lotEnv.bindings, disposeCarVisual, recolorCarVisual: models.recolorCarVisual,
  recordPerformanceFrame() {},
  createCarVisual: () => { const request = deferred(); lotRequests.push(request); return request.promise; }
}, ['createViewer', 'createThumbnailRenderer']);
const viewerHost = new Element();
const viewer = lot.createViewer(viewerHost);
const oldShow = viewer.show('sedan', '#111111', '#abcdef');
const newShow = viewer.show('sedan', '#222222', '#fedcba');
const displayed = ownedVisual();
lotRequests[1].resolve(displayed);
await newShow;
const oldShowVisual = ownedVisual();
lotRequests[0].resolve(oldShowVisual);
await oldShow;
assertReleased(visualResources.get(oldShowVisual));
assert.equal(displayed.userData.turnCarColor, '#222222');
const lateShow = viewer.show('classic', '#333333', '#fedcba');
viewer.stop();
viewer.dispose();
viewer.dispose();
const lateShowVisual = ownedVisual();
lotRequests[2].resolve(lateShowVisual);
await lateShow;
assertReleased(visualResources.get(lateShowVisual));
assertReleased(visualResources.get(displayed));
assert.equal([...viewerHost.listeners.values()].reduce((total, listeners) => total + listeners.size, 0), 0,
  'Disposed Lot viewers release their drag listeners');
lotEnv.assertStopped();

for (const cancelBeforeLoad of [true, false]) {
  const thumbnails = lot.createThumbnailRenderer();
  const canvas = new Element();
  const button = new Element();
  button.querySelector = () => canvas;
  const car = catalog.getCarDefinition('classic');
  const task = thumbnails.renderOne(car, button, { color: '#123456', secondaryColor: '#abcdef' });
  await settle();
  if (cancelBeforeLoad) thumbnails.cancel();
  const visual = ownedVisual();
  lotRequests.at(-1).resolve(visual);
  await settle();
  if (!cancelBeforeLoad) assert.equal(lotEnv.idles.size, 1);
  thumbnails.cancel();
  thumbnails.cancel();
  await task;
  assertReleased(visualResources.get(visual));
  lotEnv.assertStopped();
}
const observerThumbnails = lot.createThumbnailRenderer();
observerThumbnails.observeVisible([catalog.getCarDefinition('classic')], new Map([['classic', new Element()]]), () => ({}), new Element());
observerThumbnails.cancel();
lotEnv.assertStopped();

const trophyEnv = browserHarness();
const trophyRequests = [];
const trophy = await moduleUnderTest('turn/achievements/trophy-road-showcase.js', {
  ...catalog, ...trophyEnv.bindings, disposeCarVisual, configureRendererWideGamut() {},
  createCarVisual: () => { const request = deferred(); trophyRequests.push(request); return request.promise; }
}, ['createTrophyRoadShowcase']);
const showcase = trophy.createTrophyRoadShowcase();
const pack = showcase.show({ id: 'emergency-pack' }, new Element());
const completedPackVisual = ownedVisual();
trophyRequests[0].resolve(completedPackVisual);
await settle();
trophyRequests[1].reject(new Error('one pack model failed'));
assert.equal(await pack, false);
assertReleased(visualResources.get(completedPackVisual));
const latePackVisual = ownedVisual();
trophyRequests[2].resolve(latePackVisual);
await settle();
assertReleased(visualResources.get(latePackVisual));
const raceReward = showcase.show({ id: 'race-car' }, new Element());
const raceVisual = ownedVisual();
trophyRequests[3].resolve(raceVisual);
assert.equal(await raceReward, true);
showcase.clear();
assertReleased(visualResources.get(raceVisual), 0, 'Cached reward groups survive a normal hide');
const pendingReward = showcase.show({ id: 'supercar' }, new Element());
showcase.dispose();
showcase.dispose();
const lateReward = ownedVisual();
trophyRequests[4].resolve(lateReward);
assert.equal(await pendingReward, false);
assertReleased(visualResources.get(lateReward));
assertReleased(visualResources.get(raceVisual));
trophyEnv.assertStopped();

const homeEnv = browserHarness();
const homeRequest = deferred();
const home = await moduleUnderTest('turn/ui/track-best-car.js', {
  ...catalog, ...homeEnv.bindings, disposeCarVisual, createCarVisual: () => homeRequest.promise
}, ['renderThumbnail'], 'waitForHomeThumbnailSlot = async () => {};');
const homeTask = home.renderThumbnail({ carId: 'classic' });
await settle();
homeEnv.renderers[0].failRender = true;
const homeVisual = ownedVisual();
homeRequest.resolve(homeVisual);
await assert.rejects(homeTask, /render failed/);
assertReleased(visualResources.get(homeVisual));
homeEnv.assertStopped();
assert.equal(liveOwnedCount(), 0, 'All test-created visual resources have been released');
assertReleased(borrowed, 0, 'No viewer disposes borrowed geometry, materials or textures');

console.log('TURN car ownership, bounded rival templates, stale selections, preview teardown and late/failed loads passed.');
