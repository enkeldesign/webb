const KEYBOARD_POINTER_ID = 2147483002;

export const QE_DRIVE_BINDINGS = Object.freeze({
  KeyQ: 'drift',
  KeyE: 'boost'
});

export function qeDriveZoneForEvent(event = {}) {
  const byCode = QE_DRIVE_BINDINGS[String(event.code || '')];
  if (byCode) return byCode;
  const key = String(event.key || '').toLowerCase();
  if (key === 'q') return 'drift';
  if (key === 'e') return 'boost';
  return null;
}

export function createQeHoldController(onZoneChange) {
  if (typeof onZoneChange !== 'function') throw new TypeError('Q/E drive controller requires onZoneChange().');
  const held = new Map();
  let activeZone = null;

  function sync() {
    const values = [...held.values()];
    const nextZone = values.length ? values.at(-1) : null;
    if (nextZone === activeZone) return;
    activeZone = nextZone;
    onZoneChange(nextZone);
  }

  return Object.freeze({
    press(identifier, zone) {
      if (!identifier || !zone || held.has(identifier)) return false;
      held.set(identifier, zone);
      sync();
      return true;
    },
    release(identifier) {
      if (!held.has(identifier)) return false;
      held.delete(identifier);
      sync();
      return true;
    },
    clear() {
      if (!held.size && activeZone === null) return;
      held.clear();
      sync();
    },
    getActiveZone: () => activeZone,
    getHeldCount: () => held.size
  });
}

export function installQeDriveControls({ environment = globalThis } = {}) {
  if (environment.__turnQeDriveControls?.installed) return environment.__turnQeDriveControls;

  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef?.document;
  const controls = documentRef?.querySelector?.('#controls');
  const drivePad = documentRef?.querySelector?.('.drive-pad');
  const zones = Object.freeze({
    drift: documentRef?.querySelector?.('.drive-drift-zone'),
    boost: documentRef?.querySelector?.('.drive-boost-zone')
  });

  if (!documentRef?.body || !controls || !drivePad || !zones.drift || !zones.boost || typeof windowRef?.addEventListener !== 'function') {
    const unavailable = Object.freeze({ installed: false, release() {} });
    environment.__turnQeDriveControls = unavailable;
    return unavailable;
  }

  let keyboardPointerActive = false;
  let activePointerZone = null;
  let released = false;

  function runtimeState() {
    return environment.__turnRuntime?.state || null;
  }

  function hasBlockingOverlay() {
    if (documentRef.body.classList.contains('turn-home-open')) return true;
    if (documentRef.body.classList.contains('turn-lot-open')) return true;
    if (documentRef.body.classList.contains('turn-spectating')) return true;
    if (documentRef.querySelector?.('dialog[open]')) return true;
    return Boolean(documentRef.querySelector?.('[role="dialog"]:not([hidden])'));
  }

  function interactiveTarget(target) {
    const ElementConstructor = environment.Element;
    if (typeof ElementConstructor !== 'function' || !(target instanceof ElementConstructor)) return false;
    if (target.closest?.('.drive-pad')) return false;
    return Boolean(target.closest?.(
      'a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="radio"], [role="slider"]'
    ));
  }

  function acceptsDrivingInput(event = {}) {
    const state = runtimeState();
    if (!state?.running || documentRef.hidden || controls.hidden || hasBlockingOverlay()) return false;
    return !interactiveTarget(event.target);
  }

  function createKeyboardPointerEvent(type, target) {
    const rect = target.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: KEYBOARD_POINTER_ID,
      pointerType: 'keyboard',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2
    };

    if (typeof environment.PointerEvent === 'function') return new environment.PointerEvent(type, init);

    const event = new environment.Event(type, init);
    for (const [property, value] of Object.entries(init)) {
      try {
        Object.defineProperty(event, property, { configurable: true, value });
      } catch (_) {}
    }
    return event;
  }

  function dispatchKeyboardPointer(type, zoneName) {
    const target = zones[zoneName] || drivePad;
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
      console.warn('TURN: Q/E keyboard input could not enter the unified drive pad.', error);
      return false;
    } finally {
      if (hadOwnSet) drivePad.setPointerCapture = originalSet;
      else delete drivePad.setPointerCapture;
      if (hadOwnRelease) drivePad.releasePointerCapture = originalRelease;
      else delete drivePad.releasePointerCapture;
    }
  }

  function syncPointerZone(nextZone) {
    if (nextZone === activePointerZone) return;

    if (!keyboardPointerActive && nextZone) {
      if (!dispatchKeyboardPointer('pointerdown', nextZone)) return;
      keyboardPointerActive = true;
    } else if (keyboardPointerActive && nextZone) {
      if (!dispatchKeyboardPointer('pointermove', nextZone)) return;
    } else if (keyboardPointerActive) {
      dispatchKeyboardPointer('pointerup', activePointerZone);
      keyboardPointerActive = false;
    }

    activePointerZone = nextZone;
  }

  const held = createQeHoldController(syncPointerZone);

  function identifier(event) {
    return String(event.code || event.key || '');
  }

  function consume(event) {
    event.preventDefault?.();
    event.stopPropagation?.();
  }

  function onKeyDown(event) {
    const zone = qeDriveZoneForEvent(event);
    if (!zone || !acceptsDrivingInput(event)) return;
    consume(event);
    held.press(identifier(event), zone);
  }

  function onKeyUp(event) {
    const zone = qeDriveZoneForEvent(event);
    if (!zone) return;
    const key = identifier(event);
    if (held.release(key)) consume(event);
  }

  function releaseAll() {
    held.clear();
  }

  function onUiStateChange(event) {
    const reason = event.detail?.reason;
    if (!event.detail?.running || reason === 'race-reset' || reason === 'home-open' || reason === 'lot-open' || reason === 'spectate-started') {
      releaseAll();
    }
  }

  function onVisibilityChange() {
    if (documentRef.hidden) releaseAll();
  }

  function onFocusIn(event) {
    if (interactiveTarget(event.target)) releaseAll();
  }

  windowRef.addEventListener('keydown', onKeyDown, { capture: true });
  windowRef.addEventListener('keyup', onKeyUp, { capture: true });
  windowRef.addEventListener('blur', releaseAll);
  windowRef.addEventListener('turn:ui-state-change', onUiStateChange);
  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  documentRef.addEventListener('focusin', onFocusIn);

  const api = Object.freeze({
    installed: true,
    bindings: QE_DRIVE_BINDINGS,
    release() {
      if (released) return;
      released = true;
      releaseAll();
      windowRef.removeEventListener('keydown', onKeyDown, { capture: true });
      windowRef.removeEventListener('keyup', onKeyUp, { capture: true });
      windowRef.removeEventListener('blur', releaseAll);
      windowRef.removeEventListener('turn:ui-state-change', onUiStateChange);
      documentRef.removeEventListener('visibilitychange', onVisibilityChange);
      documentRef.removeEventListener('focusin', onFocusIn);
      if (environment.__turnQeDriveControls === api) delete environment.__turnQeDriveControls;
    }
  });

  environment.__turnQeDriveControls = api;
  documentRef.documentElement.dataset.turnQeDriveControls = 'q-drift-e-boost';
  return api;
}
