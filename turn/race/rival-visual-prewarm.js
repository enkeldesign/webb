import { createCarVisual } from '../vehicle/car-models.js';

const RIVAL_TARGET_LENGTH = 5.5;
const FALLBACK_SECONDARY = '#f8f9fa';
const IDLE_TIMEOUT_MS = 900;

let scheduled = null;
let warmedKey = '';
let pendingKey = '';

function currentIdentity() {
  const state = globalThis.__turnRuntime?.state;
  if (!state || state.running === true) return null;
  const carId = String(state.vehicleId || 'sedan');
  const color = String(state.vehicleColor || '#ffd43b');
  const secondaryColor = String(state.vehicleSecondaryColor || FALLBACK_SECONDARY);
  return {
    key: `${carId}|${color}|${secondaryColor}`,
    carId,
    color,
    secondaryColor
  };
}

function runPrewarm() {
  scheduled = null;
  const identity = currentIdentity();
  if (!identity || identity.key === warmedKey || identity.key === pendingKey) return;

  pendingKey = identity.key;
  void createCarVisual({
    carId: identity.carId,
    color: identity.color,
    secondaryColor: identity.secondaryColor,
    ghost: true,
    targetLength: RIVAL_TARGET_LENGTH,
    outline: true
  }).then(() => {
    warmedKey = identity.key;
  }).catch(() => {
    // A failed optional prewarm must never block Home, The Lot or race startup.
  }).finally(() => {
    if (pendingKey === identity.key) pendingKey = '';
  });
}

function schedulePrewarm() {
  if (scheduled || !currentIdentity()) return;

  if (typeof globalThis.requestIdleCallback === 'function') {
    const id = globalThis.requestIdleCallback(runPrewarm, { timeout: IDLE_TIMEOUT_MS });
    scheduled = { type: 'idle', id };
    return;
  }

  const id = globalThis.setTimeout(runPrewarm, 80);
  scheduled = { type: 'timeout', id };
}

globalThis.addEventListener?.('turn:ui-state-change', schedulePrewarm);
globalThis.addEventListener?.('turn:track-changed', schedulePrewarm);
globalThis.setTimeout?.(schedulePrewarm, 0);
