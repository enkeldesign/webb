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

export function keyboardActionForCode(code) {
  return EXTERNAL_KEYBOARD_BINDINGS[String(code || '')] || null;
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

  const heldCodes = new Map();
  let keyboardPointerActive = false;
  let activeDriveZone = null;
  let activeSteering = 0;
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
    if (!(target instanceof environment.Element)) return false;
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
    return new Set(heldCodes.values());
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
      dispatchKeyboardPointer('pointerdown', nextZone);
      keyboardPointerActive = true;
    } else if (keyboardPointerActive && nextZone) {
      dispatchKeyboardPointer('pointermove', nextZone);
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
    if (!heldCodes.size && !keyboardPointerActive && activeSteering === 0) return;
    heldCodes.clear();
    syncSteering(0);
    syncDriveZone(null);
  }

  function consume(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function onKeyDown(event) {
    const action = keyboardActionForCode(event.code);
    if (!action || !acceptsDrivingInput(event)) return;
    consume(event);

    if (action === 'restart') {
      if (!event.repeat && !resetButton.hidden && !resetButton.disabled) resetButton.click();
      return;
    }

    if (heldCodes.has(event.code)) return;
    heldCodes.set(event.code, action);
    syncInputs();
  }

  function onKeyUp(event) {
    const action = keyboardActionForCode(event.code);
    if (!action) return;

    if (heldCodes.has(event.code)) {
      consume(event);
      heldCodes.delete(event.code);
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

  const overlayObserver = typeof environment.MutationObserver === 'function'
    ? new environment.MutationObserver(() => {
      if (heldCodes.size && hasBlockingOverlay()) releaseAllInputs();
    })
    : null;
  overlayObserver?.observe(documentRef.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open', 'hidden']
  });

  windowRef.addEventListener('keydown', onKeyDown, { capture: true });
  windowRef.addEventListener('keyup', onKeyUp, { capture: true });
  windowRef.addEventListener('blur', releaseAllInputs);
  windowRef.addEventListener('turn:ui-state-change', onUiStateChange);
  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  documentRef.addEventListener('focusin', onFocusIn);

  const api = Object.freeze({
    installed: true,
    bindings: EXTERNAL_KEYBOARD_BINDINGS,
    release() {
      if (released) return;
      released = true;
      releaseAllInputs();
      overlayObserver?.disconnect();
      windowRef.removeEventListener('keydown', onKeyDown, { capture: true });
      windowRef.removeEventListener('keyup', onKeyUp, { capture: true });
      windowRef.removeEventListener('blur', releaseAllInputs);
      windowRef.removeEventListener('turn:ui-state-change', onUiStateChange);
      documentRef.removeEventListener('visibilitychange', onVisibilityChange);
      documentRef.removeEventListener('focusin', onFocusIn);
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
