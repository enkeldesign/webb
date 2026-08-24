(() => {
  const root = document.documentElement;
  if (root.dataset.turnDeployment !== 'lab') return;

  const PORTRAIT_STEERING_DEGREES = 24;
  const PORTRAIT_HORIZON_DEGREES = 16;
  const PORTRAIT_CAMERA_ZOOM = 0.78;
  const SETTLE_DELAYS_MS = Object.freeze([0, 120, 420, 900]);
  const orientationMedia = window.matchMedia('(orientation: portrait)');

  root.classList.add('turn-lab-portrait');
  root.dataset.turnLabPortrait = 'r1';

  function portraitActive() {
    return orientationMedia.matches;
  }

  function publishMotionProfile() {
    const current = globalThis.__TURN_MOTION_SAFE_ZONE__ || {};
    globalThis.__TURN_MOTION_SAFE_ZONE__ = Object.freeze({
      ...current,
      degrees: PORTRAIT_STEERING_DEGREES,
      steeringDegrees: PORTRAIT_STEERING_DEGREES,
      horizonDegrees: portraitActive()
        ? PORTRAIT_HORIZON_DEGREES
        : PORTRAIT_STEERING_DEGREES,
      feedbackNearDegrees: 19,
      feedbackHardDegrees: PORTRAIT_STEERING_DEGREES,
      feedbackHardRearmDegrees: 22,
      feedbackClearDegrees: 17.5,
      directionalFeedback: true
    });
    root.dataset.turnMotionSafeZone = String(PORTRAIT_STEERING_DEGREES);
    root.dataset.turnLabHorizon = String(
      portraitActive() ? PORTRAIT_HORIZON_DEGREES : PORTRAIT_STEERING_DEGREES
    );
  }

  function keepPortraitWhenTheRaceRequestsLandscape() {
    const orientation = screen.orientation;
    if (!orientation) return;

    const nativeLock = typeof orientation.lock === 'function'
      ? orientation.lock.bind(orientation)
      : null;
    const labLock = (requested = 'landscape') => {
      const type = String(requested || '').toLowerCase();
      if (portraitActive() && type.startsWith('landscape')) {
        console.info('TURN LAB: kept portrait play active instead of applying the production landscape lock.');
        return Promise.resolve();
      }
      return nativeLock ? nativeLock(requested) : Promise.resolve();
    };

    try {
      Object.defineProperty(orientation, 'lock', {
        configurable: true,
        enumerable: false,
        writable: true,
        value: labLock
      });
    } catch (_) {
      try {
        orientation.lock = labLock;
      } catch (_) {}
    }
  }

  function installPortraitLanguagePatches() {
    if (typeof MutationObserver !== 'function') return;
    const readyReplacement = 'TURN LAB is ready. Portrait play is available. Choose a track, then choose a car.';
    let readyPatched = false;
    let guidePatched = false;
    let observer = null;
    let stopTimer = 0;

    function patch() {
      if (!portraitActive()) return;

      const status = document.querySelector('#turn-screen-reader-status');
      if (
        status
        && /^TURN is ready\. Rotate your device to landscape\.?$/i.test(String(status.textContent || '').trim())
      ) {
        status.textContent = readyReplacement;
        readyPatched = true;
      }

      for (const paragraph of document.querySelectorAll('.m8-how-dialog .m8-guide-grid p')) {
        const text = String(paragraph.textContent || '').trim();
        if (!text.startsWith('Hold the phone or tablet in landscape')) continue;
        paragraph.textContent = 'Hold the phone or tablet in portrait or landscape and rotate it like a steering wheel. Recalibrate at the start line whenever your resting angle changes.';
        guidePatched = true;
      }

      if (readyPatched && guidePatched) {
        observer?.disconnect();
        window.clearTimeout(stopTimer);
      }
    }

    function start() {
      if (!document.body || observer) return;
      observer = new MutationObserver(patch);
      observer.observe(document.body, { childList: true, characterData: true, subtree: true });
      patch();
      stopTimer = window.setTimeout(() => observer?.disconnect(), 8000);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }

  function normalizedAngle(value) {
    let angle = Number(value) || 0;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function createSteeringMeter() {
    const existing = document.querySelector('.turn-lab-portrait-meter');
    if (existing) return existing;
    const hud = document.querySelector('#hud');
    if (!hud) return null;

    const meter = document.createElement('div');
    meter.className = 'turn-lab-portrait-meter';
    meter.hidden = true;
    meter.setAttribute('aria-hidden', 'true');
    meter.innerHTML = `
      <div class="turn-lab-portrait-meter-head">
        <span>STEERING</span><strong>±${PORTRAIT_STEERING_DEGREES}°</strong>
      </div>
      <div class="turn-lab-portrait-meter-track">
        <i class="turn-lab-portrait-meter-dead"></i>
        <b class="turn-lab-portrait-meter-needle"></b>
      </div>
      <output class="turn-lab-portrait-meter-value">CENTER · 0.0° · 0%</output>`;
    hud.appendChild(meter);
    return meter;
  }

  function installRuntime(runtime) {
    if (!runtime?.renderer || !runtime?.camera || runtime.__turnLabPortraitPlayInstalled) return;
    runtime.__turnLabPortraitPlayInstalled = true;

    const game = document.querySelector('#game');
    const renderer = runtime.renderer;
    const camera = runtime.camera;
    const canvas = renderer.domElement;
    const previousSetSize = renderer.setSize.bind(renderer);
    const meter = createSteeringMeter();
    const meterValue = meter?.querySelector('.turn-lab-portrait-meter-value');
    let meterFrame = 0;
    let settleTimers = [];

    function portraitGameSize() {
      const rect = game?.getBoundingClientRect();
      return {
        width: Math.max(1, Math.round(Number(rect?.width) || window.innerWidth || 1)),
        height: Math.max(1, Math.round(Number(rect?.height) || window.innerHeight || 1))
      };
    }

    function applyProjection(width, height, portrait) {
      camera.aspect = Math.max(1, width) / Math.max(1, height);
      camera.zoom = portrait ? PORTRAIT_CAMERA_ZOOM : 1;
      camera.updateProjectionMatrix();
    }

    function applyGameViewport() {
      const size = portraitGameSize();
      applyProjection(size.width, size.height, portraitActive());
      const result = previousSetSize(size.width, size.height, false);
      canvas.style.setProperty('width', '100%', 'important');
      canvas.style.setProperty('height', '100%', 'important');
      return result;
    }

    renderer.setSize = function usePortraitGameViewport(width, height, updateStyle = true) {
      // Production temporarily resizes the shared renderer for garage and
      // achievement thumbnails. Only redirect normal viewport resizes; keep
      // explicit off-screen sizes (updateStyle === false) intact.
      if (!portraitActive() || updateStyle === false) {
        return previousSetSize(width, height, updateStyle);
      }
      return applyGameViewport();
    };

    function syncViewport() {
      applyGameViewport();
      root.classList.toggle('turn-lab-portrait-active', portraitActive());
    }

    function settleViewport() {
      for (const timer of settleTimers) window.clearTimeout(timer);
      settleTimers = SETTLE_DELAYS_MS.map((delay) => window.setTimeout(syncViewport, delay));
    }

    function updateMeter() {
      const active = portraitActive()
        && runtime.state?.running === true
        && runtime.state?.sensorMode === true
        && !document.hidden;

      if (meter) meter.hidden = !active;
      if (active && meter && meterValue) {
        const relativeRoll = normalizedAngle(
          (Number(runtime.state.roll) || 0) - (Number(runtime.state.neutralRoll) || 0)
        );
        // TURN's vehicle yaw uses the opposite sign; roll itself is already in
        // normalized screen space (positive is a right steering gesture).
        const screenDegrees = relativeRoll * 180 / Math.PI;
        const normalized = Math.max(-1, Math.min(1, screenDegrees / PORTRAIT_STEERING_DEGREES));
        const steeringPercent = Math.round(Math.max(-1, Math.min(1, -runtime.state.steering)) * 100);
        const direction = screenDegrees < -0.35
          ? 'LEFT'
          : screenDegrees > 0.35
            ? 'RIGHT'
            : 'CENTER';
        meter.style.setProperty('--turn-portrait-steer', String(normalized));
        meterValue.textContent = `${direction} · ${Math.abs(screenDegrees).toFixed(1)}° · ${Math.abs(steeringPercent)}%`;
      }

      meterFrame = requestAnimationFrame(updateMeter);
    }

    for (const eventName of ['resize', 'orientationchange', 'pageshow']) {
      window.addEventListener(eventName, settleViewport, { passive: true });
    }
    orientationMedia.addEventListener?.('change', settleViewport);
    window.visualViewport?.addEventListener('resize', settleViewport, { passive: true });
    screen.orientation?.addEventListener?.('change', settleViewport, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) settleViewport();
    }, { passive: true });
    window.addEventListener('pagehide', () => cancelAnimationFrame(meterFrame), { once: true });

    settleViewport();
    updateMeter();
  }

  publishMotionProfile();
  keepPortraitWhenTheRaceRequestsLandscape();
  installPortraitLanguagePatches();

  const refreshProfile = () => {
    publishMotionProfile();
    root.classList.toggle('turn-lab-portrait-active', portraitActive());
  };
  orientationMedia.addEventListener?.('change', refreshProfile);
  window.addEventListener('orientationchange', refreshProfile, { passive: true });

  if (globalThis.__turnRuntime) installRuntime(globalThis.__turnRuntime);
  window.addEventListener('turn:runtime-ready', (event) => {
    installRuntime(event.detail || globalThis.__turnRuntime);
  }, { once: true });
})();
