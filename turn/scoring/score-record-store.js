// One owner for each score channel, including callers using compatibility URLs.
const stores = new Map();
const browserStates = new Set();
const pendingStates = new Set();
const RETRY_DELAYS = [1000, 4000, 16000];
let scheduledFlush = null;
let retryAttempt = 0;
let lifecycleInstalled = false;

function defaultStorage() {
  try { return globalThis.localStorage; } catch (_) { return null; }
}

function normalizeTrackId(trackId) {
  const value = String(trackId || '').trim();
  return value && /^[a-z0-9-]+$/i.test(value) ? value : 'countryside';
}

function positive(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeRecord(record) {
  const score = Math.round(positive(record?.score, 0));
  if (score <= 0) return null;
  const normalized = { score, carId: String(record?.carId || 'classic'), hitAt: positive(record?.hitAt) };
  for (const key of ['carColor', 'carSecondaryColor']) {
    const color = typeof record?.[key] === 'string' ? record[key].toLowerCase() : '';
    if (/^#[0-9a-f]{6}$/.test(color)) normalized[key] = color;
  }
  const lapTime = positive(record?.lapTime);
  if (lapTime != null) normalized.lapTime = lapTime;
  return Object.freeze(normalized);
}

function decode(raw) {
  const records = Object.create(null);
  const keys = new Set();
  try {
    const tracks = JSON.parse(raw)?.tracks;
    if (!tracks || typeof tracks !== 'object' || Array.isArray(tracks)) return { records, keys, valid: false };
    for (const [trackId, value] of Object.entries(tracks)) {
      keys.add(trackId);
      const record = normalizeRecord(value);
      if (record && normalizeTrackId(trackId) === trackId) records[trackId] = record;
    }
    return { records, keys, valid: true };
  } catch (_) {
    return { records, keys, valid: false };
  }
}

function cancelFlush() {
  if (!scheduledFlush) return;
  if (scheduledFlush.type === 'idle') globalThis.cancelIdleCallback?.(scheduledFlush.id);
  else globalThis.clearTimeout?.(scheduledFlush.id);
  scheduledFlush = null;
}

function syncPending(state) {
  if (state.resetPending || state.dirty.size) pendingStates.add(state);
  else pendingStates.delete(state);
  if (!pendingStates.size) {
    cancelFlush();
    retryAttempt = 0;
  }
}

function reconcile(state, raw, resetEvent = false) {
  if (resetEvent) {
    state.records = Object.create(null);
    state.baseline = Object.create(null);
    state.raw = raw;
    state.dirty.clear();
    state.resetPending = false;
    syncPending(state);
    return;
  }
  if (state.resetPending || raw === state.raw) return;
  const incoming = decode(raw);
  const baseline = { ...incoming.records };
  // Removal or an explicit empty payload resets even unflushed records.
  // Malformed data does not erase known bests.
  const reset = state.raw !== undefined && (raw === null
    || (incoming.valid && incoming.keys.size === 0));
  if (reset) {
    state.records = incoming.records;
    state.dirty.clear();
  } else {
    const merged = incoming.records;
    for (const [trackId, record] of Object.entries(state.records)) {
      const removed = incoming.valid && state.baseline[trackId] && !incoming.keys.has(trackId);
      if (removed) state.dirty.delete(trackId);
      else if (!merged[trackId] || record.score > merged[trackId].score) {
        merged[trackId] = record;
        state.dirty.set(trackId, record);
      } else state.dirty.delete(trackId);
    }
    state.records = merged;
  }
  state.raw = raw;
  state.baseline = baseline;
  syncPending(state);
}

function flushState(state) {
  const storage = state.getStorage();
  if (!storage?.getItem || !storage?.setItem) return false;
  try {
    // Re-read at durability time so another tab's tracks and higher bests
    // survive even when its storage event has not arrived yet.
    if (!state.resetPending) reconcile(state, storage.getItem(state.key));
    if (!pendingStates.has(state)) return true;
    const raw = JSON.stringify({ version: state.version, tracks: state.records });
    storage.setItem(state.key, raw);
    state.raw = raw;
    state.baseline = { ...state.records };
    state.resetPending = false;
    state.dirty.clear();
    syncPending(state);
    return true;
  } catch (_) {
    return false;
  }
}

function scheduleFlush() {
  if (!pendingStates.size || scheduledFlush || globalThis.document?.visibilityState === 'hidden') return;
  const run = () => {
    scheduledFlush = null;
    flushScheduledScoreRecords();
  };
  if (typeof globalThis.requestIdleCallback === 'function') {
    scheduledFlush = { type: 'idle', id: globalThis.requestIdleCallback(run, { timeout: 800 }) };
  } else {
    scheduledFlush = { type: 'timeout', id: globalThis.setTimeout(run, 32) };
  }
}

export function flushScheduledScoreRecords() {
  cancelFlush();
  let success = true;
  for (const state of [...pendingStates]) {
    if (!flushState(state)) success = false;
  }
  if (!success && pendingStates.size && retryAttempt < RETRY_DELAYS.length
    && globalThis.document?.visibilityState !== 'hidden') {
    const id = globalThis.setTimeout(() => {
      scheduledFlush = null;
      scheduleFlush();
    }, RETRY_DELAYS[retryAttempt++]);
    scheduledFlush = { type: 'retry', id };
  }
  return success;
}

function queue(state) {
  pendingStates.add(state);
  retryAttempt = 0;
  if (scheduledFlush?.type === 'retry') cancelFlush();
  scheduleFlush();
}

function installLifecycle() {
  if (lifecycleInstalled) return;
  lifecycleInstalled = true;
  const suspend = () => {
    flushScheduledScoreRecords();
    cancelFlush();
  };
  const resume = () => {
    retryAttempt = 0;
    scheduleFlush();
  };
  globalThis.addEventListener?.('pagehide', suspend);
  globalThis.addEventListener?.('pageshow', resume);
  globalThis.document?.addEventListener?.('visibilitychange', () => {
    if (globalThis.document.visibilityState === 'hidden') suspend();
    else resume();
  });
  globalThis.addEventListener?.('storage', (event) => {
    for (const state of browserStates) {
      const storage = state.getStorage();
      if (event.storageArea && event.storageArea !== storage) continue;
      const key = `${globalThis.__TURN_DEPLOYMENT__?.storageNamespace || ''}${state.key}`;
      if (event.key !== null && event.key !== key) continue;
      try {
        // A queued event can be older than the most recent local flush.
        const raw = storage.getItem(state.key);
        reconcile(state, raw, raw === null && event.newValue === null);
      } catch (_) {}
    }
    scheduleFlush();
  });
}

export function createScoreRecordStore(key, version) {
  if (stores.has(key)) return stores.get(key);
  const injectedStates = new WeakMap();
  let browserState = null;
  let unavailableState = null;

  function createState(getStorage) {
    const state = {
      key, version, getStorage,
      records: Object.create(null), baseline: Object.create(null), raw: undefined,
      dirty: new Map(), resetPending: false
    };
    try {
      const storage = getStorage();
      if (storage?.getItem) {
        state.raw = storage.getItem(key);
        state.records = decode(state.raw).records;
        state.baseline = { ...state.records };
      }
    } catch (_) {}
    installLifecycle();
    return state;
  }

  function stateFor(storage) {
    if (storage === undefined || (storage && storage === defaultStorage())) {
      if (!browserState) {
        browserState = createState(defaultStorage);
        browserStates.add(browserState);
      }
      return browserState;
    }
    if (!storage || (typeof storage !== 'object' && typeof storage !== 'function')) {
      if (!unavailableState) unavailableState = createState(() => null);
      return unavailableState;
    }
    if (!injectedStates.has(storage)) injectedStates.set(storage, createState(() => storage));
    return injectedStates.get(storage);
  }

  const store = Object.freeze({
    getBest(trackId, storage) {
      return stateFor(storage).records[normalizeTrackId(trackId)] || null;
    },
    saveBest({ trackId, hitAt = Date.now(), ...values } = {}, storage) {
      const state = stateFor(storage);
      const id = normalizeTrackId(trackId);
      const candidate = normalizeRecord({ ...values, hitAt });
      const current = state.records[id] || null;
      if (!candidate || (current && candidate.score <= current.score)) {
        return Object.freeze({ record: current, isNewBest: false, saved: false });
      }
      state.records[id] = candidate;
      state.dirty.set(id, candidate);
      queue(state);
      // Feedback is immediate; durable storage is acknowledged only by flush.
      return Object.freeze({ record: candidate, isNewBest: true, saved: false, pending: true });
    },
    clear(storage) {
      const state = stateFor(storage);
      state.records = Object.create(null);
      state.dirty.clear();
      state.resetPending = true;
      queue(state);
    }
  });
  stores.set(key, store);
  return store;
}
