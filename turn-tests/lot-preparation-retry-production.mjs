import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const [wrapperSource, homeSource] = await Promise.all([
  fs.readFile(new URL('../turn/garage/lot-track-select.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8')
]);
// Run the production loader with controlled transport/DOM dependencies. Keep
// its real Promise caches, preparation ordering and synchronous mounting code.
const wrapper = wrapperSource
  .replace(/^import[\s\S]*?;\n/gm, '')
  .replace(/import\.meta\.url/g, "'https://enkel.design/turn/garage/lot-track-select.js'")
  .replace(/\bimport\(/g, 'importModule(')
  .replace(/^export /gm, '');
const homePreparation = homeSource.slice(
  homeSource.indexOf('  function prepareLotOnce()'),
  homeSource.indexOf('  function scheduleEnhancedLotWarmup()')
);
assert.ok(homePreparation.includes('return lotWarmupPromise;'));

function harness({ failImport, failEnhancements = false, autoStyles = true, cancelSelection = false } = {}) {
  const links = new Map();
  const appended = [];
  const importCounts = new Map();
  let enhancementAttempts = 0;
  let mounted = 0;
  class Link extends EventTarget {
    sheet = null;
    remove() { links.delete(this.id); }
    load() { this.sheet = {}; this.dispatchEvent(new Event('load')); }
  }
  const api = vm.runInNewContext(`${wrapper}\n;({ prepareEnhancedLot, showEnhancedLot, showTheLot });`, {
    URL, Promise,
    document: {
      getElementById: (id) => links.get(id),
      createElement: () => new Link(),
      head: {
        appendChild(link) {
          links.set(link.id, link);
          appended.push(link);
          if (autoStyles) queueMicrotask(() => link.load());
        }
      }
    },
    importModule(specifier) {
      const count = (importCounts.get(specifier) || 0) + 1;
      importCounts.set(specifier, count);
      if (specifier.includes(failImport || '\0') && count === 1) {
        return Promise.reject(new Error(`Transient import failure: ${specifier}`));
      }
      return Promise.resolve(specifier.includes('lot-screen-reader')
        ? { installLotScreenReaderPass: () => () => {} }
        : { showTheLot: () => { mounted++; return Promise.resolve({ carId: 'sedan' }); } });
    },
    prepareLotEnhancements() {
      enhancementAttempts++;
      return failEnhancements && enhancementAttempts === 1
        ? Promise.reject(new Error('Transient enhancement failure')) : Promise.resolve();
    },
    enhanceLotNow: () => () => {},
    installLotPwaColorSwatches: () => () => {},
    chooseTrackBeforeLot: async () => cancelSelection ? null : 'harbor',
    showTrackIntro: async () => {}
  });
  const prepareHome = vm.runInNewContext(
    `let lotWarmupPromise = null;\n${homePreparation}\nprepareLotOnce;`,
    { prepareEnhancedLot: api.prepareEnhancedLot }
  );
  return { api, prepareHome, links, appended, importCounts, get mounted() { return mounted; } };
}

for (const failImport of ['lot-showroom-experiment', 'lot-screen-reader']) {
  const h = harness({ failImport });
  const background = h.prepareHome();
  assert.equal(h.prepareHome(), background, 'Background and interactive preparation share one pending attempt');
  await assert.rejects(background, /Transient import failure/);
  const retry = h.prepareHome();
  assert.notEqual(retry, background, 'A rejected Home preparation must not poison the next Continue action');
  await retry;
  assert.equal(h.prepareHome(), retry, 'Successful preparation remains cached');
  for (const [specifier, count] of h.importCounts) {
    assert.equal(count, specifier.includes(failImport) ? 2 : 1,
      'Retry only the failed module, preserving successful and in-flight dependencies');
  }
  const selection = h.api.showEnhancedLot();
  assert.equal(h.mounted, 1, 'Fully prepared M8 mounts synchronously for the motion-access gate');
  await selection;
  assert.equal(h.appended.length, 7, 'Module retries do not duplicate stylesheet links');
}

const partial = harness({ autoStyles: false });
const firstAttempt = partial.prepareHome();
const rejected = assert.rejects(firstAttempt, /stylesheet could not be loaded/);
const originalLinks = [...partial.links.values()];
assert.equal(originalLinks.length, 7);
originalLinks[0].dispatchEvent(new Event('error'));
await rejected;
assert.equal(partial.links.has(originalLinks[0].id), false, 'Remove the failed link so a later attempt can reload it');
const mounting = partial.api.showEnhancedLot();
assert.equal(partial.mounted, 0, 'Cached modules alone must not bypass pending styles/enhancements');
assert.equal(partial.appended.length, 8, 'Retry creates exactly the failed stylesheet again');
for (const link of originalLinks.slice(1)) assert.equal(partial.links.get(link.id), link);
partial.links.get(originalLinks[0].id).load();
await Promise.resolve();
assert.equal(partial.mounted, 0, 'A retry must still await stylesheet requests from the first attempt');
for (const link of originalLinks.slice(1)) link.load();
await mounting;
assert.equal(partial.mounted, 1);
await partial.prepareHome();
const readyMount = partial.api.showEnhancedLot();
assert.equal(partial.mounted, 2, 'The success path retains synchronous mount after recovery');
await readyMount;
assert.equal(partial.appended.length, 8);

const enhancement = harness({ failEnhancements: true });
await assert.rejects(enhancement.prepareHome(), /Transient enhancement failure/);
assert.equal(enhancement.mounted, 0);
await enhancement.prepareHome();
await enhancement.api.showEnhancedLot();
assert.equal(enhancement.mounted, 1);
assert.ok([...enhancement.importCounts.values()].every((count) => count === 1));

const cancelled = harness({ failImport: 'lot-showroom-experiment', cancelSelection: true });
assert.equal(await cancelled.api.showTheLot(), null);
await new Promise(setImmediate); // An abandoned background failure must not be unhandled.
assert.equal(cancelled.mounted, 0);
console.log('TURN Lot preparation: Home/import/style/enhancement retries, coalescing, cancellation and synchronous mount passed.');
