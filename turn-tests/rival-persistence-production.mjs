import assert from 'node:assert/strict';
import {
  clearAllRivalsState, clearRivalsState, flushScheduledRivalsState,
  getStoredBestLap, getStoredBestReplayLap, hasStoredBestReplayLap,
  loadRivalsState, saveRivalsState, scheduleRivalsStateSave
} from '../turn/race/rival-storage.js';
import { getTrackStorageRevision } from '../turn/tracks/definitions.js';

const disk = new Map();
const scheduled = new Map();
const windowEvents = new EventTarget();
const documentEvents = new EventTarget();
documentEvents.visibilityState = 'visible';
let nextHandle = 1;
let failWrites = false;
let writes = 0;
const globals = ['localStorage', 'document', 'addEventListener', 'requestIdleCallback',
  'cancelIdleCallback', 'setTimeout', 'clearTimeout'];
const originals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));

function schedule(fn, delay, type) {
  const id = nextHandle++;
  scheduled.set(id, { fn, delay, type });
  return id;
}
function runNext() {
  const [id, task] = scheduled.entries().next().value;
  scheduled.delete(id);
  task.fn();
  return task;
}
function invalidateSummaries() {
  windowEvents.dispatchEvent(Object.assign(new Event('storage'), { key: null }));
}
const storage = {
  getItem: (key) => disk.get(key) ?? null,
  setItem(key, value) {
    writes++;
    if (failWrites) throw new Error('Simulated storage failure');
    disk.set(key, value);
  },
  removeItem: (key) => disk.delete(key)
};
const replacements = {
  localStorage: storage,
  document: documentEvents,
  addEventListener: windowEvents.addEventListener.bind(windowEvents),
  requestIdleCallback: (fn) => schedule(fn, 0, 'idle'),
  cancelIdleCallback: (id) => scheduled.delete(id),
  setTimeout: (fn, delay) => schedule(fn, delay, 'timeout'),
  clearTimeout: (id) => scheduled.delete(id)
};
for (const [name, value] of Object.entries(replacements)) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

const samples = Array.from({ length: 25 }, (_, i) => ({
  point: { x: i, z: 0 }, tangent: { x: 1, z: 0 }
}));
function state(trackId = 'harbor', time = 10) {
  return {
    trackId,
    competitorLaps: time == null ? [] : [{
      time, hitAt: 123456, carId: 'sedan',
      carColor: '#123456', carSecondaryColor: '#654321', factoryPaint: false,
      frames: samples.map((_, i) => ({ t: i * time / 24, x: i, z: 0, h: 0, p: i / 24 }))
    }]
  };
}
function key(trackId) {
  const revision = getTrackStorageRevision(trackId);
  return `turn-personal-rivals-v1${revision === 'countryside' ? '' : `:${revision}`}`;
}
function reload(trackId) {
  const loaded = state(trackId, null);
  loadRivalsState({ state: loaded, samples, findNearestTrack: (frame) => ({ index: Math.round(frame.x) }) });
  return loaded;
}
function reset() {
  failWrites = false;
  documentEvents.visibilityState = 'visible';
  clearAllRivalsState(state('harbor', null), ['countryside', 'airport', 'harbor']);
  assert.equal(scheduled.size, 0, 'Clearing pending rivals must cancel their scheduled flush/retry');
  disk.clear();
  invalidateSummaries();
  writes = 0;
}

