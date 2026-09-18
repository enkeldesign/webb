const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="checkbox"]',
  '[role="combobox"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="switch"]',
  '[role="textbox"]'
].join(', ');

export function isKeyboardDriveInteractiveTarget(target, { environment = globalThis } = {}) {
  const ElementConstructor = environment.Element;
  if (typeof ElementConstructor !== 'function' || !(target instanceof ElementConstructor)) return false;
  if (target.closest?.('.drive-pad')) return false;
  return Boolean(target.closest?.(INTERACTIVE_SELECTOR));
}

export function createKeyboardDriveOwnership({
  environment = globalThis,
  getState = () => environment.__turnRuntime?.state || null,
  controls = null
} = {}) {
  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef?.document;
  const controlsRef = controls || documentRef?.querySelector?.('#controls') || null;

  function hasBlockingOverlay() {
    if (!documentRef?.body) return true;
    if (documentRef.body.classList?.contains('turn-home-open')) return true;
    if (documentRef.body.classList?.contains('turn-lot-open')) return true;
    if (documentRef.body.classList?.contains('turn-spectating')) return true;
    if (documentRef.querySelector?.('dialog[open]')) return true;
    return Boolean(documentRef.querySelector?.('[role="dialog"]:not([hidden])'));
  }

  function ownsGameplay() {
    const state = getState?.();
    if (!state?.running || documentRef?.hidden) return false;
    if (controlsRef?.hidden) return false;
    return !hasBlockingOverlay();
  }

  function accepts(event = {}) {
    if (!ownsGameplay()) return false;
    return !isKeyboardDriveInteractiveTarget(event.target, { environment });
  }

  return Object.freeze({
    accepts,
    ownsGameplay,
    hasBlockingOverlay,
    interactiveTarget: (target) => isKeyboardDriveInteractiveTarget(target, { environment })
  });
}

export function installKeyboardDriveOwnershipLossHandlers({
  environment = globalThis,
  ownership,
  onLost
} = {}) {
  if (!ownership || typeof ownership.ownsGameplay !== 'function') {
    throw new TypeError('Keyboard drive ownership loss handlers require ownership.');
  }
  if (typeof onLost !== 'function') {
    throw new TypeError('Keyboard drive ownership loss handlers require onLost().');
  }

  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef?.document;
  if (!documentRef || typeof windowRef?.addEventListener !== 'function') {
    return Object.freeze({ release() {} });
  }

  let released = false;
  let observer = null;

  function releaseIfOwnershipLost() {
    if (!ownership.ownsGameplay()) onLost();
  }

  function onUiStateChange() {
    releaseIfOwnershipLost();
  }

  function onVisibilityChange() {
    releaseIfOwnershipLost();
  }

  function onFocusIn(event) {
    if (ownership.interactiveTarget(event.target) || !ownership.ownsGameplay()) onLost();
  }

  windowRef.addEventListener('turn:ui-state-change', onUiStateChange);
  windowRef.addEventListener('blur', onLost);
  windowRef.addEventListener('pagehide', onLost);
  documentRef.addEventListener?.('visibilitychange', onVisibilityChange);
  documentRef.addEventListener?.('focusin', onFocusIn);

  const MutationObserverConstructor = environment.MutationObserver;
  if (typeof MutationObserverConstructor === 'function' && documentRef.body) {
    observer = new MutationObserverConstructor(() => releaseIfOwnershipLost());
    observer.observe(documentRef.body, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'open', 'aria-hidden'],
      subtree: true
    });
  }

  return Object.freeze({
    release() {
      if (released) return;
      released = true;
      observer?.disconnect?.();
      windowRef.removeEventListener?.('turn:ui-state-change', onUiStateChange);
      windowRef.removeEventListener?.('blur', onLost);
      windowRef.removeEventListener?.('pagehide', onLost);
      documentRef.removeEventListener?.('visibilitychange', onVisibilityChange);
      documentRef.removeEventListener?.('focusin', onFocusIn);
    }
  });
}
