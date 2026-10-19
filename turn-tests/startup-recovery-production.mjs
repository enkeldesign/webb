import assert from 'node:assert/strict';
import { installOffline } from '../turn/ui/offline.js';

// #1256 / historical r398 regression guard:
// service-worker update failures may surface as global error/rejection events while a
// complete stored release is still playable. Those events belong to offline preparation,
// not game bootstrap recovery. The bootstrap listeners must be suspended only for
// prepare(), then restored before the game module graph is released.

const release = '20261018-r483';
const listeners = new Map();
const add = (type, listener) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(listener);
};
const remove = (type, listener) => listeners.get(type)?.delete(listener);
const emit = (type) => {
  for (const listener of listeners.get(type) || []) listener({ type });
};

let bootstrapFailures = 0;
const startFailed = () => { bootstrapFailures += 1; };
add('error', startFailed);
add('unhandledrejection', startFailed);

const statusResponse = {
  json: async () => ({ release, failed: false, files: 1 })
};
const indexResponse = {
  text: async () => `globalThis.__TURN_BUILD__ = { cacheKey: '${release}' };`
};
const cache = {
  match: async (key) => key === '/turn/__offline-status' ? statusResponse :
    key === '/turn/index.html' ? indexResponse : null,
  keys: async () => [{ url: '/turn/index.html' }, { url: '/turn/__offline-status' }],
  delete: async () => true
};

let updateAttempts = 0;
const serviceWorker = {
  controller: null,
  addEventListener: () => {},
  startMessages: () => {},
  register: async () => {
    assert.equal(listeners.get('error')?.has(startFailed), false,
      'bootstrap error listener must be suspended during service-worker preparation');
    emit('error');
    return {
      installing: null,
      waiting: null,
      active: null,
      update: async () => {
        updateAttempts += 1;
        assert.equal(listeners.get('unhandledrejection')?.has(startFailed), false,
          'bootstrap rejection listener must be suspended during service-worker update');
        emit('unhandledrejection');
        throw new Error('expected update-check failure');
      }
    };
  }
};

const windowRef = {
  __TURN_BUILD__: { cacheKey: release },
  __turnStartFailed: startFailed,
  addEventListener: add,
  removeEventListener: remove,
  caches: {
    keys: async () => [`turn-precache-${release}`],
    open: async () => cache
  },
  isSecureContext: true,
  localStorage: { getItem: () => null },
  location: {
    hostname: 'turn.example',
    href: 'https://turn.example/turn/',
    replace: () => { throw new Error('existing complete release should not switch'); }
  },
  navigator: {
    onLine: true,
    serviceWorker,
    storage: { persist: async () => true }
  }
};

const startup = {
  arm: () => {},
  setProgress: () => {},
  setState: () => {}
};

const offline = installOffline({ windowRef, startup });
await offline.prepare();

assert.equal(updateAttempts, 2, 'preparation still owns and retries the failed update check');
assert.equal(bootstrapFailures, 0,
  'expected preparation errors must not consume safe-restart/bootstrap recovery attempts');
assert.equal(listeners.get('error')?.has(startFailed), true,
  'bootstrap error listener must be restored after preparation');
assert.equal(listeners.get('unhandledrejection')?.has(startFailed), true,
  'bootstrap rejection listener must be restored after preparation');
emit('error');
assert.equal(bootstrapFailures, 1,
  'real game bootstrap failures must be observed again after preparation');

console.log('TURN startup recovery isolates service-worker preparation failures and re-arms bootstrap recovery.');
