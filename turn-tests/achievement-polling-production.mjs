import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {
  CHALLENGE_PROGRESS_STORAGE_KEY,
  installAchievementChallengeExpansion
} from '../turn/achievements/challenge-expansion-r166.js';

function listenerRegistry() {
  const listeners = new Map();
  return {
    add(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    remove(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    emit(type, detail = {}) {
      for (const listener of [...(listeners.get(type) || [])]) listener({ type, detail });
    },
    count(type) {
      return listeners.get(type)?.size || 0;
    }
  };
}

const savedGlobals = new Map();
function replaceGlobal(key, value) {
  savedGlobals.set(key, {
    owned: Object.prototype.hasOwnProperty.call(globalThis, key),
    value: globalThis[key]
  });
  globalThis[key] = value;
}

function restoreGlobals() {
  for (const [key, saved] of savedGlobals) {
    if (saved.owned) globalThis[key] = saved.value;
    else delete globalThis[key];
  }
}

async function verifyChallengeAchievementLifecycle() {
  const events = listenerRegistry();
  const documentRef = { visibilityState: 'visible' };
  let intervalStarts = 0;

  replaceGlobal('addEventListener', events.add);
  replaceGlobal('removeEventListener', events.remove);
  replaceGlobal('document', documentRef);
  replaceGlobal('setInterval', () => {
    intervalStarts += 1;
    return intervalStarts;
  });
  replaceGlobal('clearInterval', () => {});

  const unlocked = {};
  const unlocks = [];
  const runtime = {
    state: {
      running: false,
      trackId: 'countryside',
      vehicleId: 'sedan',
      competitorLaps: [],
      offRoad: false
    }
  };
  const memory = new Map([[CHALLENGE_PROGRESS_STORAGE_KEY, '{}']]);
  const api = installAchievementChallengeExpansion({
    runtime,
    storage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value)
    },
    achievements: {
      getState: () => ({ unlocked }),
      unlock(id, context) {
        if (unlocked[id]) return [];
        unlocked[id] = { ...context };
        unlocks.push({ id, context });
        return [{ id }];
      }
    }
  });

  assert.equal(intervalStarts, 0,
    'Challenge achievements must install without a page-lifetime polling timer');
  assert.equal(events.count('turn:overcharge-catch'), 1,
    'CATCH THE CHARGE should listen at the semantic caught transition');

  events.emit('turn:overcharge-catch', { amount: 0.4 });
  assert.equal(unlocked['catch-the-charge'], undefined,
    'An OVERCHARGE transition outside a running race must not unlock the achievement');

  runtime.state.running = true;
  documentRef.visibilityState = 'hidden';
  events.emit('turn:overcharge-catch', { amount: 0.4 });
  assert.equal(unlocked['catch-the-charge'], undefined,
    'A background transition must not fabricate CATCH THE CHARGE progress');

  documentRef.visibilityState = 'visible';
  events.emit('turn:overcharge-catch', { amount: 0.4 });
  assert.ok(unlocked['catch-the-charge']);
  assert.equal(events.count('turn:overcharge-catch'), 0,
    'The one-time OVERCHARGE listener should detach immediately after unlock');

  api.beginLap();
  runtime.state.offRoad = false;
  api.completeLap({ time: 14, onCourseThroughout: false });
  assert.equal(unlocked['countryside-safety'], undefined,
    'The physics-owned lap result must veto a clean lap');

  api.beginLap();
  runtime.state.offRoad = true;
  api.completeLap({ time: 14, onCourseThroughout: true });
  assert.ok(unlocked['countryside-safety'],
    'The clean-lap achievement must consume the canonical result instead of polling offRoad');
  assert.equal(intervalStarts, 0);
  assert.equal(unlocks.filter(({ id }) => id === 'catch-the-charge').length, 1);

  api.disconnect();
  assert.equal(events.count('turn:ui-state-change'), 0);
  assert.equal(events.count('turn:lap-result'), 0);
  assert.equal(events.count('turn:lap-invalid'), 0);
  assert.equal(events.count('turn:achievements-updated'), 0);
}

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.set(x, y, z);
  }

  set(x = 0, y = 0, z = 0) {
    this.x = Number(x) || 0;
    this.y = Number(y) || 0;
    this.z = Number(z) || 0;
    return this;
  }

  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }

  normalize() {
    const length = Math.sqrt(this.lengthSq()) || 1;
    this.x /= length;
    this.y /= length;
    this.z /= length;
    return this;
  }

  dot(other) {
    return this.x * other.x + this.y * other.y + this.z * other.z;
  }

  applyQuaternion() {
    return this;
  }
}

class FakeQuaternion {}

