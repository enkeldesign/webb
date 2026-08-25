export const ADVANCED_DRIFT_STORAGE_KEY = 'turn-advanced-drift-v1';
export const ADVANCED_DRIFT_DEFAULT = false;
export const ADVANCED_DRIFT_LOCK_ZONE_SHARE = 0.24;

export function advancedDriftEnabled(
  storage = getStorage(),
  defaultEnabled = ADVANCED_DRIFT_DEFAULT
) {
  try {
    const preference = storage?.getItem(ADVANCED_DRIFT_STORAGE_KEY);
    if (preference === 'on') return true;
    if (preference === 'off') return false;
    return defaultEnabled === true;
  } catch (_) {
    return defaultEnabled === true;
  }
}

export function saveAdvancedDriftEnabled(enabled, storage = getStorage()) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(ADVANCED_DRIFT_STORAGE_KEY, enabled ? 'on' : 'off');
    return true;
  } catch (_) {
    return false;
  }
}

export function resolveAdvancedDriftLock({
  enabled = false,
  driftActive = false,
  pointerX = 0,
  padLeft = 0,
  padWidth = 0
} = {}) {
  if (!enabled || !driftActive) return 0;

  const width = Math.max(1, finiteNumber(padWidth));
  const left = finiteNumber(padLeft);
  const lockZoneWidth = width * 0.5 * ADVANCED_DRIFT_LOCK_ZONE_SHARE;
  const overdragWidth = Math.min(24, Math.max(10, width * 0.06));
  const lockZoneStart = left + lockZoneWidth;
  const lockTravel = lockZoneWidth + overdragWidth;

  return clamp((lockZoneStart - finiteNumber(pointerX)) / lockTravel, 0, 1);
}

export function resolveAdvancedDriftThrottle(lockAmount) {
  return 1 - clamp(finiteNumber(lockAmount), 0, 1);
}

function getStorage() {
  try {
    return globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
