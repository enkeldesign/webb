import assert from 'node:assert/strict';
import { installOffline } from '../turn/ui/offline.js';

// #1256 / historical r398 regression guard:
// service-worker update failures may surface as global error/rejection events while a
// complete stored release is still playable. Those events belong to offline preparation,
// not game bootstrap recovery. A startup script that failed to load must still prevent
// prepare() from releasing the game graph; other errors go to the startup cover (#1307).
// Normal listeners are restored on every exit.

const release = '20261018-r483';
const listeners = new Map();
const add = (type, listener, capture = false) => {
  const key = capture ? `${type}:capture` : type;
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(listener);
};
const remove = (type, listener, capture = false) =>
  listeners.get(capture ? `${type}:capture` : type)?.delete(listener);
const emit = (type, detail = {}) => {
  const event = { type, ...detail };
  for (const listener of listeners.get(`${type}:capture`) || []) listener(event);
  if (!detail.target) for (const listener of listeners.get(type) || []) listener(event);
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
let duringUpdate = () => {};
const serviceWorker = {
  controller: null,
  addEventListener: () => {},
  startMessages: () => {},
  register: async () => {
    assert.equal(listeners.get('error')?.has(startFailed), false,
      'bootstrap error listener must be suspended during service-worker preparation');
    emit('error', { filename: 'https://turn.example/turn/sw.js' });
    emit('error', { target: { tagName: 'IMG' } });
    return {
      installing: null,
      waiting: null,
      active: null,
      update: async () => {
        updateAttempts += 1;
        assert.equal(listeners.get('unhandledrejection')?.has(startFailed), false,
          'bootstrap rejection listener must be suspended during service-worker update');
        const error = new Error('expected update-check failure');
        emit('error', { error });
        emit('unhandledrejection', { reason: error });
        duringUpdate();
        throw error;
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

const freshOffline = () => installOffline({ windowRef: { ...windowRef }, startup });
const offline = freshOffline();
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

// A startup script that failed to load affects the player: preparation rejects, with that
// failure as its cause, before the game graph is released.
{
  const detail = { target: { tagName: 'SCRIPT', src: 'https://turn.example/turn/ui/about-history-bootstrap-r165.js' } };
  duringUpdate = () => emit('error', detail);
  let graphReleased = false;
  const rejection = await freshOffline().prepare().then(() => { graphReleased = true; }, (error) => error);
  assert.equal(rejection?.code, 'bootstrap');
  assert.equal(rejection.cause?.target, detail.target, 'The failure screen can say which script');
  assert.equal(graphReleased, false, 'a failed startup script must block game graph release');
  assert.equal(bootstrapFailures, 1, 'preparation must reject before bootstrap recovery runs');
  assert.equal(listeners.get('error')?.has(startFailed), true);
  assert.equal(listeners.get('unhandledrejection')?.has(startFailed), true);
  assert.equal(listeners.get('error:capture')?.size, 0, 'temporary capture listener must be removed');
}

// #1307: any other error does not stop the game by itself. Preparation releases the graph
// and hands the error to the startup cover, which logs it and only fails a start that
// then stalls.
for (const [type, detail] of [
  ['error', { filename: 'https://turn.example/turn/ui/about-history-bootstrap-r165.js', error: new Error('About execution failed') }],
  ['error', {}],
  ['unhandledrejection', { reason: new Error('unrelated startup rejection') }]
]) {
  let emitted = 0;
  duringUpdate = () => { emitted += 1; emit(type, detail); };
  const before = bootstrapFailures;
  let graphReleased = false;
  await freshOffline().prepare().then(() => { graphReleased = true; });
  assert.equal(graphReleased, true, `${type}: an error that may not affect the player releases the game graph`);
  assert.ok(emitted > 0);
  assert.equal(bootstrapFailures, before + emitted, `${type}: each reaches the startup cover, to be logged and watched`);
  assert.equal(listeners.get('error')?.has(startFailed), true);
  assert.equal(listeners.get('unhandledrejection')?.has(startFailed), true);
  assert.equal(listeners.get('error:capture')?.size, 0, 'temporary capture listener must be removed');
}

duringUpdate = () => {};
windowRef.caches.keys = async () => { throw new Error('storage unavailable'); };
await assert.rejects(freshOffline().prepare(), { code: 'storage' });
assert.equal(listeners.get('error')?.has(startFailed), true);
assert.equal(listeners.get('unhandledrejection')?.has(startFailed), true);
assert.equal(listeners.get('error:capture')?.size, 0);

console.log('TURN startup recovery isolates worker failures, fails failed scripts, hands other errors to the cover and restores listeners.');