async function verifyBellaSamplingLifecycle() {
  const sourceUrl = new URL('../turn/tracks/countryside-bella-rescue-r173.js', import.meta.url);
  let source = await fs.readFile(sourceUrl, 'utf8');
  source = source
    .replace("import * as THREE from 'three';", 'const THREE = globalThis.THREE;')
    .replace(
      /import \{ signalSecretAchievement \} from '[^']+';/,
      'const signalSecretAchievement = globalThis.signalSecretAchievement;'
    )
    .replace('export function installBellaRescueBehavior', 'function installBellaRescueBehavior');
  source += '\nglobalThis.installBellaRescueBehavior = installBellaRescueBehavior;';

  const events = listenerRegistry();
  const documentEvents = listenerRegistry();
  const timers = new Map();
  let nextTimer = 1;
  let intervalStarts = 0;
  let bellaSaved = false;
  const documentRef = {
    visibilityState: 'visible',
    hidden: false,
    addEventListener: documentEvents.add,
    removeEventListener: documentEvents.remove,
    querySelector: () => null
  };
  const windowRef = {
    setInterval(callback, milliseconds) {
      const id = nextTimer;
      nextTimer += 1;
      intervalStarts += 1;
      timers.set(id, { callback, milliseconds });
      return id;
    },
    clearInterval(id) {
      timers.delete(id);
    }
  };
  const runtime = {
    state: {
      running: false,
      mode: 'staged',
      trackId: 'countryside',
      vehicleId: 'firetruck',
      position: { x: 1000, y: 0, z: 1000 }
    },
    samples: [{ point: { x: 0, y: 0, z: -10 } }]
  };
  const cat = {
    name: 'Bella',
    position: new FakeVector3(),
    userData: {},
    getWorldPosition(target) {
      return target.set(0, 0, 0);
    },
    updateMatrixWorld() {}
  };
  const root = {
    userData: { turnBellaFocus: cat },
    updateWorldMatrix() {},
    updateMatrixWorld() {},
    getWorldPosition(target) {
      return target.set(0, 0, 0);
    },
    getWorldQuaternion(target) {
      return target;
    }
  };

  const sandbox = {
    THREE: { Vector3: FakeVector3, Quaternion: FakeQuaternion },
    signalSecretAchievement() {},
    document: documentRef,
    window: windowRef,
    performance: { now: () => 1000 },
    console,
    __turnAchievements: { store: { isUnlocked: () => bellaSaved } },
    __turnGetTrackId: () => runtime.state.trackId,
    __turnBoostActive: false,
    __turnBoostCharge: 0,
    addEventListener: events.add,
    removeEventListener: events.remove
  };
  vm.runInNewContext(source, sandbox, { filename: sourceUrl.pathname });
  sandbox.installBellaRescueBehavior({ root, runtime });

  assert.equal(timers.size, 0, 'Bella must not sample on Home');
  assert.equal(documentEvents.count('pointerdown'), 0,
    'Home must not retain Bella user-activation listeners');

  runtime.state.running = true;
  events.emit('turn:ui-state-change', { reason: 'race-started', running: true });
  assert.equal(timers.size, 1);
  assert.equal([...timers.values()][0].milliseconds, 120);
  assert.equal(documentEvents.count('pointerdown'), 1);

  documentRef.visibilityState = 'hidden';
  documentRef.hidden = true;
  documentEvents.emit('visibilitychange');
  assert.equal(timers.size, 0, 'Backgrounding must stop Bella sampling');
  assert.equal(documentEvents.count('pointerdown'), 0);

  documentRef.visibilityState = 'visible';
  documentRef.hidden = false;
  documentEvents.emit('visibilitychange');
  assert.equal(timers.size, 1, 'A still-eligible visible race should resume sampling');

  runtime.state.vehicleId = 'sedan';
  events.emit('turn:ui-state-change', { reason: 'race-started', running: true });
  assert.equal(timers.size, 0, 'Another car must not keep the Bella sampler alive');
  runtime.state.vehicleId = 'firetruck';
  events.emit('turn:ui-state-change', { reason: 'race-started', running: true });
  assert.equal(timers.size, 1);

  runtime.state.trackId = 'airport';
  events.emit('turn:track-changed', { trackId: 'airport' });
  assert.equal(timers.size, 0, 'Another track must not keep the Bella sampler alive');
  runtime.state.trackId = 'countryside';
  events.emit('turn:track-changed', { trackId: 'countryside' });
  assert.equal(timers.size, 1);

  runtime.state.mode = 'spectating';
  events.emit('turn:ui-state-change', { reason: 'spectate-started' });
  assert.equal(timers.size, 0, 'Spectate must not sample the hidden player car for Bella');
  runtime.state.mode = 'staged';
  events.emit('turn:ui-state-change', { reason: 'spectate-stopped' });
  assert.equal(timers.size, 1);

  runtime.state.running = false;
  events.emit('turn:ui-state-change', { reason: 'home-open', running: false });
  assert.equal(timers.size, 0, 'Returning Home must stop Bella sampling');
  runtime.state.running = true;
  events.emit('turn:ui-state-change', { reason: 'race-started', running: true });
  assert.equal(timers.size, 1);

  bellaSaved = true;
  const startsBeforeRescue = intervalStarts;
  events.emit('turn:achievements-updated', { unlocked: ['save-bella'] });
  assert.equal(root.userData.turnBellaRescued, true);
  assert.equal(timers.size, 0, 'Unlocking SAVE BELLA! must permanently stop its sampler');
  assert.equal(documentEvents.count('pointerdown'), 0);
  assert.equal(documentEvents.count('keydown'), 0);
  assert.equal(documentEvents.count('visibilitychange'), 0);
  assert.equal(events.count('turn:ui-state-change'), 0);
  assert.equal(events.count('turn:track-changed'), 0);

  events.emit('turn:ui-state-change', { reason: 'race-started', running: true });
  documentEvents.emit('visibilitychange');
  assert.equal(intervalStarts, startsBeforeRescue,
    'No lifecycle event may recreate the one-time sampler after rescue');

  root.userData.turnBellaDisposeRescueBehavior();
  assert.equal(timers.size, 0);

  root.userData.turnBellaRescueBehaviorInstalled = false;
  sandbox.installBellaRescueBehavior({ root, runtime });
  assert.equal(timers.size, 0);
  assert.equal(events.count('turn:ui-state-change'), 0,
    'Reinstalling around an already-rescued Bella must remain permanently dormant');
  assert.equal(documentEvents.count('visibilitychange'), 0);
  root.userData.turnBellaDisposeRescueBehavior();
}

try {
  await verifyChallengeAchievementLifecycle();
} finally {
  restoreGlobals();
}
await verifyBellaSamplingLifecycle();

console.log('TURN challenge achievements are event-driven and Bella sampling is eligibility-gated.');
