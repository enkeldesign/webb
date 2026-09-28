import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const { Event, EventTarget, queueMicrotask } = globalThis;

// GARAGE preparation: ROADBOOK's background and interactive preparation share one
// attempt, a failed attempt never poisons the next CHOOSE CAR, and a failed stylesheet
// is the only one requested again.
const [garageSource, homeSource] = await Promise.all([
  fs.readFile(new URL('../turn/garage/garage.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/m8-home.js', import.meta.url), 'utf8')
]);
const stylesheetLoader = garageSource.slice(
  garageSource.indexOf('function prepareStylesheet('),
  garageSource.indexOf('function statRows(')
)
  .replace(/^export /gm, '')
  .replaceAll('import.meta.url', "'https://enkel.design/turn/garage/garage.js'");
assert.ok(stylesheetLoader.includes('function prepareGarage()'));
const homePreparation = homeSource.slice(
  homeSource.indexOf('  let garageModule = null;'),
  homeSource.indexOf('  function scheduleEnhancedLotWarmup()')
).replace(/\bimport\(/g, 'importModule(');
assert.ok(homePreparation.includes('return lotWarmupPromise;'));

function stylesheetHarness({ autoLoad = true } = {}) {
  const links = new Map();
  const appended = [];
  class Link extends EventTarget {
    sheet = null;
    remove() { links.delete(this.id); }
    load() { this.sheet = {}; this.dispatchEvent(new Event('load')); }
  }
  const document = {
    getElementById: (id) => links.get(id),
    createElement: () => new Link(),
    head: {
      appendChild(link) {
        links.set(link.id, link);
        appended.push(link);
        if (autoLoad) queueMicrotask(() => link.load());
      }
    }
  };
  const prepareGarage = vm.runInNewContext(
    `let stylesPromise = null;\n${stylesheetLoader}\nprepareGarage;`,
    { URL, Promise, document, __TURN_BUILD__: { cacheKey: '20260928-test' } }
  );
  return { prepareGarage, links, appended };
}

// A failed stylesheet is removed, retried alone, and the retry still waits for the
// stylesheet requested by the first attempt.
const partial = stylesheetHarness({ autoLoad: false });
const firstAttempt = partial.prepareGarage();
assert.equal(partial.prepareGarage(), firstAttempt, 'Concurrent callers share one pending attempt');
const rejected = assert.rejects(firstAttempt, /GARAGE stylesheet could not be loaded/);
const originalLinks = [...partial.links.values()];
assert.equal(originalLinks.length, 2, 'GARAGE and its SHIFT dialog each have one stylesheet');
assert.match(originalLinks[0].href, /\/garage\/garage\.css\?build=20260928-test$/, 'Stylesheets carry the build identity');
originalLinks[0].dispatchEvent(new Event('error'));
await rejected;
assert.equal(partial.links.has(originalLinks[0].id), false, 'Remove the failed link so a later attempt can reload it');
const retry = partial.prepareGarage();
assert.notEqual(retry, firstAttempt, 'A rejected preparation must not poison the next attempt');
assert.equal(partial.appended.length, 3, 'Retry creates exactly the failed stylesheet again');
assert.equal(partial.links.get(originalLinks[1].id), originalLinks[1], 'The in-flight stylesheet is reused, not duplicated');
let settled = false;
void retry.then(() => { settled = true; });
partial.links.get(originalLinks[0].id).load();
await Promise.resolve();
await Promise.resolve();
assert.equal(settled, false, 'A retry still awaits the stylesheet requested by the first attempt');
originalLinks[1].load();
await retry;
assert.equal(partial.prepareGarage(), retry, 'Successful preparation remains cached');
assert.equal(partial.appended.length, 3);

// ROADBOOK: background warm-up and CHOOSE CAR share one attempt; an import failure
// is retried on the next attempt and success stays cached.
function homeHarness({ failImports = 1, failStyles = 0 } = {}) {
  let imports = 0;
  let styles = 0;
  const module = {
    prepareGarage() {
      styles += 1;
      return styles <= failStyles ? Promise.reject(new Error('Transient stylesheet failure')) : Promise.resolve();
    },
    showGarage: () => Promise.resolve(null)
  };
  const prepare = vm.runInNewContext(
    `let lotWarmupPromise = null;\n${homePreparation}\n({ prepareGarageOnce, module: () => garageModule });`,
    {
      Promise,
      importModule(specifier) {
        assert.equal(specifier, '/turn/garage/garage.js', 'ROADBOOK imports GARAGE through its import-mapped path');
        imports += 1;
        return imports <= failImports ? Promise.reject(new Error('Transient import failure')) : Promise.resolve(module);
      }
    }
  );
  return { prepare, module, get imports() { return imports; }, get styles() { return styles; } };
}

const home = homeHarness();
const background = home.prepare.prepareGarageOnce();
assert.equal(home.prepare.prepareGarageOnce(), background, 'Background and interactive preparation share one pending attempt');
await assert.rejects(background, /Transient import failure/);
assert.equal(home.prepare.module(), null, 'A failed preparation never exposes a half-ready GARAGE');
const homeRetry = home.prepare.prepareGarageOnce();
assert.notEqual(homeRetry, background, 'A rejected Home preparation must not poison the next CHOOSE CAR');
await homeRetry;
assert.equal(home.prepare.module(), home.module);
assert.equal(home.prepare.prepareGarageOnce(), homeRetry, 'Successful preparation remains cached');
assert.equal(home.imports, 2);

const styled = homeHarness({ failImports: 0, failStyles: 1 });
await assert.rejects(styled.prepare.prepareGarageOnce(), /Transient stylesheet failure/);
await styled.prepare.prepareGarageOnce();
assert.equal(styled.styles, 2, 'A stylesheet failure is retried by the next attempt');
assert.equal(styled.prepare.module(), styled.module);

console.log('GARAGE preparation: coalescing, import and stylesheet retries, cached success and single failed-stylesheet reload passed.');
