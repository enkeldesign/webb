import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createDriftAttackRuntime } from '../turn/scoring/drift-attack-runtime.js';
import { createFlowRuntime } from '../turn/scoring/flow-runtime.js';
import { getBestDriftRecord } from '../turn/scoring/drift-records.js';
import { getBestFlowRecord } from '../turn/scoring/flow-records.js';
import { flushScheduledScoreRecords } from '../turn/scoring/score-record-store.js';
import { createAchievementStore } from '../turn/achievements/store.js';

const source = await fs.readFile(new URL('../turn/scoring/score-record-store.js', import.meta.url), 'utf8');
const D = 'turn-drift-records-v1';
const F = 'turn-flow-records-v1';
const tracks = ['countryside', 'airport', 'harbor', 'cliffside', 'midnight-city', 'mountain'];
const record = (score, carId = 'sedan') => ({ score, carId, hitAt: 123, lapTime: 25, carColor: '#123456', carSecondaryColor: '#654321' });
const payload = (records) => JSON.stringify({ version: 2, tracks: records });
const plain = (value) => JSON.parse(JSON.stringify(value));

// Each VM is an independent browser tab. Run the production owner and scheduler
// with instrumented storage/JSON and controlled lifecycle/idle callbacks.
function tab(disk = new Map(), namespace = '') {
  const metrics = { reads: 0, writes: 0, parses: 0, stringifies: 0 };
  const faults = { read: false, write: false, access: false };
  const tasks = new Map();
  const listeners = new Map();
  let handle = 0;
  const addListener = (name, callback) => {
    if (!listeners.has(name)) listeners.set(name, []);
    listeners.get(name).push(callback);
  };
  const storage = {
    getItem(key) {
      metrics.reads++;
      if (faults.read) throw new Error('Read blocked');
      return disk.get(namespace + key) ?? null;
    },
    setItem(key, value) {
      metrics.writes++;
      if (faults.write) throw new Error('Quota exceeded');
      disk.set(namespace + key, value);
    }
  };
  const schedule = (fn, delay, type) => {
    const id = ++handle;
    tasks.set(id, { fn, delay, type });
    return id;
  };
  const environment = {
    document: { visibilityState: 'visible', addEventListener: addListener },
    addEventListener: addListener,
    __TURN_DEPLOYMENT__: { storageNamespace: namespace },
    requestIdleCallback: (fn) => schedule(fn, 0, 'idle'),
    cancelIdleCallback: (id) => tasks.delete(id),
    setTimeout: (fn, delay) => schedule(fn, delay, 'timeout'),
    clearTimeout: (id) => tasks.delete(id),
    JSON: {
      parse(raw) { metrics.parses++; return JSON.parse(raw); },
      stringify(value) { metrics.stringifies++; return JSON.stringify(value); }
    }
  };
  Object.defineProperty(environment, 'localStorage', { get() {
    if (faults.access) throw new Error('Storage unavailable');
    return storage;
  } });
  const api = vm.runInNewContext(`${source.replace(/^export /gm, '')}\n({ createScoreRecordStore, flushScheduledScoreRecords });`, environment);
  const drift = api.createScoreRecordStore(D, 2);
  const flow = api.createScoreRecordStore(F, 2);
  return {
    api, drift, flow, disk, tasks, listeners, metrics, faults, storage, environment,
    zero() { for (const key of Object.keys(metrics)) metrics[key] = 0; },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); },
    changed(key, newValue = disk.get(key) ?? null, storageArea = storage) {
      this.emit('storage', { key, newValue, storageArea });
    },
    runOne() {
      const [id, task] = tasks.entries().next().value;
      tasks.delete(id);
      task.fn();
      return task;
    },
    drain() {
      let attempts = 0;
      while (tasks.size && attempts++ < 30) this.runOne();
      assert.equal(tasks.size, 0, 'Persistence must have bounded retries and no lifetime polling');
    }
  };
}

