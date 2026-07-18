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

  const SENSOR_OFFSETS = [0, 90, -90];
  const SENSOR_CALIBRATION_SAMPLES = 8;
  const sensorScores = new Array(SENSOR_OFFSETS.length).fill(0);
  let sensorSamples = 0;
  let sensorOffset = 0;
  let sensorOffsetLocked = false;
  let lastBaseAngle = null;

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

  function resolveBaseAngle(screenAngle) {
    const normalizedScreenAngle = normalizeDegrees(screenAngle);
    const viewportLandscape = viewportIsLandscape();
    const screenMatchesViewport = angleIsLandscape(normalizedScreenAngle) === viewportLandscape;

    // Preserve the working iPhone path whenever the Screen Orientation API agrees with
    // the actual viewport.
    if (normalizedScreenAngle != null && screenMatchesViewport) return normalizedScreenAngle;

    // Older standalone iPads can report a portrait-like Screen Orientation angle while
    // already rendering a landscape viewport. Prefer the legacy value only when it fixes
    // that mismatch.
    const legacyAngle = normalizeDegrees(Number(window.orientation));
    const legacyMatchesViewport = angleIsLandscape(legacyAngle) === viewportLandscape;
    if (legacyAngle != null && legacyMatchesViewport) return legacyAngle;

    return normalizedScreenAngle ?? legacyAngle ?? 0;
  }

  function foldedRollForAngle(gravity, angleDegrees) {
    const angle = angleDegrees * Math.PI / 180;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const screenX = gravity.x * cos + gravity.y * sin;
    const screenY = -gravity.x * sin + gravity.y * cos;
    let roll = Math.atan2(screenX, -screenY);

    while (roll > Math.PI) roll -= Math.PI * 2;
    while (roll < -Math.PI) roll += Math.PI * 2;
    if (roll > Math.PI / 2) roll -= Math.PI;
    if (roll < -Math.PI / 2) roll += Math.PI;
    return roll;
  }

  function resetSensorCalibration() {
    sensorScores.fill(0);
    sensorSamples = 0;
    sensorOffset = 0;
    sensorOffsetLocked = false;
    lastBaseAngle = null;
  }

  function observeMotion(event) {
    if (sensorOffsetLocked) return;

    const gravity = event.accelerationIncludingGravity;
    if (!gravity || gravity.x == null || gravity.y == null) return;
    if (Math.hypot(gravity.x, gravity.y) < 0.8) return;

    const baseAngle = resolveBaseAngle(readBrowserAngle());
    if (lastBaseAngle != null && Math.abs(normalizeDegrees(baseAngle - lastBaseAngle) || 0) >= 90) {
      resetSensorCalibration();
    }
    lastBaseAngle = baseAngle;

    for (let index = 0; index < SENSOR_OFFSETS.length; index += 1) {
      const candidateAngle = baseAngle + SENSOR_OFFSETS[index];
      sensorScores[index] += Math.abs(foldedRollForAngle(gravity, candidateAngle));
    }

    sensorSamples += 1;
    let bestIndex = 0;
    for (let index = 1; index < sensorScores.length; index += 1) {
      if (sensorScores[index] < sensorScores[bestIndex]) bestIndex = index;
    }
    sensorOffset = SENSOR_OFFSETS[bestIndex];

    if (sensorSamples >= SENSOR_CALIBRATION_SAMPLES) {
      sensorOffsetLocked = true;
      console.info(`TURN: motion axis mapping locked at ${sensorOffset >= 0 ? '+' : ''}${sensorOffset}°.`);
    }
  }

  function resolvedAngle() {
    const baseAngle = resolveBaseAngle(readBrowserAngle());
    return normalizeDegrees(baseAngle + sensorOffset) ?? 0;
  }

  // Register before the game adds its own devicemotion listener. Each sensor event can
  // therefore update the mapping before TURN reads screen.orientation.angle for that frame.
  window.addEventListener('devicemotion', observeMotion, { passive: true });
  window.addEventListener('orientationchange', resetSensorCalibration, { passive: true });
  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#motionButton')) resetSensorCalibration();
  });

  let installed = false;

  // Prefer shadowing only this ScreenOrientation instance so the compatibility correction
  // stays local to TURN.
  try {
    Object.defineProperty(orientation, 'angle', {
      configurable: true,
      enumerable: ownAngleDescriptor?.enumerable ?? prototypeAngleDescriptor?.enumerable ?? true,
      get() {
        return resolvedAngle();
      }
    });
    installed = true;
  } catch (_) {}

  // Fallback for WebKit versions that disallow an own property on ScreenOrientation.
  if (!installed && prototypeAngleDescriptor?.get && prototypeAngleDescriptor.configurable !== false) {
    try {
      Object.defineProperty(prototype, 'angle', {
        ...prototypeAngleDescriptor,
        get() {
          if (this !== screen.orientation) return prototypeAngleDescriptor.get.call(this);
          return resolvedAngle();
        }
      });
      installed = true;
    } catch (_) {}
  }

  console.info(
    installed
      ? 'TURN: adaptive motion-axis compatibility enabled.'
      : 'TURN: ScreenOrientation angle could not be shimmed; using browser values as-is.'
  );
})();