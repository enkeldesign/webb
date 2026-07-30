function requireDisplayPort(platform) {
  const display = platform?.display;
  for (const method of ['requestFullscreen', 'lockLandscape']) {
    if (typeof display?.[method] !== 'function') {
      throw new TypeError(`TURN Platform M6 requires display.${method}().`);
    }
  }
  return display;
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

export function installDisplayLifecycleBridge({
  platform,
  environment = globalThis
} = {}) {
  const display = requireDisplayPort(platform);
  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef?.document;
  const screenRef = environment.screen || windowRef?.screen;
  const root = documentRef?.documentElement;
  const orientation = screenRef?.orientation;
  const originalOrientationLock = orientation?.lock;

  let fullscreenPending = null;
  let landscapePending = null;
  let disposed = false;
  let fullscreenAttempts = 0;
  let landscapeAttempts = 0;

  function isFullscreen() {
    return Boolean(documentRef?.fullscreenElement || documentRef?.webkitFullscreenElement);
  }

  function requestFullscreenThroughPlatform() {
    if (isFullscreen()) return Promise.resolve();
    if (fullscreenPending) return fullscreenPending;

    fullscreenAttempts += 1;
    fullscreenPending = Promise.resolve(display.requestFullscreen(root))
      .then((entered) => {
        if (!entered && !isFullscreen()) {
          throw new Error('Fullscreen was not available.');
        }
      })
      .finally(() => {
        fullscreenPending = null;
      });
    return fullscreenPending;
  }

  function lockOrientationThroughPlatform(value = 'landscape') {
    const requested = String(value || 'landscape').toLowerCase();
    if (!requested.startsWith('landscape')) {
      if (typeof originalOrientationLock !== 'function') {
        return Promise.reject(new Error(`Screen orientation ${value} is not available.`));
      }
      return Promise.resolve(originalOrientationLock.call(orientation, value));
    }
    if (landscapePending) return landscapePending;

    landscapeAttempts += 1;
    landscapePending = Promise.resolve(display.lockLandscape())
      .then((locked) => {
        if (!locked) throw new Error('Landscape orientation lock was not available.');
      })
      .finally(() => {
        landscapePending = null;
      });
    return landscapePending;
  }

  const restoreFullscreen = replaceProperty(root, 'requestFullscreen', requestFullscreenThroughPlatform);
  const restoreWebkitFullscreen = replaceProperty(root, 'webkitRequestFullscreen', requestFullscreenThroughPlatform);
  const restoreOrientationLock = orientation
    ? replaceProperty(orientation, 'lock', lockOrientationThroughPlatform)
    : () => {};

  function uninstall() {
    if (disposed) return false;
    disposed = true;
    restoreOrientationLock();
    restoreWebkitFullscreen();
    restoreFullscreen();
    return true;
  }

  return Object.freeze({
    route: 'platform',
    isFullscreenPending: () => fullscreenPending !== null,
    isLandscapePending: () => landscapePending !== null,
    getFullscreenAttempts: () => fullscreenAttempts,
    getLandscapeAttempts: () => landscapeAttempts,
    uninstall
  });
}
