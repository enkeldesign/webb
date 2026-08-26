import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  CUSTOM_CAR_STAT_BUDGET,
  createDefaultCustomCarBuild,
  customCarBuildHash,
  customCarStatTotal,
  normalizeCustomCarBuild,
  validateCustomCarBuild,
  withCustomCarBuildHash
} from '../build-a-car/schema.js';
import {
  CUSTOM_CAR_STORAGE_KEY,
  loadCustomCar,
  saveCustomCar
} from '../build-a-car/storage.js';

const timestamp = '2026-08-26T19:30:00.000Z';
const factory = createDefaultCustomCarBuild(timestamp);
assert.equal(customCarStatTotal(factory.stats), CUSTOM_CAR_STAT_BUDGET);
assert.equal(validateCustomCarBuild(factory).valid, true, 'The prototype factory build must be valid');
assert.equal(factory.buildHash, customCarBuildHash(factory));

const underBudget = withCustomCarBuildHash({
  ...factory,
  stats: { ...factory.stats, boostDuration: factory.stats.boostDuration - 1 }
});
const underBudgetValidation = validateCustomCarBuild(underBudget);
assert.equal(underBudgetValidation.valid, false);
assert.equal(underBudgetValidation.total, 17);
assert.match(underBudgetValidation.errors.join(' '), /exactly 18 stat points/);

const overLimit = withCustomCarBuildHash({
  ...factory,
  stats: { ...factory.stats, speed: 6, boostDuration: 1 }
});
assert.equal(validateCustomCarBuild(overLimit).valid, false);
assert.match(validateCustomCarBuild(overLimit).errors.join(' '), /TOP SPEED must be between 1 and 5/);

const normalized = normalizeCustomCarBuild({
  ...factory,
  name: '  MY   WILD CAR  ',
  parts: { ...factory.parts, wheels: 'missing-wheel' },
  colors: { ...factory.colors, primary: '#ABCDEF' }
}, { now: timestamp });
assert.equal(normalized.name, 'MY WILD CAR');
assert.equal(normalized.parts.wheels, factory.parts.wheels, 'Unknown part IDs must fall back safely');
assert.equal(normalized.colors.primary, '#abcdef');

const recolored = withCustomCarBuildHash({
  ...factory,
  colors: { ...factory.colors, accent: '#8ce99a' }
});
assert.notEqual(recolored.buildHash, factory.buildHash, 'Gameplay/appearance identity changes must change the hash');
const retimestamped = withCustomCarBuildHash({ ...factory, updatedAt: '2027-01-01T00:00:00.000Z' });
assert.equal(retimestamped.buildHash, factory.buildHash, 'Mutable timestamps must not rewrite build identity');

const memory = createMemoryStorage();
const saved = saveCustomCar(factory, memory);
assert.equal(memory.has(CUSTOM_CAR_STORAGE_KEY), true);
assert.deepEqual(loadCustomCar(memory), saved);
assert.throws(
  () => saveCustomCar(factory, {
    setItem() { throw new Error('Storage blocked.'); }
  }),
  /Storage blocked/,
  'Storage write failures must reach the modal error boundary'
);
memory.setItem(CUSTOM_CAR_STORAGE_KEY, '{broken json');
assert.equal(loadCustomCar(memory), null, 'Malformed LAB storage must fail closed without throwing');

const [index, entry, modal, renderer, styles] = await Promise.all([
  fs.readFile(new URL('../index.html', import.meta.url), 'utf8'),
  fs.readFile(new URL('../build-a-car/entry.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../build-a-car/builder-modal.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../build-a-car/custom-car-renderer.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../build-a-car/builder.css', import.meta.url), 'utf8')
]);

assert.match(index, /new URL\('\/turn-lab\/build-a-car\/entry\.js'/);
assert.match(index, /buildACarEntry\.searchParams\.set\('build', globalThis\.__TURN_BUILD__\.cacheKey\)/,
  'The experiment entry must use canonical generated build identity');
assert.doesNotMatch(index, /build-a-car\/entry\.js\?revision=/,
  'BUILD-A-CAR must not create a private revision-string namespace');
assert.match(entry, /root\.querySelector\?\.\('\.lot-screen'\)/);
assert.match(entry, /actions\.insertBefore\(wrapper, raceButton\)/,
  'The LAB installer must enter through The Lot without forking it');
assert.match(entry, /turn-lab:custom-car-saved/);
assert.match(modal, /dialog\.showModal\(\)/);
assert.match(modal, /role="status" aria-live="polite"/);
assert.match(modal, /aria-label="Decrease \$\{label\.toLowerCase\(\)\}"/);
assert.match(
  modal,
  /try \{\s+onSave\(candidate\);\s+dialog\.close\('saved'\);\s+\} catch \(error\) \{/,
  'The dialog must only close after a successful persistence callback'
);
assert.match(
  modal,
  /saveReason\.textContent = message;\s+live\.textContent = message;/,
  'Persistence failures must be visible and announced'
);
assert.match(renderer, /sliceGeometry\(node, part\.extraction, part\.splitY\)/);
assert.match(renderer, /frontWheelPivots/);
assert.match(styles, /\.build-a-car-dialog::backdrop/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);

console.log('TURN LAB BUILD-A-CAR schema, budget, identity, storage, entry and accessible modal contracts passed.');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    has(key) { return values.has(key); }
  };
}