try {
  reset();
  const harbor = state('harbor');
  scheduleRivalsStateSave(harbor);
  scheduleRivalsStateSave(state('airport', 12));
  clearRivalsState(harbor);
  assert.equal(scheduled.size, 1, 'Resetting one track must preserve another track’s pending flush');
  runNext();
  assert.equal(disk.has(key('harbor')), false, 'Idle persistence must not resurrect a reset');
  assert.equal(JSON.parse(disk.get(key('airport'))).laps[0].time, 12);
  assert.equal(getStoredBestLap('harbor'), null);
  assert.equal(hasStoredBestReplayLap('harbor'), false);

  reset();
  saveRivalsState(state('harbor', 20));
  const activated = reload('harbor'); // Home activates the track immediately before reset.
  assert.equal(scheduled.size, 1);
  clearRivalsState(activated);
  flushScheduledRivalsState();
  assert.equal(reload('harbor').bestTime, Infinity, 'Home activate → reset → flush → reload stays reset');

  reset();
  scheduleRivalsStateSave(state('harbor'));
  scheduleRivalsStateSave(state('airport'));
  clearAllRivalsState(state('countryside', null));
  assert.equal(scheduled.size, 0);
  flushScheduledRivalsState();
  assert.equal(disk.size, 0, 'All-track reset includes pending tracks beyond the active track');

  reset();
  saveRivalsState(state('harbor', 20));
  scheduleRivalsStateSave(state('harbor', 10));
  const fresh = reload('harbor');
  assert.equal(fresh.bestTime, 10, 'Reactivation must load pending memory before older disk');
  assert.equal(getStoredBestLap('harbor').time, 10);
  const shared = getStoredBestReplayLap('harbor');
  assert.equal(shared.time, 10);
  assert.equal(shared.carColor, '#123456');
  assert.equal(shared.carSecondaryColor, '#654321');
  assert.notEqual(shared.frames, fresh.ghostFrames, 'Explicit sharing still returns an owned replay copy');
  assert.equal(flushScheduledRivalsState(), true);
  assert.equal(JSON.parse(disk.get(key('harbor'))).laps[0].time, 10);
  assert.equal(reload('harbor').bestTime, 10);

  reset();
  failWrites = true;
  scheduleRivalsStateSave(state('harbor'));
  runNext();
  assert.equal(scheduled.values().next().value.delay, 1000);
  assert.equal(getStoredBestReplayLap('harbor').time, 10, 'Failed durability must retain the replay in memory');
  failWrites = false;
  runNext();
  assert.equal(JSON.parse(disk.get(key('harbor'))).laps[0].time, 10, 'A delayed retry must persist the failed payload');
  assert.equal(scheduled.size, 0);

  reset();
  failWrites = true;
  scheduleRivalsStateSave(state('harbor'));
  for (let i = 0; scheduled.size && i < 10; i++) runNext();
  assert.equal(writes, 4, 'Persistent failure gets one initial attempt and three bounded retries');
  assert.equal(scheduled.size, 0, 'Quota failure must not create page-lifetime polling');
  assert.equal(getStoredBestLap('harbor').time, 10);
  failWrites = false;
  assert.equal(flushScheduledRivalsState(), true, 'Exhausting automatic retries must not discard the payload');
  assert.equal(JSON.parse(disk.get(key('harbor'))).laps[0].time, 10);

  reset();
  failWrites = true;
  scheduleRivalsStateSave(state('harbor'));
  windowEvents.dispatchEvent(new Event('pagehide'));
  assert.equal(scheduled.size, 0, 'Page hide must not leave a retry timer alive');
  failWrites = false;
  windowEvents.dispatchEvent(new Event('pageshow'));
  runNext();
  assert.equal(JSON.parse(disk.get(key('harbor'))).laps[0].time, 10);

  reset();
  saveRivalsState(state('harbor', 20));
  scheduleRivalsStateSave(state('harbor', 10));
  failWrites = true;
  assert.equal(saveRivalsState(state('harbor', 9)), false);
  assert.equal(getStoredBestReplayLap('harbor').time, 9, 'Failed direct saves must supersede older pending payloads');
  failWrites = false;
  flushScheduledRivalsState();
  assert.equal(JSON.parse(disk.get(key('harbor'))).laps[0].time, 9);

  reset();
  disk.set('turn-three-ghost-v4', JSON.stringify({ bestTime: 30, frames: state().competitorLaps[0].frames }));
  scheduleRivalsStateSave(state('countryside', null));
  invalidateSummaries();
  assert.equal(getStoredBestLap('countryside'), null);
  assert.equal(reload('countryside').bestTime, Infinity, 'An authoritative empty payload suppresses legacy fallback');
  flushScheduledRivalsState();
  invalidateSummaries();
  assert.equal(getStoredBestReplayLap('countryside'), null);
  assert.equal(reload('countryside').bestTime, Infinity);

  reset();
  delete globalThis.requestIdleCallback;
  scheduleRivalsStateSave(state('harbor'));
  assert.equal(scheduled.values().next().value.delay, 32, 'Browsers without idle callbacks retain the deferred timer path');
  runNext();
  assert.equal(JSON.parse(disk.get(key('harbor'))).laps[0].time, 10);
  console.log('TURN rival persistence: reset, pending precedence, Home/share/reload, bounded retries and lifecycle recovery passed.');
} finally {
  reset();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}
