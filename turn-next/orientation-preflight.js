(() => {
  const windowRef = globalThis.window || globalThis;
  const screenRef = globalThis.screen || windowRef.screen;
  const orientation = screenRef?.orientation;
  const prototype = orientation && Object.getPrototypeOf(orientation);
  const ownAngleDescriptor = orientation && Object.getOwnPropertyDescriptor(orientation, 'angle');
  const prototypeAngleDescriptor = prototype && Object.getOwnPropertyDescriptor(prototype, 'angle');

  let readNativeAngle = null;
  if (ownAngleDescriptor?.get) {
    readNativeAngle = () => ownAngleDescriptor.get.call(orientation);
  } else if (ownAngleDescriptor && 'value' in ownAngleDescriptor) {
    readNativeAngle = () => ownAngleDescriptor.value;
  } else if (prototypeAngleDescriptor?.get) {
    readNativeAngle = () => prototypeAngleDescriptor.get.call(orientation);
  }

  function getAngleDegrees() {
    const screenAngle = Number(readNativeAngle?.());
    if (Number.isFinite(screenAngle)) return screenAngle;

    const legacyAngle = Number(windowRef.orientation);
    return Number.isFinite(legacyAngle) ? legacyAngle : 0;
  }

  function getViewportSize() {
    const viewport = windowRef.visualViewport;
    const root = windowRef.document?.documentElement;
    const width = Math.max(
      Number(viewport?.width) || 0,
      Number(windowRef.innerWidth) || 0,
      Number(root?.clientWidth) || 0,
      1
    );
    const height = Math.max(
      Number(viewport?.height) || 0,
      Number(windowRef.innerHeight) || 0,
      Number(root?.clientHeight) || 0,
      1
    );

    return Object.freeze({
      width: Math.round(width),
      height: Math.round(height)
    });
  }

  globalThis.__TURN_NEXT_ORIENTATION_PREFLIGHT__ = Object.freeze({
    getAngleDegrees,
    getViewportSize
  });
})();
