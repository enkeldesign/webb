(() => {
  const orientation = screen.orientation;
  if (!orientation) return;

  const prototype = Object.getPrototypeOf(orientation);
  const angleDescriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'angle');
  const nativeAngleGetter = angleDescriptor?.get;

  if (!nativeAngleGetter || angleDescriptor.configurable === false) {
    console.info('TURN: ScreenOrientation angle could not be shimmed; using browser values as-is.');
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
    const screenMatchesViewport = angleIsLandscape(normalizedScreenAngle) === viewportIsLandscape();

    // Keep the normal Screen Orientation API path untouched when it agrees with the
    // actual viewport. This is the path used by iPhone 16 and other working devices.
    if (normalizedScreenAngle != null && screenMatchesViewport) return normalizedScreenAngle;

    // Some standalone iPad web apps can expose a portrait-like screen angle while their
    // viewport is already landscape. WebKit's legacy orientation value still reflects the
    // physical quarter-turn in that case, so use it only when it resolves the mismatch.
    const legacyAngle = normalizeDegrees(Number(window.orientation));
    const legacyMatchesViewport = angleIsLandscape(legacyAngle) === viewportIsLandscape();
    if (legacyAngle != null && legacyMatchesViewport) {
      return legacyAngle;
    }

    // Last resort: preserve the browser-provided value rather than guessing which
    // landscape side the player is holding the device on.
    return normalizedScreenAngle ?? 0;
  }

  Object.defineProperty(prototype, 'angle', {
    ...angleDescriptor,
    get() {
      const browserAngle = nativeAngleGetter.call(this);
      return this === screen.orientation ? resolvedAngle(browserAngle) : browserAngle;
    }
  });

  console.info('TURN: adaptive screen-orientation compatibility enabled.');
})();