const home = tab(new Map([[D, payload({ countryside: record(100) })], [F, payload({ countryside: record(90) })]]));
for (const trackId of tracks) { home.drift.getBest(trackId); home.flow.getBest(trackId); }
assert.equal(home.metrics.reads, 2, 'A six-track Home refresh reads each channel once');
assert.equal(home.metrics.parses, 2, 'A six-track Home refresh parses each channel once');
home.zero();
for (const trackId of tracks) { home.drift.getBest(trackId); home.flow.getBest(trackId); }
home.drift.saveBest({ trackId: 'countryside', ...record(200) });
home.flow.saveBest({ trackId: 'countryside', ...record(190) });
assert.deepEqual(home.metrics, { reads: 0, writes: 0, parses: 0, stringifies: 0 },
  'Warm Home reads and two new bests must do no synchronous storage or JSON work');
assert.equal(home.tasks.size, 1, 'Both channels share one pending durability callback');
assert.equal(home.drift.getBest('countryside').score, 200);
assert.ok(Object.isFrozen(home.drift.getBest('countryside')));
assert.equal(home.api.createScoreRecordStore(D, 2), home.drift, 'Compatibility facades share the same owner');
assert.ok([...home.listeners.values()].every((callbacks) => callbacks.length === 1), 'Lifecycle listeners install once');
home.runOne();
assert.equal(home.metrics.writes, 2);
const reloaded = tab(home.disk);
assert.deepEqual(plain(reloaded.drift.getBest('countryside')), record(200));
assert.deepEqual(plain(reloaded.flow.getBest('countryside')), record(190));

const reset = tab(new Map([[D, payload({ countryside: record(100) })]]));
reset.drift.saveBest({ trackId: 'countryside', ...record(200) });
reset.drift.clear();
assert.equal(reset.drift.getBest('countryside'), null);
reset.faults.write = true;
assert.equal(reset.api.flushScheduledScoreRecords(), false);
assert.equal(reset.drift.getBest('countryside'), null, 'Failed reset durability must not restore old disk data');
reset.drift.saveBest({ trackId: 'airport', ...record(300) });
reset.faults.write = false;
reset.drain();
assert.deepEqual(JSON.parse(reset.disk.get(D)).tracks, { airport: record(300) }, 'A new post-reset record survives; pre-reset records do not');

const cleared = tab();
cleared.drift.saveBest({ trackId: 'harbor', ...record(200) });
cleared.flow.saveBest({ trackId: 'harbor', ...record(300) });
cleared.disk.clear();
cleared.changed(null);
assert.equal(cleared.tasks.size, 0, 'Cross-tab clear cancels even records awaiting their first write');
assert.equal(cleared.drift.getBest('harbor'), null);
cleared.api.flushScheduledScoreRecords();
assert.equal(cleared.disk.size, 0);

const removal = tab(new Map([[D, payload({ countryside: record(100) })]]));
removal.drift.saveBest({ trackId: 'countryside', ...record(200) });
removal.disk.delete(D); // The external reset event has not arrived yet.
removal.drain();
assert.equal(removal.disk.has(D), false, 'Deferred durability detects a reset before its event is delivered');
assert.equal(removal.drift.getBest('countryside'), null);

const disk = new Map();
const a = tab(disk);
const b = tab(disk);
a.drift.saveBest({ trackId: 'countryside', ...record(100) });
b.drift.saveBest({ trackId: 'airport', ...record(200) });
a.drain();
b.drain();
const olderEvent = disk.get(D);
a.changed(D);
assert.equal(a.drift.getBest('airport').score, 200);
a.drift.saveBest({ trackId: 'countryside', ...record(400) });
b.drift.saveBest({ trackId: 'countryside', ...record(300) });
a.drain();
b.drain();
a.changed(D, olderEvent);
assert.deepEqual(JSON.parse(disk.get(D)).tracks, { countryside: record(400), airport: record(200) });
assert.equal(b.drift.getBest('countryside').score, 400, 'A lower pending best cannot overwrite a higher remote best');
assert.equal(a.drift.getBest('countryside').score, 400, 'Stale queued events cannot regress a newer local flush');
// A concurrent writer may have read before our flush. Repair its lower overwrite.
disk.set(D, payload({ countryside: record(250), airport: record(200) }));
a.changed(D);
a.drain();
assert.equal(JSON.parse(disk.get(D)).tracks.countryside.score, 400);
disk.set(D, payload({ airport: record(200) }));
a.changed(D);
assert.equal(a.drift.getBest('countryside'), null, 'Remote per-track deletion is respected');
assert.equal(a.tasks.size, 0);

