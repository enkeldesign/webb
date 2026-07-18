(() => {
  const orientation = screen.orientation;
  if (!orientation) return;

  const prototype = Object.getPrototypeOf(orientation);
  const ownAngleDescriptor = Object.getOwnPropertyDescriptor(orientation, 'angle');
  const prototypeAngleDescriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'angle');

  let readBrowserAngle = null;
  if (ownAngleDescriptor?.get) {
    readBrowserAngle = () => ownAngleDescriptor.get.call(orientation);
  } else if (ownAngleDescriptor && 'value' in ownAngleDescriptor) {
    readBrowserAngle = () => ownAngleDescriptor.value;
  } else if (prototypeAngleDescriptor?.get) {
    readBrowserAngle = () => prototypeAngleDescriptor.get.call(orientation);
  }

  if (!readBrowserAngle) {
    console.info('TURN: no readable ScreenOrientation angle; using browser values as-is.');
    return;
  }

  function normalizeDegrees(value) {
    if (!Number.isFinite(value)) return null;
    let degrees = ((value % 360) + 360) % 360;
    if (degrees > 180) degrees -= 360;
    return degrees;
  }

  function angleIsLandscape(value) {
    const degrees = normalizeDegrees(value);
    if (degrees == null) return null;
    return Math.abs(degrees) === 90;
  }

  function viewportIsLandscape() {
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth || document.documentElement.clientWidth;
    const height = viewport?.height || window.innerHeight || document.documentElement.clientHeight;
    return width > height;
  }

  function resolvedAngle(screenAngle) {
    const normalizedScreenAngle = normalizeDegrees(screenAngle);
    const viewportLandscape = viewportIsLandscape();
    const screenMatchesViewport = angleIsLandscape(normalizedScreenAngle) === viewportLandscape;

    // Preserve the normal Screen Orientation API path when it agrees with the actual
    // viewport. This keeps the existing iPhone 16 behaviour unchanged.
    if (normalizedScreenAngle != null && screenMatchesViewport) return normalizedScreenAngle;

    // Some standalone iPad web apps expose a portrait-like screen angle while their
    // viewport is already landscape. WebKit's legacy orientation value can still reflect
    // the physical quarter-turn, so use it only when it actually resolves that mismatch.
    const legacyAngle = normalizeDegrees(Number(window.orientation));
    const legacyMatchesViewport = angleIsLandscape(legacyAngle) === viewportLandscape;
    if (legacyAngle != null && legacyMatchesViewport) return legacyAngle;

    // Last resort: keep the browser-provided angle rather than guessing which landscape
    // side the player is holding the device on.
    return normalizedScreenAngle ?? 0;
  }

  let installed = false;

  // Prefer shadowing only this ScreenOrientation instance. That leaves the browser API
  // untouched for everything else and works even when the prototype property is locked.
  try {
    Object.defineProperty(orientation, 'angle', {
      configurable: true,
      enumerable: ownAngleDescriptor?.enumerable ?? prototypeAngleDescriptor?.enumerable ?? true,
      get() {
        return resolvedAngle(readBrowserAngle());
      }
    });
    installed = true;
  } catch (_) {}

  // Fallback for engines that do not allow an own property on ScreenOrientation.
  if (!installed && prototypeAngleDescriptor?.get && prototypeAngleDescriptor.configurable !== false) {
    try {
      Object.defineProperty(prototype, 'angle', {
        ...prototypeAngleDescriptor,
        get() {
          const browserAngle = prototypeAngleDescriptor.get.call(this);
          return this === screen.orientation ? resolvedAngle(browserAngle) : browserAngle;
        }
      });
      installed = true;
    } catch (_) {}
  }

  console.info(
    installed
      ? 'TURN: adaptive screen-orientation compatibility enabled.'
      : 'TURN: ScreenOrientation angle could not be shimmed; using browser values as-is.'
  );
})();
