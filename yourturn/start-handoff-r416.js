const OPTIONAL_PLATFORM_WAIT_MS = 900;
const HANDOFF_FAILURE_MS = 5000;

const diagnostics = {
  installed: false,
  stage: 'boot',
  fullscreenTimeouts: 0,
  orientationTimeouts: 0,
  handoffStartedAt: 0,
  handoffReadyAt: 0,
  recoveryShown: false
};
globalThis.__yourTurnStartHandoffDiagnostics = diagnostics;

function boundedOptionalPromise(value, timeoutMs, onTimeout) {
  let timer = 0;
  return Promise.race([
    Promise.resolve(value).then(() => true).catch(() => false),
    new Promise((resolve) => {
      timer = globalThis.setTimeout?.(() => {
        onTimeout?.();
        resolve(false);
      }, timeoutMs);
    })
  ]).finally(() => globalThis.clearTimeout?.(timer));
}

export function settleOptionalFullscreen(value, timeoutMs = OPTIONAL_PLATFORM_WAIT_MS) {
  return boundedOptionalPromise(value, timeoutMs, () => {
    diagnostics.fullscreenTimeouts += 1;
    diagnostics.stage = 'fullscreen-timeout';
  });
}

export function settleOptionalOrientationLock(value, timeoutMs = OPTIONAL_PLATFORM_WAIT_MS) {
  return boundedOptionalPromise(value, timeoutMs, () => {
    diagnostics.orientationTimeouts += 1;
    diagnostics.stage = 'orientation-lock-timeout';
  });
}

function installBoundedMethod(target, property, settle) {
  const native = target?.[property];
  if (typeof native !== 'function' || native.__yourTurnBoundedOptional === true) return false;

  const wrapped = function (...args) {
    let result;
    try {
      result = native.apply(this, args);
    } catch (_) {
      return Promise.resolve(false);
    }
    return settle(result);
  };
  Object.defineProperty(wrapped, '__yourTurnBoundedOptional', { value: true });

  try {
    Object.defineProperty(target, property, {
      configurable: true,
      writable: true,
      value: wrapped
    });
    return true;
  } catch (_) {
    try {
      target[property] = wrapped;
      return target[property] === wrapped;
    } catch (_) {
      return false;
    }
  }
}

function installOptionalPlatformBounds() {
  const root = document.documentElement;
  installBoundedMethod(root, 'requestFullscreen', settleOptionalFullscreen);
  installBoundedMethod(root, 'webkitRequestFullscreen', settleOptionalFullscreen);
  installBoundedMethod(globalThis.screen?.orientation, 'lock', settleOptionalOrientationLock);
}

function raceUiReady(hud, controls) {
  return hud?.hidden === false
    && controls?.hidden === false
    && !document.body.classList.contains('turn-lot-open')
    && !document.body.classList.contains('yourturn-runtime-paused');
}

function installVisibleHandoffGuard() {
  const rotate = document.querySelector('#yourTurnRotate');
  const hud = document.querySelector('#hud');
  const controls = document.querySelector('#controls');
  const title = rotate?.querySelector('#yourTurnRotateTitle, strong');
  const copy = rotate?.querySelector('p');
  if (!rotate || !hud || !controls || !title || !copy) return false;

  const originalTitle = title.textContent;
  const originalCopy = copy.textContent;
  let guarding = false;
  let failureTimer = 0;
  let recovery = null;

  function clearFailureTimer() {
    globalThis.clearTimeout?.(failureTimer);
    failureTimer = 0;
  }

  function removeRecovery() {
    recovery?.remove();
    recovery = null;
    diagnostics.recoveryShown = false;
  }

  function showPreparing() {
    title.textContent = 'PREPARING YOUR RACE';
    copy.textContent = 'One moment…';
    removeRecovery();
  }

  function showRecovery() {
    if (!guarding || raceUiReady(hud, controls)) return;
    diagnostics.stage = 'handoff-timeout';
    diagnostics.recoveryShown = true;
    title.textContent = 'RACE DID NOT START';
    copy.textContent = 'YOUR TURN is still open. Try the challenge again rather than being left on a blank screen.';
    if (recovery) return;

    recovery = document.createElement('div');
    recovery.className = 'yourturn-actions yourturn-handoff-recovery';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'is-primary';
    retry.textContent = 'TRY AGAIN';
    retry.addEventListener('click', () => globalThis.location?.reload?.());
    const openTurn = document.createElement('button');
    openTurn.type = 'button';
    openTurn.className = 'is-navigation';
    openTurn.textContent = 'OPEN TURN';
    openTurn.addEventListener('click', () => { globalThis.location.href = '/turn/'; });
    recovery.append(retry, openTurn);
    rotate.querySelector('.yourturn-rotate-card')?.appendChild(recovery);
  }

  function beginGuard() {
    if (guarding) return;
    guarding = true;
    diagnostics.stage = 'preparing-race';
    diagnostics.handoffStartedAt = performance.now();
    rotate.hidden = false;
    document.body.classList.add('yourturn-awaiting-landscape');
    showPreparing();
    clearFailureTimer();
    failureTimer = globalThis.setTimeout?.(showRecovery, HANDOFF_FAILURE_MS) || 0;
  }

  function finishGuard() {
    if (!guarding) return;
    guarding = false;
    clearFailureTimer();
    removeRecovery();
    diagnostics.stage = 'race-ready';
    diagnostics.handoffReadyAt = performance.now();
    title.textContent = originalTitle;
    copy.textContent = originalCopy;
    rotate.hidden = true;
    document.body.classList.remove('yourturn-awaiting-landscape');
  }

  function sync() {
    const handoffAttempted = document.body.classList.contains('yourturn-racing');
    if (!handoffAttempted) return;

    if (raceUiReady(hud, controls)) {
      finishGuard();
      return;
    }

    // session.js currently hides the rotate prompt before the asynchronous race
    // start has completed. Re-show it immediately so iOS can never expose the
    // cyan canvas as an apparent terminal state while optional platform APIs settle.
    if (rotate.hidden || guarding) beginGuard();
  }

  const observer = typeof MutationObserver === 'function'
    ? new MutationObserver(sync)
    : null;
  observer?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  observer?.observe(rotate, { attributes: true, attributeFilter: ['hidden'] });
  observer?.observe(hud, { attributes: true, attributeFilter: ['hidden'] });
  observer?.observe(controls, { attributes: true, attributeFilter: ['hidden'] });
  window.addEventListener('turn:ui-state-change', sync);
  sync();
  return true;
}

function install() {
  if (diagnostics.installed) return;
  diagnostics.installed = true;
  diagnostics.stage = 'installed';
  installOptionalPlatformBounds();
  installVisibleHandoffGuard();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', install, { once: true });
} else {
  install();
}