const failure = tab();
failure.drift.saveBest({ trackId: 'mountain', ...record(100) });
failure.faults.write = true;
failure.drain();
assert.equal(failure.metrics.writes, 4, 'One initial write and three retries exhaust the automatic budget');
assert.equal(failure.drift.getBest('mountain').score, 100);
failure.faults.write = false;
failure.emit('pageshow');
failure.drain();
assert.equal(JSON.parse(failure.disk.get(D)).tracks.mountain.score, 100);
failure.drift.saveBest({ trackId: 'mountain', ...record(200) });
failure.faults.write = true;
failure.emit('pagehide');
assert.equal(failure.tasks.size, 0, 'Suspension must leave no retry/idle callback alive');
failure.faults.write = false;
failure.environment.document.visibilityState = 'visible';
failure.emit('visibilitychange');
failure.drain();
assert.equal(JSON.parse(failure.disk.get(D)).tracks.mountain.score, 200);

const unavailable = tab();
unavailable.faults.access = true;
const volatile = unavailable.drift.saveBest({ trackId: 'harbor', ...record(1200) });
assert.equal(volatile.saved, false, 'Unavailable storage must never report phantom durability');
assert.equal(volatile.isNewBest, true, 'A session best remains usable while storage is unavailable');
assert.equal(unavailable.drift.getBest('harbor').score, 1200);
unavailable.drain();
unavailable.faults.access = false;
unavailable.emit('pageshow');
unavailable.drain();
assert.deepEqual(JSON.parse(unavailable.disk.get(D)).tracks.harbor, record(1200));

const malformed = tab(new Map([[D, '{broken'], [F, payload({ airport: { score: -10 } })]]));
assert.equal(malformed.drift.getBest('airport'), null);
assert.equal(malformed.flow.getBest('airport'), null);
malformed.drift.saveBest({ trackId: 'airport', ...record(250) });
malformed.drain();
assert.deepEqual(JSON.parse(malformed.disk.get(D)).tracks.airport, record(250));
malformed.disk.set(D, payload({ airport: { score: 'broken' } }));
malformed.changed(D);
assert.equal(malformed.drift.getBest('airport').score, 250, 'A malformed remote record is not an explicit reset');
malformed.drain();
assert.deepEqual(JSON.parse(malformed.disk.get(D)).tracks.airport, record(250));

const unread = tab(new Map([[D, payload({ airport: record(500) })]]));
unread.faults.read = true;
unread.drift.saveBest({ trackId: 'harbor', ...record(200) });
assert.equal(unread.api.flushScheduledScoreRecords(), false);
assert.equal(unread.metrics.writes, 0, 'Failed reconciliation cannot overwrite unknown disk records');
unread.faults.read = false;
unread.drain();
assert.deepEqual(JSON.parse(unread.disk.get(D)).tracks, { airport: record(500), harbor: record(200) });

const namespaced = tab(new Map(), 'turn-next:');
namespaced.drift.saveBest({ trackId: 'harbor', ...record(100) });
namespaced.drain();
namespaced.disk.set(D, payload({ harbor: record(999) }));
namespaced.changed(D);
assert.equal(namespaced.drift.getBest('harbor').score, 100, 'Production storage events cannot bleed into NEXT');
namespaced.disk.set('turn-next:' + D, payload({ harbor: record(200) }));
namespaced.changed('turn-next:' + D);
assert.equal(namespaced.drift.getBest('harbor').score, 200);
namespaced.changed(null, null, {});
assert.equal(namespaced.drift.getBest('harbor').score, 200, 'Other storage areas cannot reset local records');

