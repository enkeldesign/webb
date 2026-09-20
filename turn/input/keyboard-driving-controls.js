import {
  createKeyboardDriveOwnership,
  installKeyboardDriveOwnershipLossHandlers
} from './keyboard-drive-ownership.js?build=20260920-r269';

const STEER_LEFT = 'steer-left';
const STEER_RIGHT = 'steer-right';
const GAS = 'gas';
const BRAKE = 'brake';
const RESET = 'reset';

export const KEYBOARD_DRIVE_BINDINGS = Object.freeze({
  ArrowLeft: STEER_LEFT,
  KeyA: STEER_LEFT,
  ArrowRight: STEER_RIGHT,
  KeyD: STEER_RIGHT,
  ArrowUp: GAS,
  KeyW: GAS,
  ArrowDown: BRAKE,
  KeyS: BRAKE,
  Space: BRAKE,
  KeyR: RESET
});

export function keyboardDriveActionForEvent(event = {}) {
  const code = String(event.code || '');
  if (KEYBOARD_DRIVE_BINDINGS[code]) return KEYBOARD_DRIVE_BINDINGS[code];

  const key = String(event.key || '').toLowerCase();
  if (key === 'arrowleft' || key === 'a') return STEER_LEFT;
  if (key === 'arrowright' || key === 'd') return STEER_RIGHT;
  if (key === 'arrowup' || key === 'w') return GAS;
  if (key === 'arrowdown' || key === 's' || key === ' ') return BRAKE;
  if (key === 'r') return RESET;
  return null;
}

export function createKeyboardDrivingController({
  environment = globalThis,
  state,
  resetCar,
  controls = null,
  ownership = null
} = {}) {
  if (!state) throw new TypeError('Keyboard driving controls require runtime state.');
  if (typeof resetCar !== 'function') throw new TypeError('Keyboard driving controls require resetCar().');

  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef?.document;
  if (!documentRef || typeof windowRef?.addEventListener !== 'function') {
    return Object.freeze({ installed: false, release() {}, clear() {} });
  }

  const inputOwnership = ownership || createKeyboardDriveOwnership({
    environment,
    getState: () => state,
    controls
  });

  const held = new Map();
  let released = false;

  function identifier(event) {
    return String(event.code || event.key || '');
  }

  function consume(event) {
    event.preventDefault?.();
  }

  function syncSteering() {
    const steeringEntries = [...held.values()].filter((action) =>
      action === STEER_LEFT || action === STEER_RIGHT
    );
    const latest = steeringEntries.at(-1);
    if (latest === STEER_LEFT) state.manualSteering = -1;
    else if (latest === STEER_RIGHT) state.manualSteering = 1;
    else state.manualSteering = 0;
  }

  function syncGasAndBrake() {
    state.touchGas = [...held.values()].includes(GAS);
    state.touchBrake = [...held.values()].includes(BRAKE);
  }

  function syncHeldState() {
    syncSteering();
    syncGasAndBrake();
  }

  function clear() {
    if (!held.size) return;
    held.clear();
    syncHeldState();
  }

  function onKeyDown(event) {
    const action = keyboardDriveActionForEvent(event);
    if (!action || !inputOwnership.accepts(event)) return;

    consume(event);
    if (action === RESET) {
      if (!event.repeat) resetCar();
      return;
    }

    const keyId = identifier(event);
    if (!keyId || held.has(keyId)) return;
    held.set(keyId, action);
    syncHeldState();
  }

  function onKeyUp(event) {
    const action = keyboardDriveActionForEvent(event);
    if (!action || action === RESET) return;

    const keyId = identifier(event);
    if (!held.has(keyId)) return;
    held.delete(keyId);
    syncHeldState();

    if (inputOwnership.accepts(event)) consume(event);
  }

  windowRef.addEventListener('keydown', onKeyDown);
  windowRef.addEventListener('keyup', onKeyUp);

  const lossHandlers = installKeyboardDriveOwnershipLossHandlers({
    environment,
    ownership: inputOwnership,
    onLost: clear
  });

  const api = Object.freeze({
    installed: true,
    ownership: inputOwnership,
    clear,
    getHeldCount: () => held.size,
    release() {
      if (released) return;
      released = true;
      clear();
      lossHandlers.release();
      windowRef.removeEventListener('keydown', onKeyDown);
      windowRef.removeEventListener('keyup', onKeyUp);
    }
  });

  return api;
}
