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

export function loadControlHandedness(storage = globalThis.localStorage) {
  try {
    return normalizeControlHandedness(storage?.getItem(CONTROL_HANDEDNESS_KEY));
  } catch (_) {
    return CONTROL_HANDEDNESS.RIGHT;
  }
}

export function applyControlHandedness(value) {
  const handedness = normalizeControlHandedness(value);
  const root = document.documentElement;
  root.dataset.turnControlHandedness = handedness;
  root.classList.toggle('turn-left-handed-controls', handedness === CONTROL_HANDEDNESS.LEFT);
  root.classList.toggle('turn-right-handed-controls', handedness === CONTROL_HANDEDNESS.RIGHT);
  window.dispatchEvent(new CustomEvent('turn:control-handedness-change', {
    detail: { handedness }
  }));
  return handedness;
}

export function saveControlHandedness(value, storage = globalThis.localStorage) {
  const handedness = normalizeControlHandedness(value);
  try {
    storage?.setItem(CONTROL_HANDEDNESS_KEY, handedness);
  } catch (_) {}
  return applyControlHandedness(handedness);
}

export function installControlHandedness() {
  return applyControlHandedness(loadControlHandedness());
}

export { CONTROL_HANDEDNESS, CONTROL_HANDEDNESS_KEY };