const fallback = tab();
delete fallback.environment.requestIdleCallback;
fallback.drift.saveBest({ trackId: 'harbor', ...record(100) });
assert.equal(fallback.tasks.values().next().value.delay, 32);
fallback.drain();
assert.equal(JSON.parse(fallback.disk.get(D)).tracks.harbor.score, 100);

// Exercise the actual two scoring runtimes and their production record facades.
const runtimeDisk = new Map();
const runtimeCost = { reads: 0, writes: 0 };
const runtimeStorage = {
  getItem(key) { runtimeCost.reads++; return runtimeDisk.get(key) ?? null; },
  setItem(key, value) { runtimeCost.writes++; runtimeDisk.set(key, value); }
};
const events = new globalThis.EventTarget();
const feedback = { updateState() {}, publishEvent() {}, setChannelVisible() {}, clearChannel() {} };
const state = { trackId: 'countryside', vehicleId: 'sedan', vehicleColor: '#123456', vehicleSecondaryColor: '#654321', lapActive: true };
const drift = createDriftAttackRuntime({ state, storage: runtimeStorage, eventTarget: events, scoreFeedback: feedback, wallClock: () => 123 });
const flow = createFlowRuntime({ state, storage: runtimeStorage, eventTarget: events, scoreFeedback: feedback, wallClock: () => 123 });
drift.beginLap(0);
flow.beginLap(0);
for (let i = 1; i <= 180; i++) drift.scorer.advance(1 / 60, i * 1000 / 60, 30, Math.PI / 3, false, false, true);
runtimeCost.reads = runtimeCost.writes = 0;
const lap = { now: 3001, time: 25, valid: true, ranked: true };
const driftResult = drift.completeLap(lap);
const flowResult = flow.completeLap(lap);
assert.ok(driftResult.score > 0 && flowResult.score > 0);
assert.ok(driftResult.newBest && flowResult.newBest);
assert.deepEqual(runtimeCost, { reads: 0, writes: 0 }, 'A real double-new-best finish performs no synchronous score storage');
assert.equal(getBestDriftRecord('countryside', runtimeStorage).score, driftResult.score);
assert.equal(getBestFlowRecord('countryside', runtimeStorage).score, flowResult.score);
assert.equal(flushScheduledScoreRecords(), true);
assert.equal(runtimeCost.writes, 2);
runtimeCost.reads = runtimeCost.writes = 0;
drift.completeLap({ ...lap, now: 3010 });
flow.completeLap({ ...lap, now: 3010 });
assert.deepEqual(runtimeCost, { reads: 0, writes: 0 }, 'An ordinary finish reads cached bests without storage');
assert.equal((await import('../turn/scoring/drift-records.js?revision=r206-home-track-records')).getBestDriftRecord, getBestDriftRecord);

// The real lap-result listener batches progress and nested unlock/reward writes.
const achievementSource = await fs.readFile(new URL('../turn/achievements/runtime.js', import.meta.url), 'utf8');
const listener = achievementSource.match(/window\.addEventListener\('turn:lap-result',[\s\S]*?\n  \}\);/)[0];
const achievementStore = createAchievementStore(runtimeStorage);
runtimeCost.writes = 0;
let onLap;
vm.runInNewContext(listener, {
  window: { addEventListener(_name, callback) { onLap = callback; } },
  store: achievementStore,
  validCompletedLap: () => true,
  completeValidLap() {
    achievementStore.addTrack('countryside');
    achievementStore.addBlankTrack('countryside');
    achievementStore.batch(() => { achievementStore.unlock('first-turn'); achievementStore.syncRewards(); });
  }
});
onLap({ detail: lap });
assert.equal(runtimeCost.writes, 1, 'One lap transaction batches track, blank-track, unlock and reward durability');
assert.equal(achievementStore.isUnlocked('first-turn'), true);
console.log('TURN score persistence: warm finish/Home costs, memory/durability, reset, retry, cross-tab merge, namespaces and lap achievement batching passed.');
