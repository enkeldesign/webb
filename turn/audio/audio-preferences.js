const AUDIO_ENABLED_STORAGE_KEY = 'turn-audio-enabled-v1';
const AUDIO_BALANCE_STORAGE_KEY = 'turn-audio-balance-v1';
const DEFAULT_BALANCE = 0.5;
const GRAPH_GAIN_ROLES = Object.freeze([
  'master',
  'dynamics',
  'guidance',
  'route',
  'world',
  'safety'
]);

const nodeRoles = new WeakMap();
const contextStates = new Set();
let installed = false;
let originalConnect = null;
let routingAvailable = false;
let audioEnabled = readBoolean(AUDIO_ENABLED_STORAGE_KEY, true);
let dbeEnabled = globalThis.__turnDriveByEarEnabled !== false;
let balance = readBalance();
let dbeGraphAvailable = dbeEnabled;

export function installAudioPreferences({ driveByEarGraphAvailable = dbeEnabled } = {}) {
  dbeGraphAvailable = Boolean(driveByEarGraphAvailable);
  dbeEnabled = globalThis.__turnDriveByEarEnabled !== false;

  if (!installed) {
    installed = true;
    const connectPatched = patchAudioNodeConnect();
    const gainFactoryPatched = patchAudioContextFactories();
    routingAvailable = connectPatched && gainFactoryPatched;
  }

  const api = Object.freeze({
    getSettings,
    setAudioEnabled,
    setDriveByEarEnabled,
    setBalance,
    get graphReady() {
      return [...contextStates].some((state) => Boolean(state.masterPreference));
    },
    get routingAvailable() {
      return routingAvailable;
    },
    get driveByEarGraphAvailable() {
      return dbeGraphAvailable;
    }
  });

  globalThis.__turnAudioPreferences = api;
  return api;
}

export function getSettings() {
  return Object.freeze({
    audioEnabled,
    dbeEnabled,
    balance,
    driveByEarGraphAvailable: dbeGraphAvailable,
    routingAvailable
  });
}

export function setAudioEnabled(enabled) {
  audioEnabled = Boolean(enabled);
  writeStorage(AUDIO_ENABLED_STORAGE_KEY, audioEnabled ? 'on' : 'off');
  applyAllPreferences();
  return audioEnabled;
}

export function setDriveByEarEnabled(enabled) {
  dbeEnabled = Boolean(enabled);
  globalThis.__turnDriveByEarEnabled = dbeEnabled;
  applyAllPreferences();
  return dbeEnabled;
}

export function setBalance(nextBalance) {
  balance = clamp(Number(nextBalance), 0, 1, DEFAULT_BALANCE);
  writeStorage(AUDIO_BALANCE_STORAGE_KEY, balance.toFixed(3));
  applyAllPreferences();
  return balance;
}

function patchAudioContextFactories() {
  const prototypes = [
    globalThis.AudioContext?.prototype,
    globalThis.webkitAudioContext?.prototype
  ].filter(Boolean);
  let patchedAny = false;

  for (const prototype of [...new Set(prototypes)]) {
    const currentCreateGain = prototype.createGain;
    if (typeof currentCreateGain !== 'function') continue;
    if (currentCreateGain.__turnAudioPreferencesPatched) {
      patchedAny = true;
      continue;
    }

    function createTurnGain(...args) {
      const node = currentCreateGain.apply(this, args);
      const state = ensureContextState(this);

      if (state.internalDepth === 0 && state.graphGainCount < GRAPH_GAIN_ROLES.length) {
        const role = GRAPH_GAIN_ROLES[state.graphGainCount];
        state.graphGainCount += 1;
        nodeRoles.set(node, { state, role });
        if (role === 'master') state.master = node;
      }

      return node;
    }

    createTurnGain.__turnAudioPreferencesPatched = true;
    patchedAny = replacePrototypeMethod(prototype, 'createGain', createTurnGain) || patchedAny;
  }

  return patchedAny;
}

