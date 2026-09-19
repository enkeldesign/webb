import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const read = (path) => fs.readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const carModels = await read('turn/vehicle/car-models.js');
const main = await read('turn/main.js');

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing production section ${start}`);
  return source.slice(from, to);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const sourceCache = new Map();
const attempts = [];
const loader = {
  loadAsync(url) {
    const request = { ...deferred(), url };
    attempts.push(request);
    return request.promise;
  }
};
const loadCarSource = vm.runInNewContext(
  `${section(carModels, 'async function loadCarSource(', '\nfunction loaderForPack')}\nloadCarSource`,
  {
    sourceCache,
    getCarDefinition: (id) => ({ id, pack: 'default', asset: `./assets/${id}.glb` }),
    loadEmbeddedSupercarSource: () => Promise.reject(new Error('supercar path not used here')),
    loaderForPack: () => loader,
    assetUrl: (path) => path
  }
);

const failedPreload = loadCarSource('sedan').catch(() => null);
assert.equal(attempts.length, 1);
attempts[0].reject(new Error('injected preload failure'));
await failedPreload;
assert.equal(sourceCache.has('sedan'), false,
  'Rejected preload source must not poison later interactive loading');

const sedanSource = { id: 'sedan-source' };
const interactiveRetry = loadCarSource('sedan');
assert.equal(attempts.length, 2, 'Interactive retry must start a fresh source load');
attempts[1].resolve({ scene: sedanSource });
assert.equal(await interactiveRetry, sedanSource);
assert.equal(await loadCarSource('sedan'), sedanSource);
assert.equal(attempts.length, 2, 'Successful source remains cached after retry');

const classicFirst = loadCarSource('classic');
const classicSecond = loadCarSource('classic');
assert.equal(attempts.length, 3, 'Concurrent same-car requests must share one source load');
const classicSource = { id: 'classic-source' };
attempts[2].resolve({ scene: classicSource });
assert.equal(await classicFirst, classicSource);
assert.equal(await classicSecond, classicSource);

const staleAttempt = loadCarSource('truck').catch(() => null);
assert.equal(attempts.length, 4);
const newerSourcePromise = Promise.resolve({ id: 'newer-source' });
sourceCache.set('truck', newerSourcePromise);
attempts[3].reject(new Error('stale source failure'));
await staleAttempt;
assert.equal(sourceCache.get('truck'), newerSourcePromise,
  'Guarded eviction must preserve a newer source cache owner');

const visualRequests = [];
const installCarVisual = vm.runInNewContext(
  `${section(main, 'async function installCarVisual(', '\nasync function applyVehicleSelection')}\ninstallCarVisual`,
  {
    disposeCarVisual() {},
    carShadows: { setCarSize() {} },
    createCarVisual(options) {
      const request = { ...deferred(), options };
      visualRequests.push(request);
      return request.promise;
    }
  }
);

function makeHost() {
  return {
    userData: { turnProceduralParts: [] },
    children: [],
    add(child) {
      this.children.push(child);
      child.parent = this;
    }
  };
}

async function proveVisualRetry(ghost) {
  const host = makeHost();
  const selection = { carId: 'sedan', color: '#123456', secondaryColor: '#abcdef', ghost };
  const failed = installCarVisual(host, selection);
  visualRequests.at(-1).reject(new Error(ghost ? 'rival failure' : 'player failure'));
  await assert.rejects(failed, ghost ? /rival failure/ : /player failure/);
  assert.equal(host.userData.turnVisualPendingKey, null,
    'Failed visual generation must clear the current pending identity');

  const requestCount = visualRequests.length;
  const retried = installCarVisual(host, selection);
  assert.equal(visualRequests.length, requestCount + 1,
    'The same visual identity must be retried after failure');
  const visual = { userData: {} };
  visualRequests.at(-1).resolve(visual);
  await retried;
  assert.equal(visual.parent, host);
  assert.equal(host.userData.turnVisualKey,
    `sedan|#123456|#abcdef|${ghost ? 1 : 0}`);
}

await proveVisualRetry(false);
await proveVisualRetry(true);

console.log('Car source and visual failure-recovery regression passed.');
