const TELEMETRY_ENDPOINT = 'https://turn-challenges.erik-jansson-ux.workers.dev/v1/telemetry';
const CLIENT_VERSION = 3;
const FLUSH_DELAY_MS = 120;
const MAX_BATCH = 8;
export const DEVELOPER_STORAGE_KEY = 'turn.telemetry.developer.v1';

let installed = false;
let playSessionSent = false;
let flushTimer = 0;
let sessionId = '';
const queue = [];

export function installTurnTelemetry() {
  if (installed) return globalThis.__turnTelemetry || null;
  const deployment = document.documentElement.dataset.turnDeployment || '';
  if (deployment === 'next') return null;

  installed = true;
  sessionId = createSessionId();

  const api = Object.freeze({
    version: CLIENT_VERSION,
    record: queueEvent,
    flush: flushQueue,
    sessionId,
    isDeveloperDevice
  });
  globalThis.__turnTelemetry = api;

  window.addEventListener('turn:ui-state-change', (event) => {
    if (event.detail?.reason !== 'race-started') return;
    if (!playSessionSent) {
      playSessionSent = true;
      queueEvent('play_session');
    }
    queueEvent('race_start');
  });

  window.addEventListener('turn:lap-result', (event) => {
    queueEvent('lap_complete', {
      value: Number(event.detail?.time) || 0
    });
    // Keep the established event in its own batch during the Worker v2 -> v3
    // rollout. An older Worker can reject the new score vocabulary without
    // also losing lap completion telemetry.
    flushQueue();
    for (const channel of ['drift', 'flow']) {
      const result = event.detail?.[channel];
      if (result?.available !== true || result?.eligible !== true) continue;
      queueEvent(`${channel}_score`, {
        value: Number(result.score) || 0
      });
    }
  });

  window.addEventListener('turn:lap-invalid', (event) => {
    queueEvent('lap_invalid', {
      reason: String(event.detail?.reason || '')
    });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushQueue();
  });
  window.addEventListener('pagehide', flushQueue, { passive: true });
  return api;
}

function queueEvent(event, extra = {}) {
  if (!installed) return false;
  const runtime = globalThis.__turnRuntime;
  const state = runtime?.state || {};
  const audio = globalThis.__turnAudioPreferences?.getSettings?.() || {};
  const surface = document.documentElement.dataset.turnDeployment === 'yourturn'
    ? 'yourturn'
    : 'turn';
  const payload = {
    event,
    session: sessionId,
    surface,
    build: globalThis.__TURN_BUILD__?.id || '',
    trackId: state.trackId || runtime?.trackId || globalThis.__turnGetTrackId?.() || '',
    carId: state.vehicleId || '',
    steering: state.sensorMode === true ? 'motion' : state.sensorMode === false ? 'manual' : 'unknown',
    installed: isInstalledWebApp(),
    driveByEar: audio.dbeEnabled === true,
    blank: document.documentElement.classList.contains('turn-screen-blanked'),
    developer: isDeveloperDevice(),
    occurredAt: Date.now(),
    value: Number(extra.value) || 0,
    reason: String(extra.reason || '')
  };
  queue.push(payload);
  if (queue.length >= MAX_BATCH) flushQueue();
  else scheduleFlush();
  return true;
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = 0;
    flushQueue();
  }, FLUSH_DELAY_MS);
}

function flushQueue() {
  window.clearTimeout(flushTimer);
  flushTimer = 0;
  if (!queue.length) return false;
  const events = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify({ events });

  if (typeof navigator.sendBeacon === 'function') {
    try {
      const sent = navigator.sendBeacon(
        TELEMETRY_ENDPOINT,
        new Blob([body], { type: 'text/plain;charset=UTF-8' })
      );
      if (sent) {
        if (queue.length) scheduleFlush();
        return true;
      }
    } catch (_) {}
  }

  try {
    void fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body
    }).catch(() => {});
    if (queue.length) scheduleFlush();
    return true;
  } catch (_) {
    return false;
  }
}

function isInstalledWebApp() {
  return document.documentElement.classList.contains('turn-standalone')
    || navigator.standalone === true
    || globalThis.matchMedia?.('(display-mode: standalone)').matches === true
    || globalThis.matchMedia?.('(display-mode: fullscreen)').matches === true;
}

function isDeveloperDevice() {
  try {
    return localStorage.getItem(DEVELOPER_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

export function markDeveloperDevice(storage = globalThis.localStorage) {
  try {
    storage?.setItem?.(DEVELOPER_STORAGE_KEY, '1');
    return storage?.getItem?.(DEVELOPER_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function createSessionId() {
  try {
    if (typeof crypto?.randomUUID === 'function') {
      return crypto.randomUUID().replaceAll('-', '');
    }
  } catch (_) {}
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    return base64Url(bytes);
  } catch (_) {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`.slice(0, 48);
  }
}

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}
