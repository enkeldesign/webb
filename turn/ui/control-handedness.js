const CONTROL_HANDEDNESS_KEY = 'turn-control-handedness-v1';

const CONTROL_HANDEDNESS = Object.freeze({
  RIGHT: 'right',
  LEFT: 'left'
});

export function normalizeControlHandedness(value) {
  return value === CONTROL_HANDEDNESS.LEFT
    ? CONTROL_HANDEDNESS.LEFT
    : CONTROL_HANDEDNESS.RIGHT;
}

export function loadControlHandedness(storage) {
  try {
    return normalizeControlHandedness(preferenceStorage(storage)?.getItem(CONTROL_HANDEDNESS_KEY));
  } catch (_) {
    return CONTROL_HANDEDNESS.RIGHT;
  }
}

export function saveControlHandedness(value, storage) {
  const handedness = normalizeControlHandedness(value);
  try {
    preferenceStorage(storage)?.setItem(CONTROL_HANDEDNESS_KEY, handedness);
  } catch (_) {}
  return applyControlHandedness(handedness);
}

export function topDriveZoneAt(horizontalPosition, handedness) {
  const leftHalf = Math.max(0, Math.min(1, Number(horizontalPosition) || 0)) < 0.5;
  if (normalizeControlHandedness(handedness) === CONTROL_HANDEDNESS.LEFT) {
    return leftHalf ? 'boost' : 'drift';
  }
  return leftHalf ? 'drift' : 'boost';
}

export function driftLockSideForHandedness(handedness) {
  return normalizeControlHandedness(handedness) === CONTROL_HANDEDNESS.LEFT ? 'right' : 'left';
}

export function controlHandednessDescription(handedness) {
  return normalizeControlHandedness(handedness) === CONTROL_HANDEDNESS.LEFT
    ? 'On. Drive pad on the left; on-screen steering on the right.'
    : 'Off. Drive pad on the right; on-screen steering on the left.';
}

export function applyControlHandedness(value, {
  documentRef = globalThis.document,
  eventTarget = globalThis
} = {}) {
  const handedness = normalizeControlHandedness(value);
  const root = documentRef?.documentElement;
  if (root) {
    root.dataset.turnControlHandedness = handedness;
    root.classList?.toggle('turn-left-handed-controls', handedness === CONTROL_HANDEDNESS.LEFT);
    root.classList?.toggle('turn-right-handed-controls', handedness === CONTROL_HANDEDNESS.RIGHT);
  }

  const driveTop = documentRef?.querySelector?.('.drive-pad-top');
  const driftZone = documentRef?.querySelector?.('.drive-drift-zone');
  const boostZone = documentRef?.querySelector?.('.drive-boost-zone');
  if (driveTop && driftZone && boostZone) {
    if (handedness === CONTROL_HANDEDNESS.LEFT) driveTop.append(boostZone, driftZone);
    else driveTop.append(driftZone, boostZone);
  }

  const EventConstructor = globalThis.CustomEvent;
  if (typeof eventTarget?.dispatchEvent === 'function' && typeof EventConstructor === 'function') {
    try {
      eventTarget.dispatchEvent(new EventConstructor('turn:control-handedness-change', {
        detail: { handedness }
      }));
    } catch (_) {}
  }
  return handedness;
}

export function installControlHandedness(storage) {
  return applyControlHandedness(loadControlHandedness(storage));
}

function preferenceStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.__TURN_SHARED_LOCAL_STORAGE__ || globalThis.localStorage;
  } catch (_) {
    return null;
  }
}

export { CONTROL_HANDEDNESS, CONTROL_HANDEDNESS_KEY };
