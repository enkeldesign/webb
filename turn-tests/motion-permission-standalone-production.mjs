import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

import { installMotionPermissionCancelRecovery } from '../turn/ui/motion-permission-cancel-recovery.js';

const [appSource, recoverySource, dialogSource, dialogCss] = await Promise.all([
  fs.readFile(new URL('../turn/app.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/motion-permission-cancel-recovery.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/ui/motion-permission-denied-dialog.js', import.meta.url), 'utf8'),
  fs.readFile(new URL('../turn/motion-permission-dialog-r134.css', import.meta.url), 'utf8')
]);

class DeniedMotionEvent {}
Object.defineProperty(DeniedMotionEvent, 'requestPermission', {
  configurable: true,
  value: async () => {
    throw new Error('Motion permission was not granted.');
  }
});

class TestCustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

let reloads = 0;
const dispatchedEvents = [];
const storage = new Map();
const environment = {
  DeviceMotionEvent: DeniedMotionEvent,
  CustomEvent: TestCustomEvent,
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
  },
  setTimeout(callback) {
    callback();
    return 1;
  },
  dispatchEvent(event) {
    dispatchedEvents.push(event);
    return true;
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
assert.equal(dispatchedEvents.length, 0, 'The first cancellation must not display explanatory UI');

await assert.rejects(
  () => DeniedMotionEvent.requestPermission(),
  (error) => error.message === 'Motion permission was not granted.',
  'The repeated platform denial stays silent in the cramped Lot status area'
);
assert.equal(reloads, 0, 'Repeated attempts must keep the player in The Lot');
assert.equal(storage.size, 0, 'Standalone recovery must not save a route that triggers another reload');
assert.equal(dispatchedEvents.length, 1, 'The repeated denial must open one dedicated explanation');
assert.equal(dispatchedEvents[0].type, 'turn:motion-permission-blocked');
assert.equal(dispatchedEvents[0].detail.reason, 'permission-denied');

assert.match(appSource, /motion-permission-cancel-recovery\.js\?revision=r134-dialog-event/);
assert.match(appSource, /installMotionPermissionDeniedDialog/);
assert.match(appSource, /motion-permission-denied-dialog\.js\?revision=r134-denied-dialog/);
assert.match(appSource, /motion-permission-dialog-r134\.css\?revision=r134-denied-dialog/);
assert.match(recoverySource, /MOTION_BLOCKED_EVENT = 'turn:motion-permission-blocked'/);
assert.match(recoverySource, /standaloneDismissals > 1[\s\S]*notifyMotionPermissionBlocked\(environment\)[\s\S]*throw error/);
assert.doesNotMatch(recoverySource, /Motion access is still blocked by iOS/);

assert.match(dialogSource, /MOTION ACCESS DENIED/);
assert.match(dialogSource, /You denied motion access\./);
assert.match(dialogSource, /Close and reopen TURN to try again, or use on-screen steering in Settings\./);
assert.match(dialogSource, /showModal\(\)/, 'The explanation must be presented as a modal rather than inserted into car information');
assert.match(dialogSource, /documentRef\.querySelector\('\.lot-race'\)/, 'Closing the dialog returns focus to Race This Car');
assert.match(dialogSource, /aria-labelledby/);
assert.match(dialogSource, /aria-describedby/);
assert.match(dialogCss, /width: min\(520px, calc\(100vw - 32px\)\)/);
assert.match(dialogCss, /background: #ffd43b/);
assert.match(dialogCss, /background: #ff4fa3/);

console.log('TURN standalone motion cancellation uses a clear dedicated denial dialog without a reload loop.');
