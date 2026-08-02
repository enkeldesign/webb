const KEYBOARD_POINTER_ID = 2147483001;

export const EXTERNAL_KEYBOARD_BINDINGS = Object.freeze({
  ArrowLeft: 'steer-left',
  KeyA: 'steer-left',
  ArrowRight: 'steer-right',
  KeyD: 'steer-right',
  ArrowUp: 'gas',
  KeyW: 'gas',
  ArrowDown: 'brake',
  KeyS: 'brake',
  Space: 'brake',
  KeyQ: 'drift',
  ShiftLeft: 'drift',
  ShiftRight: 'drift',
  KeyE: 'boost',
  ControlLeft: 'boost',
  ControlRight: 'boost',
  KeyR: 'restart'
});

const FALLBACK_KEY_BINDINGS = Object.freeze({
  arrowleft: 'steer-left',
  a: 'steer-left',
  arrowright: 'steer-right',
  d: 'steer-right',
  arrowup: 'gas',
  w: 'gas',
  arrowdown: 'brake',
  s: 'brake',
  ' ': 'brake',
  spacebar: 'brake',
  q: 'drift',
  shift: 'drift',
  e: 'boost',
  control: 'boost',
  ctrl: 'boost',
  r: 'restart'
});

export function keyboardActionForCode(code) {
  return EXTERNAL_KEYBOARD_BINDINGS[String(code || '')] || null;
}

export function keyboardActionForEvent(event = {}) {
  return keyboardActionForCode(event.code)
    || FALLBACK_KEY_BINDINGS[String(event.key || '').toLowerCase()]
    || null;
}

