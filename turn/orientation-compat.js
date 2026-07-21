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
  const STEERING_LIMIT_NEAR = 13 * Math.PI / 180;
  const STEERING_LIMIT_HARD = 17 * Math.PI / 180;
  const STEERING_LIMIT_CLEAR = 10.5 * Math.PI / 180;
  const sensorScores = new Array(SENSOR_OFFSETS.length).fill(0);
  let sensorSamples = 0;
  let sensorOffset = 0;
  let sensorOffsetLocked = false;
  let lastBaseAngle = null;
  let gameplayActive = false;
  let gameplayAngle = null;
  let preferredLandscapeLock = 'landscape';
  let lastResolvedRoll = 0;
  let steeringNeutralRoll = 0;
  let steeringLimitLevel = 0;
  let lockUnsupportedReported = false;

  function normalizeDegrees(value) {
    if (!Number.isFinite(value)) return null;
    let degrees = ((value % 360) + 360) % 360;
    if (degrees > 180) degrees -= 360;
    return degrees;
  }

  function normalizeRadians(value) {
    let angle = Number(value) || 0;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
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

  function computedAngle() {
    const baseAngle = resolveBaseAngle(readBrowserAngle());
    return normalizeDegrees(baseAngle + sensorOffset) ?? 0;
  }

  function resolvedAngle() {
    return gameplayActive && gameplayAngle != null ? gameplayAngle : computedAngle();
  }

  function clearSteeringLimitFeedback() {
    steeringLimitLevel = 0;
    document.body.classList.remove('turn-steering-limit-near', 'turn-steering-limit-hard');
  }

  function pulseHaptic(pattern) {
    try {
      navigator.vibrate?.(pattern);
    } catch (_) {}
  }

  function updateSteeringLimitFeedback(roll) {
    if (!gameplayActive) {
      clearSteeringLimitFeedback();
      return;
    }

    const magnitude = Math.abs(normalizeRadians(roll - steeringNeutralRoll));
    let nextLevel = steeringLimitLevel;

    if (magnitude >= STEERING_LIMIT_HARD) nextLevel = 2;
    else if (magnitude >= STEERING_LIMIT_NEAR) nextLevel = Math.max(1, nextLevel);
    else if (magnitude <= STEERING_LIMIT_CLEAR) nextLevel = 0;
    else if (steeringLimitLevel === 2 && magnitude < STEERING_LIMIT_NEAR) nextLevel = 1;

    if (nextLevel > steeringLimitLevel) {
      pulseHaptic(nextLevel === 2 ? [18, 26, 28] : 12);
    }

    steeringLimitLevel = nextLevel;
    document.body.classList.toggle('turn-steering-limit-near', nextLevel >= 1);
    document.body.classList.toggle('turn-steering-limit-hard', nextLevel >= 2);
  }

  function currentLandscapeLockType() {
    const type = String(orientation.type || '');
    if (type === 'landscape-primary' || type === 'landscape-secondary') return type;
    return 'landscape';
  }

  async function tryOrientationLock(type) {
    if (typeof orientation.lock !== 'function') {
      if (!lockUnsupportedReported) {
        lockUnsupportedReported = true;
        console.info('TURN: OS orientation lock is not exposed by this WebKit build; using the in-game guard only.');
      }
      return false;
    }

    try {
      await orientation.lock(type);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function requestLandscapeLock() {
    // Prefer the broad landscape lock so both physical turning directions remain valid.
    // Some WebKit builds behave asymmetrically when pinned to an exact landscape side.
    if (await tryOrientationLock('landscape')) return true;

    const exactType = preferredLandscapeLock === 'landscape'
      ? currentLandscapeLockType()
      : preferredLandscapeLock;
    return exactType !== 'landscape' ? tryOrientationLock(exactType) : false;
  }

  globalThis.__turnRequestLandscapeLock = requestLandscapeLock;

  function setGameplayActive(active) {
    const nextActive = Boolean(active);
    if (nextActive === gameplayActive) return;

    gameplayActive = nextActive;
    document.body.classList.toggle('turn-race-active', gameplayActive);

    if (gameplayActive) {
      preferredLandscapeLock = currentLandscapeLockType();
      gameplayAngle = computedAngle();
      steeringNeutralRoll = lastResolvedRoll;
      clearSteeringLimitFeedback();
      void requestLandscapeLock();
      console.info(`TURN: race orientation guard locked at ${gameplayAngle}° (${preferredLandscapeLock}).`);
    } else {
      gameplayAngle = null;
      preferredLandscapeLock = 'landscape';
      clearSteeringLimitFeedback();
    }
  }

  function observeMotion(event) {
    const gravity = event.accelerationIncludingGravity;
    if (!gravity || gravity.x == null || gravity.y == null) return;
    if (Math.hypot(gravity.x, gravity.y) < 0.8) return;

    const baseAngle = resolveBaseAngle(readBrowserAngle());

    if (!sensorOffsetLocked) {
      if (
        !gameplayActive &&
        lastBaseAngle != null &&
        Math.abs(normalizeDegrees(baseAngle - lastBaseAngle) || 0) >= 90
      ) {
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

    lastResolvedRoll = foldedRollForAngle(gravity, resolvedAngle());
    updateSteeringLimitFeedback(lastResolvedRoll);
  }

  function retryGameplayLock() {
    if (gameplayActive) void requestLandscapeLock();
  }

  // Register before the game adds its own devicemotion listener. Each sensor event can
  // therefore update the mapping before TURN reads screen.orientation.angle for that frame.
  window.addEventListener('devicemotion', observeMotion, { passive: true });
  window.addEventListener('orientationchange', () => {
    if (gameplayActive) {
      void requestLandscapeLock();
      return;
    }
    resetSensorCalibration();
  }, { passive: true });
  orientation.addEventListener?.('change', retryGameplayLock, { passive: true });
  window.addEventListener('pageshow', retryGameplayLock, { passive: true });
  document.addEventListener('fullscreenchange', retryGameplayLock, { passive: true });
  document.addEventListener('webkitfullscreenchange', retryGameplayLock, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) retryGameplayLock();
  }, { passive: true });

  window.addEventListener('turn:ui-state-change', (event) => {
    setGameplayActive(Boolean(event.detail?.running));
  });

  // Safari may only accept an orientation request while processing a user interaction.
  // Ask on actual game-start gestures, but do not re-lock on every GAS/DRIFT/BOOST touch.
  document.addEventListener('pointerdown', (event) => {
    const startsGame = event.target.closest?.('#motionButton, #manualButton, .lot-race');
    if (startsGame) void requestLandscapeLock();
  }, { passive: true, capture: true });

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('#motionButton')) resetSensorCalibration();
    if (event.target.closest?.('#calibrateButton') && gameplayActive) {
      steeringNeutralRoll = lastResolvedRoll;
      clearSteeringLimitFeedback();
    }
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
      ? 'TURN: adaptive motion-axis compatibility and race orientation guard enabled.'
      : 'TURN: ScreenOrientation angle could not be shimmed; using browser values as-is.'
  );
})();
