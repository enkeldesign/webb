function once(callback) {
  let active = true;
  return () => {
    if (!active) return false;
    active = false;
    callback();
    return true;
  };
}

function requireMotionPort(platform) {
  const motion = platform?.motion;
  for (const method of ['isAvailable', 'requestPermission', 'subscribe']) {
    if (typeof motion?.[method] !== 'function') {
      throw new TypeError(`TURN Platform M5 requires motion.${method}().`);
    }
  }
  return motion;
}

function replaceProperty(target, key, value) {
  if (!target) return () => {};
  const ownDescriptor = Object.getOwnPropertyDescriptor(target, key);
  const previousValue = target[key];

  try {
    target[key] = value;
  } catch (_) {}

  if (target[key] !== value) {
    Object.defineProperty(target, key, {
      configurable: true,
      writable: true,
      value
    });
  }

  return () => {
    if (ownDescriptor) {
      Object.defineProperty(target, key, ownDescriptor);
    } else {
      try {
        delete target[key];
      } catch (_) {
        target[key] = previousValue;
      }
    }
  };
}

function createBridgedMotionEvent(originalMotionEvent, requestPermission) {
  function TurnMotionEventBridge(...args) {
    if (!originalMotionEvent) return undefined;
    const constructor = new.target === TurnMotionEventBridge
      ? originalMotionEvent
      : (new.target || originalMotionEvent);
    return Reflect.construct(originalMotionEvent, args, constructor);
  }

  if (originalMotionEvent) {
    Object.setPrototypeOf(TurnMotionEventBridge, originalMotionEvent);
    TurnMotionEventBridge.prototype = originalMotionEvent.prototype;
  }

  Object.defineProperty(TurnMotionEventBridge, 'requestPermission', {
    configurable: true,
    value: requestPermission
  });
  return TurnMotionEventBridge;
}

export function installMotionLifecycleBridge({
  platform,
  environment = globalThis
} = {}) {
  const motion = requireMotionPort(platform);
  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef?.document;
  const originalAddEventListener = windowRef?.addEventListener;
  const originalRemoveEventListener = windowRef?.removeEventListener;

  if (typeof originalAddEventListener !== 'function') {
    throw new TypeError('TURN Platform M5 requires window.addEventListener().');
  }

  let activeListener = null;
  let releaseSubscription = null;
  let launchPending = false;
  let disposed = false;

  function stopSubscription() {
    if (!releaseSubscription) return false;
    const release = releaseSubscription;
    releaseSubscription = null;
    activeListener = null;
    return release();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function' && typeof listener?.handleEvent !== 'function') {
      throw new TypeError('TURN motion listener must be callable.');
    }
    if (activeListener === listener && releaseSubscription) return;

    stopSubscription();
    const unsubscribe = motion.subscribe(listener);
    if (typeof unsubscribe !== 'function') {
      throw new TypeError('TURN platform motion subscription must return a cleanup function.');
    }
    activeListener = listener;
    releaseSubscription = once(unsubscribe);
  }

  function patchedAddEventListener(type, listener, options) {
    if (type === 'devicemotion') {
      subscribe(listener);
      return;
    }
    return originalAddEventListener.call(this, type, listener, options);
  }

  function patchedRemoveEventListener(type, listener, options) {
    if (type === 'devicemotion') {
      if (listener === activeListener) stopSubscription();
      return;
    }
    return originalRemoveEventListener?.call(this, type, listener, options);
  }

  const restoreAdd = replaceProperty(windowRef, 'addEventListener', patchedAddEventListener);
  const restoreRemove = replaceProperty(windowRef, 'removeEventListener', patchedRemoveEventListener);

  const originalMotionEvent = environment.DeviceMotionEvent || windowRef?.DeviceMotionEvent;
  const bridgedMotionEvent = createBridgedMotionEvent(
    originalMotionEvent,
    async () => {
      launchPending = true;
      try {
        await motion.requestPermission();
        // The canonical platform port returns true or throws, while TURN's current
        // browser launch path still consumes the DeviceMotionEvent API contract.
        return 'granted';
      } catch (error) {
        launchPending = false;
        throw error;
      }
    }
  );
  const restoreEnvironmentMotion = replaceProperty(environment, 'DeviceMotionEvent', bridgedMotionEvent);
  const restoreWindowMotion = windowRef !== environment
    ? replaceProperty(windowRef, 'DeviceMotionEvent', bridgedMotionEvent)
    : () => {};

  const intro = documentRef?.querySelector?.('#intro');
  const manualButton = documentRef?.querySelector?.('#manualButton');

  const cancelPendingLaunch = () => {
    launchPending = false;
    stopSubscription();
  };

  const onUiStateChange = (event) => {
    if (event?.detail?.reason === 'race-started') launchPending = false;
  };
  const onManualLaunch = () => cancelPendingLaunch();

  originalAddEventListener.call(windowRef, 'turn:ui-state-change', onUiStateChange);
  manualButton?.addEventListener?.('click', onManualLaunch, { capture: true });

  const Observer = environment.MutationObserver || windowRef?.MutationObserver;
  const introObserver = intro && typeof Observer === 'function'
    ? new Observer(() => {
      if (launchPending && !intro.hidden) cancelPendingLaunch();
    })
    : null;
  introObserver?.observe(intro, { attributes: true, attributeFilter: ['hidden'] });

  function uninstall() {
    if (disposed) return false;
    disposed = true;
    cancelPendingLaunch();
    introObserver?.disconnect();
    manualButton?.removeEventListener?.('click', onManualLaunch, { capture: true });
    originalRemoveEventListener?.call(windowRef, 'turn:ui-state-change', onUiStateChange);
    restoreWindowMotion();
    restoreEnvironmentMotion();
    restoreRemove();
    restoreAdd();
    return true;
  }

  return Object.freeze({
    route: 'platform',
    isAvailable: () => motion.isAvailable(),
    isSubscribed: () => releaseSubscription !== null,
    stop: stopSubscription,
    uninstall
  });
}