function patchAudioNodeConnect() {
  const prototype = globalThis.AudioNode?.prototype;
  if (!prototype || typeof prototype.connect !== 'function') return false;
  if (prototype.connect.__turnAudioPreferencesPatched) {
    originalConnect = prototype.connect.__turnAudioPreferencesOriginal || null;
    return Boolean(originalConnect);
  }

  originalConnect = prototype.connect;

  function connectWithPreferences(destination, ...args) {
    const metadata = nodeRoles.get(this);
    if (!metadata || !destination || !originalConnect) {
      return originalConnect
        ? originalConnect.call(this, destination, ...args)
        : destination;
    }

    const { state, role } = metadata;

    if (role === 'master') {
      const preference = ensurePreferenceGain(state, 'masterPreference');
      connectOnce(state, preference, destination, 'masterDestination');
      originalConnect.call(this, preference);
      return destination;
    }

    if (role === 'dynamics' || role === 'world') {
      const preference = ensurePreferenceGain(state, 'otherPreference');
      connectPreferenceToMaster(state, preference, 'otherConnected');
      originalConnect.call(this, preference);
      return destination;
    }

    if (role === 'guidance' || role === 'route' || role === 'safety') {
      const preference = ensurePreferenceGain(state, 'dbePreference');
      connectPreferenceToMaster(state, preference, 'dbeConnected');
      originalConnect.call(this, preference);
      return destination;
    }

    return originalConnect.call(this, destination, ...args);
  }

  connectWithPreferences.__turnAudioPreferencesPatched = true;
  connectWithPreferences.__turnAudioPreferencesOriginal = originalConnect;
  return replacePrototypeMethod(prototype, 'connect', connectWithPreferences);
}

function replacePrototypeMethod(prototype, name, replacement) {
  try {
    prototype[name] = replacement;
    if (prototype[name] === replacement) return true;
  } catch (_) {}

  try {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    Object.defineProperty(prototype, name, {
      ...descriptor,
      configurable: true,
      writable: true,
      value: replacement
    });
    return prototype[name] === replacement;
  } catch (_) {
    return false;
  }
}

function ensureContextState(context) {
  for (const state of contextStates) {
    if (state.context === context) return state;
  }

  const state = {
    context,
    graphGainCount: 0,
    internalDepth: 0,
    master: null,
    masterPreference: null,
    otherPreference: null,
    dbePreference: null,
    masterDestination: null,
    otherConnected: false,
    dbeConnected: false
  };
  contextStates.add(state);
  return state;
}

function ensurePreferenceGain(state, key) {
  if (state[key]) return state[key];
  state.internalDepth += 1;
  let gain;
  try {
    gain = state.context.createGain();
  } finally {
    state.internalDepth -= 1;
  }
  state[key] = gain;
  applyPreferences(state);
  return gain;
}

function connectPreferenceToMaster(state, preference, flagKey) {
  if (state[flagKey] || !state.master || !originalConnect) return;
  originalConnect.call(preference, state.master);
  state[flagKey] = true;
}

function connectOnce(state, source, destination, destinationKey) {
  if (state[destinationKey] === destination || !originalConnect) return;
  originalConnect.call(source, destination);
  state[destinationKey] = destination;
}

function applyAllPreferences() {
  for (const state of contextStates) applyPreferences(state);
}

function applyPreferences(state) {
  const now = state.context?.currentTime || 0;
  const dbeFactor = balance < DEFAULT_BALANCE ? balance / DEFAULT_BALANCE : 1;
  const otherFactor = balance > DEFAULT_BALANCE
    ? (1 - balance) / (1 - DEFAULT_BALANCE)
    : 1;

  setGain(state.masterPreference, audioEnabled ? 1 : 0, now);
  setGain(state.otherPreference, otherFactor, now);
  setGain(state.dbePreference, dbeEnabled ? dbeFactor : 0, now);
}

function setGain(node, value, now) {
  if (!node?.gain) return;
  const next = clamp(value, 0, 1, 1);
  try {
    node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(next, now, 0.025);
  } catch (_) {
    try {
      node.gain.value = next;
    } catch (_) {}
  }
}

function readBoolean(key, fallback) {
  const value = readStorage(key);
  if (value === 'off') return false;
  if (value === 'on') return true;
  return fallback;
}

function readBalance() {
  const stored = readStorage(AUDIO_BALANCE_STORAGE_KEY);
  if (stored == null || stored === '') return DEFAULT_BALANCE;
  return clamp(Number(stored), 0, 1, DEFAULT_BALANCE);
}

function readStorage(key) {
  try {
    return globalThis.localStorage?.getItem(key);
  } catch (_) {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    globalThis.localStorage?.setItem(key, value);
    return true;
  } catch (_) {
    return false;
  }
}

function clamp(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
