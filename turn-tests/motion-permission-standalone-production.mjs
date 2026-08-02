import assert from 'node:assert/strict';

import { installMotionPermissionCancelRecovery } from '../turn/ui/motion-permission-cancel-recovery.js';

class DeniedMotionEvent {}
Object.defineProperty(DeniedMotionEvent, 'requestPermission', {
  configurable: true,
  value: async () => {
    throw new Error('Motion permission was not granted.');
  }
});

let reloads = 0;
const storage = new Map();
const environment = {
  DeviceMotionEvent: DeniedMotionEvent,
  navigator: { standalone: true },
  document: {
    body: {
      classList: {
        contains(name) {
          return name === 'turn-lot-open';
        }
      }
    }
  },
  sessionStorage: {
    getItem(key) {
      return storage.get(key) ?? null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    }
  },
  location: {
    reload() {
      reloads += 1;
    }
  }
};

const recovery = installMotionPermissionCancelRecovery({ environment });
assert.equal(recovery.route, 'standalone-motion-denial-recovery');

await assert.rejects(
  () => DeniedMotionEvent.requestPermission(),
  (error) => error.message === 'Motion permission was not granted.',
  'The first cancelled prompt stays silent in The Lot'
);
assert.equal(reloads, 0, 'The installed iOS app must not enter a reload loop after cancellation');

await assert.rejects(
  () => DeniedMotionEvent.requestPermission(),
  /Motion access is still blocked by iOS\. Close and reopen TURN to try device rotation again\./,
  'A second attempt must explain the platform block instead of appearing dead'
);
assert.equal(reloads, 0, 'Repeated attempts must keep the player in The Lot');
assert.equal(storage.size, 0, 'Standalone recovery must not save a route that triggers another reload');

console.log('TURN standalone motion cancellation remains interactive without a reload loop.');
