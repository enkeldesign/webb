(() => {
  const SESSION_KEY = '__turnNextRaceSession';
  const LANDSCAPE_QUIET_MS = 180;
  const LANDSCAPE_SETTLE_TIMEOUT_MS = 1200;
  const MIN_VALID_MOTION_SAMPLES = 10;
  const STABLE_AXIS_SAMPLES = 8;
  const MOTION_SAMPLE_TIMEOUT_MS = 1400;
  const AXIS_STABILITY_EPSILON_DEGREES = 0.5;

  const diagnostics = {
    installed: false,
    wrapped: false,
    runs: 0,
    lastStage: 'boot',
    validSamples: 0,
    stableAxisSamples: 0,
    resolvedAngle: null,
    landscapeQuietTimedOut: false,
    motionSamplesTimedOut: false,
    centeredTargetRoll: null
  };
  globalThis.__yourTurnMotionStartDiagnostics = diagnostics;

  let storedSession = null;
  let firstMotionStartPending = true;

  function now() {
    return globalThis.performance?.now?.() ?? Date.now();
  }

  function normalizeDegrees(value) {
    let degrees = Number(value);
    if (!Number.isFinite(degrees)) return null;
    degrees = ((degrees % 360) + 360) % 360;
    if (degrees > 180) degrees -= 360;
    return degrees;
  }

  function shortestDegreeDelta(from, to) {
    const a = normalizeDegrees(from);
    const b = normalizeDegrees(to);
    if (a == null || b == null) return Infinity;
    let delta = b - a;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;
    return delta;
  }

  function isLandscape() {
    const visual = globalThis.visualViewport;
    const width = Number(visual?.width) || Number(globalThis.innerWidth) || 0;
    const height = Number(visual?.height) || Number(globalThis.innerHeight) || 0;
    if (width && height) return width > height;
    return globalThis.matchMedia?.('(orientation: landscape)')?.matches === true;
  }

  function resolvedOrientationAngle() {
    const screenAngle = normalizeDegrees(globalThis.screen?.orientation?.angle);
    if (screenAngle != null) return screenAngle;
    return normalizeDegrees(globalThis.orientation) ?? 0;
  }

  function waitForQuietLandscape() {
    return new Promise((resolve) => {
      const startedAt = now();
      let lastChangeAt = startedAt;
      let frame = 0;
      let finished = false;

      const markChange = () => {
        lastChangeAt = now();
      };

      const cleanup = () => {
        if (finished) return;
        finished = true;
        globalThis.cancelAnimationFrame?.(frame);
        globalThis.removeEventListener?.('resize', markChange);
        globalThis.removeEventListener?.('orientationchange', markChange);
        globalThis.screen?.orientation?.removeEventListener?.('change', markChange);
        globalThis.visualViewport?.removeEventListener?.('resize', markChange);
      };

      const finish = (timedOut) => {
        diagnostics.landscapeQuietTimedOut = Boolean(timedOut);
        cleanup();
        resolve();
      };

      const check = () => {
        const current = now();
        if (isLandscape() && current - lastChangeAt >= LANDSCAPE_QUIET_MS) {
          finish(false);
          return;
        }
        if (current - startedAt >= LANDSCAPE_SETTLE_TIMEOUT_MS) {
          finish(true);
          return;
        }
        frame = globalThis.requestAnimationFrame?.(check)
          ?? globalThis.setTimeout?.(check, 16)
          ?? 0;
      };

      globalThis.addEventListener?.('resize', markChange, { passive: true });
      globalThis.addEventListener?.('orientationchange', markChange, { passive: true });
      globalThis.screen?.orientation?.addEventListener?.('change', markChange, { passive: true });
      globalThis.visualViewport?.addEventListener?.('resize', markChange, { passive: true });
      check();
    });
  }

  function waitForStableLandscapeMotion() {
    return new Promise((resolve) => {
      let validSamples = 0;
      let stableSamples = 0;
      let lastAngle = null;
      let finished = false;
      let timer = 0;

      const finish = (timedOut) => {
        if (finished) return;
        finished = true;
        globalThis.removeEventListener?.('devicemotion', onMotion);
        globalThis.clearTimeout?.(timer);
        diagnostics.validSamples = validSamples;
        diagnostics.stableAxisSamples = stableSamples;
        diagnostics.resolvedAngle = lastAngle;
        diagnostics.motionSamplesTimedOut = Boolean(timedOut);
        resolve();
      };

      const onMotion = (event) => {
        const gravity = event?.accelerationIncludingGravity;
        if (!gravity || gravity.x == null || gravity.y == null || gravity.z == null) return;
        if (!isLandscape()) return;

        const angle = resolvedOrientationAngle();
        validSamples += 1;
        if (
          lastAngle != null
          && Math.abs(shortestDegreeDelta(lastAngle, angle)) <= AXIS_STABILITY_EPSILON_DEGREES
        ) {
          stableSamples += 1;
        } else {
          stableSamples = 1;
        }
        lastAngle = angle;

        if (
          validSamples >= MIN_VALID_MOTION_SAMPLES
          && stableSamples >= STABLE_AXIS_SAMPLES
        ) {
          finish(false);
        }
      };

      globalThis.addEventListener?.('devicemotion', onMotion, { passive: true });
      timer = globalThis.setTimeout?.(() => finish(true), MOTION_SAMPLE_TIMEOUT_MS) || 0;
    });
  }

  function centerRuntimeMotionState() {
    const state = globalThis.__turnRuntime?.state;
    if (!state?.sensorMode) return false;

    state.neutralRoll = state.targetRoll;
    state.horizonRollReference = state.targetRoll;
    state.roll = state.targetRoll;
    state.neutralPitch = state.targetPitch;
    state.pitch = state.targetPitch;
    state.steering = 0;
    state.steeringEngaged = false;
    state.tiltDrive = 0;
    diagnostics.centeredTargetRoll = Number(state.targetRoll) || 0;
    return true;
  }

  async function stabilizeBeforeFirstMotionStart() {
    const state = globalThis.__turnRuntime?.state;
    if (!firstMotionStartPending || !state?.sensorMode) return;

    diagnostics.runs += 1;
    diagnostics.lastStage = 'waiting-for-landscape';
    await waitForQuietLandscape();

    diagnostics.lastStage = 'waiting-for-stable-axis';
    await waitForStableLandscapeMotion();

    diagnostics.lastStage = 'centering';
    centerRuntimeMotionState();
    firstMotionStartPending = false;
    diagnostics.lastStage = 'ready-to-lock-gameplay-angle';
  }

  function wrapRaceSession(session) {
    if (!session || typeof session.startGame !== 'function') return session;
    if (session.__yourTurnMotionStartGuard === true) return session;

    const wrapped = {
      ...session,
      async startGame(...args) {
        await stabilizeBeforeFirstMotionStart();
        return session.startGame(...args);
      },
      __yourTurnMotionStartGuard: true
    };
    diagnostics.wrapped = true;
    return Object.freeze(wrapped);
  }

  const existingDescriptor = Object.getOwnPropertyDescriptor(globalThis, SESSION_KEY);
  if (existingDescriptor && existingDescriptor.configurable === false) {
    diagnostics.lastStage = 'could-not-install';
    return;
  }

  Object.defineProperty(globalThis, SESSION_KEY, {
    configurable: true,
    enumerable: existingDescriptor?.enumerable ?? false,
    get() {
      return storedSession;
    },
    set(value) {
      storedSession = wrapRaceSession(value);
    }
  });

  if (existingDescriptor?.get) {
    try {
      storedSession = wrapRaceSession(existingDescriptor.get.call(globalThis));
    } catch (_) {}
  } else if (existingDescriptor && 'value' in existingDescriptor) {
    storedSession = wrapRaceSession(existingDescriptor.value);
  }

  diagnostics.installed = true;
  diagnostics.lastStage = 'installed';
})();