export function installExternalKeyboardControls({ environment = globalThis } = {}) {
  const documentRef = environment.document;
  const windowRef = environment.window || environment;
  if (!documentRef?.body || typeof windowRef?.addEventListener !== 'function') {
    return Object.freeze({ installed: false, release() {} });
  }

  if (environment.__turnExternalKeyboardControls?.installed) {
    return environment.__turnExternalKeyboardControls;
  }

  const controls = documentRef.querySelector('#controls');
  const drivePad = documentRef.querySelector('.drive-pad');
  const manualSteer = documentRef.querySelector('#manualSteer');
  const resetButton = documentRef.querySelector('#resetButton');
  const zoneElements = Object.freeze({
    gas: documentRef.querySelector('.drive-gas-zone'),
    brake: documentRef.querySelector('.drive-brake-zone'),
    drift: documentRef.querySelector('.drive-drift-zone'),
    boost: documentRef.querySelector('.drive-boost-zone')
  });

  if (!controls || !drivePad || !manualSteer || !resetButton || Object.values(zoneElements).some((element) => !element)) {
    const unavailable = Object.freeze({ installed: false, release() {} });
    environment.__turnExternalKeyboardControls = unavailable;
    return unavailable;
  }

  manualSteer.tabIndex = 0;
  manualSteer.setAttribute(
    'aria-label',
    'Steering. Use Left and Right Arrow keys or A and D. Steering returns to centre when released.'
  );
  setSteeringVisual(manualSteer, 0);

  const heldKeys = new Map();
  let keyboardPointerActive = false;
  let activeDriveZone = null;
  let activeSteering = 0;
  let pointerBridgeFailed = false;
  let released = false;

  function runtimeState() {
    return environment.__turnRuntime?.state || null;
  }

  function isDesktopGate() {
    return documentRef.documentElement.classList.contains('turn-desktop-device');
  }

  function hasBlockingOverlay() {
    if (documentRef.body.classList.contains('turn-home-open')) return true;
    if (documentRef.body.classList.contains('turn-lot-open')) return true;
    if (documentRef.body.classList.contains('turn-spectating')) return true;
    if (documentRef.querySelector('dialog[open]')) return true;
    return Boolean(documentRef.querySelector('[role="dialog"]:not([hidden])'));
  }

  function interactiveTarget(target) {
    const ElementConstructor = environment.Element;
    if (typeof ElementConstructor !== 'function' || !(target instanceof ElementConstructor)) return false;
    if (target.closest('.drive-pad, #manualSteer')) return false;
    return Boolean(target.closest(
      'a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="radio"], [role="slider"]'
    ));
  }

  function acceptsDrivingInput(event) {
    const state = runtimeState();
    if (!state?.running || documentRef.hidden || controls.hidden || isDesktopGate() || hasBlockingOverlay()) return false;
    return !interactiveTarget(event.target);
  }

  function activeActions() {
    return new Set(heldKeys.values());
  }

  function requestedDriveZone(actions) {
    if (actions.has('brake')) return 'brake';
    if (actions.has('boost')) return 'boost';
    if (actions.has('drift')) return 'drift';
    if (actions.has('gas')) return 'gas';
    return null;
  }

  function requestedSteering(actions) {
    const left = actions.has('steer-left') ? 1 : 0;
    const right = actions.has('steer-right') ? 1 : 0;
    return right - left;
  }

  function createKeyboardPointerEvent(type, target) {
    const rect = target.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: KEYBOARD_POINTER_ID,
      pointerType: 'keyboard',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      clientX,
      clientY
    };

    if (typeof environment.PointerEvent === 'function') {
      return new environment.PointerEvent(type, init);
    }

    const event = new environment.Event(type, init);
    for (const [property, value] of Object.entries(init)) {
      try {
        Object.defineProperty(event, property, { configurable: true, value });
      } catch (_) {}
    }
    return event;
  }

  function dispatchKeyboardPointer(type, zoneName) {
    const target = zoneElements[zoneName] || drivePad;
    const hadOwnSet = Object.prototype.hasOwnProperty.call(drivePad, 'setPointerCapture');
    const hadOwnRelease = Object.prototype.hasOwnProperty.call(drivePad, 'releasePointerCapture');
    const originalSet = drivePad.setPointerCapture;
    const originalRelease = drivePad.releasePointerCapture;

    try {
      drivePad.setPointerCapture = function setPointerCapture(pointerId) {
        if (pointerId === KEYBOARD_POINTER_ID) return;
        return originalSet?.call(this, pointerId);
      };
      drivePad.releasePointerCapture = function releasePointerCapture(pointerId) {
        if (pointerId === KEYBOARD_POINTER_ID) return;
        return originalRelease?.call(this, pointerId);
      };
      target.dispatchEvent(createKeyboardPointerEvent(type, target));
      return true;
    } catch (error) {
      if (!pointerBridgeFailed) {
        pointerBridgeFailed = true;
        console.warn('TURN: external keyboard could not enter the unified drive surface.', error);
      }
      return false;
    } finally {
      if (hadOwnSet) drivePad.setPointerCapture = originalSet;
      else delete drivePad.setPointerCapture;
      if (hadOwnRelease) drivePad.releasePointerCapture = originalRelease;
      else delete drivePad.releasePointerCapture;
    }
  }

  function syncDriveZone(nextZone) {
    if (nextZone === activeDriveZone) return;

    if (!keyboardPointerActive && nextZone) {
      if (!dispatchKeyboardPointer('pointerdown', nextZone)) return;
      keyboardPointerActive = true;
    } else if (keyboardPointerActive && nextZone) {
      if (!dispatchKeyboardPointer('pointermove', nextZone)) return;
    } else if (keyboardPointerActive) {
      dispatchKeyboardPointer('pointerup', activeDriveZone);
      keyboardPointerActive = false;
    }

    activeDriveZone = nextZone;
  }

  function syncSteering(nextSteering) {
    if (nextSteering === activeSteering) return;
    activeSteering = nextSteering;
    const state = runtimeState();
    if (state) state.manualSteering = nextSteering;
    setSteeringVisual(manualSteer, nextSteering);
  }

  function syncInputs() {
    const actions = activeActions();
    syncSteering(requestedSteering(actions));
    syncDriveZone(requestedDriveZone(actions));
  }

  function releaseAllInputs() {
    if (!heldKeys.size && !keyboardPointerActive && activeSteering === 0) return;
    heldKeys.clear();
    syncSteering(0);
    syncDriveZone(null);
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function keyIdentifier(event) {
    return String(event.code || event.key || '');
  }

  function onKeyDown(event) {
    const action = keyboardActionForEvent(event);
    if (!action || !acceptsDrivingInput(event)) return;
    consume(event);

    if (action === 'restart') {
      if (!event.repeat && !resetButton.hidden && !resetButton.disabled) resetButton.click();
      return;
    }

    const identifier = keyIdentifier(event);
    if (heldKeys.has(identifier)) return;
    heldKeys.set(identifier, action);
    syncInputs();
  }

  function onKeyUp(event) {
    const action = keyboardActionForEvent(event);
    if (!action) return;

    const identifier = keyIdentifier(event);
    if (heldKeys.has(identifier)) {
      consume(event);
      heldKeys.delete(identifier);
      syncInputs();
      return;
    }

    if (acceptsDrivingInput(event)) consume(event);
  }

  function onUiStateChange(event) {
    const reason = event.detail?.reason;
    if (!event.detail?.running || reason === 'race-reset' || reason === 'home-open' || reason === 'lot-open' || reason === 'spectate-started') {
      releaseAllInputs();
    }
  }

  function onVisibilityChange() {
    if (documentRef.hidden) releaseAllInputs();
  }

  function onFocusIn(event) {
    if (interactiveTarget(event.target)) releaseAllInputs();
  }

  function onDocumentClick() {
    const checkAfterClick = () => {
      if (heldKeys.size && hasBlockingOverlay()) releaseAllInputs();
    };
    if (typeof environment.queueMicrotask === 'function') environment.queueMicrotask(checkAfterClick);
    else Promise.resolve().then(checkAfterClick);
  }

  windowRef.addEventListener('keydown', onKeyDown, { capture: true });
  windowRef.addEventListener('keyup', onKeyUp, { capture: true });
  windowRef.addEventListener('blur', releaseAllInputs);
  windowRef.addEventListener('turn:ui-state-change', onUiStateChange);
  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  documentRef.addEventListener('focusin', onFocusIn);
  documentRef.addEventListener('click', onDocumentClick, { capture: true });

  const api = Object.freeze({
    installed: true,
    bindings: EXTERNAL_KEYBOARD_BINDINGS,
    release() {
      if (released) return;
      released = true;
      releaseAllInputs();
      windowRef.removeEventListener('keydown', onKeyDown, { capture: true });
      windowRef.removeEventListener('keyup', onKeyUp, { capture: true });
      windowRef.removeEventListener('blur', releaseAllInputs);
      windowRef.removeEventListener('turn:ui-state-change', onUiStateChange);
      documentRef.removeEventListener('visibilitychange', onVisibilityChange);
      documentRef.removeEventListener('focusin', onFocusIn);
      documentRef.removeEventListener('click', onDocumentClick, { capture: true });
      if (environment.__turnExternalKeyboardControls === api) {
        delete environment.__turnExternalKeyboardControls;
      }
    }
  });

  environment.__turnExternalKeyboardControls = api;
  documentRef.documentElement.dataset.turnExternalKeyboard = 'arrows-wasd-qer-space-shift-control';
  return api;
}

function setSteeringVisual(element, value) {
  const steering = Math.max(-1, Math.min(1, Number(value) || 0));
  const percent = Math.round(steering * 100);
  element.style.setProperty('--manual-steer-left', `${50 + steering * 28}%`);
  element.setAttribute('aria-valuenow', String(percent));
  element.setAttribute('aria-valuetext', steeringValueText(percent));
  element.classList.toggle('is-steering', steering !== 0);
}

function steeringValueText(percent) {
  if (percent === 0) return 'Centred';
  return `${Math.abs(percent)} percent ${percent < 0 ? 'left' : 'right'}`;
}
