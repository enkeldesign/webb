const QUARTER_TURN_DEGREES = 90;
const HALF_TURN_DEGREES = 180;
const FULL_TURN_DEGREES = 360;

export function normalizeDegrees(value) {
  let degrees = Number(value) || 0;
  while (degrees > HALF_TURN_DEGREES) degrees -= FULL_TURN_DEGREES;
  while (degrees <= -HALF_TURN_DEGREES) degrees += FULL_TURN_DEGREES;
  return degrees;
}

export function snapToQuarterTurn(value) {
  return normalizeDegrees(
    Math.round(normalizeDegrees(value) / QUARTER_TURN_DEGREES) * QUARTER_TURN_DEGREES
  );
}

export function calculateOrientationFreezeTransform({
  lockedAngle,
  currentAngle,
  logicalWidth,
  logicalHeight,
  viewportWidth,
  viewportHeight
}) {
  const width = Math.max(1, Number(logicalWidth) || 1);
  const height = Math.max(1, Number(logicalHeight) || 1);
  const availableWidth = Math.max(1, Number(viewportWidth) || 1);
  const availableHeight = Math.max(1, Number(viewportHeight) || 1);
  const rotation = snapToQuarterTurn(Number(currentAngle) - Number(lockedAngle));
  const swapsAxes = Math.abs(rotation) % HALF_TURN_DEGREES === QUARTER_TURN_DEGREES;
  const rotatedWidth = swapsAxes ? height : width;
  const rotatedHeight = swapsAxes ? width : height;
  const scale = Math.min(
    1,
    availableWidth / rotatedWidth,
    availableHeight / rotatedHeight
  );

  return Object.freeze({
    rotation,
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    width,
    height,
    rotatedWidth,
    rotatedHeight
  });
}

export function installTurnNextOrientationFreeze({
  environment = globalThis,
  platform = null
} = {}) {
  const windowRef = environment.window || environment;
  const documentRef = environment.document || windowRef.document;
  const screenRef = environment.screen || windowRef.screen;
  const preflight = environment.__TURN_NEXT_ORIENTATION_PREFLIGHT__;
  const viewport = documentRef?.querySelector?.('#turnAppViewport');
  const root = documentRef?.documentElement;

  if (
    !windowRef
    || !documentRef
    || !root
    || !viewport
    || typeof preflight?.getAngleDegrees !== 'function'
    || typeof preflight?.getViewportSize !== 'function'
  ) {
    console.info('TURN NEXT: visual orientation freeze is unavailable in this environment.');
    return Object.freeze({ available: false, active: false });
  }

  let active = false;
  let lockedAngle = 0;
  let logicalWidth = 1;
  let logicalHeight = 1;
  let runtime = null;
  let resizeFrame = 0;
  let rendererPatched = false;
  const stabilizationTimers = new Set();

  function readViewport() {
    const size = preflight.getViewportSize();
    return {
      width: Math.max(1, Math.round(Number(size?.width) || 1)),
      height: Math.max(1, Math.round(Number(size?.height) || 1))
    };
  }

  function applyRendererSize() {
    if (!active || !runtime?.renderer || !runtime?.camera) return;
    runtime.camera.aspect = logicalWidth / logicalHeight;
    runtime.camera.updateProjectionMatrix();
    runtime.renderer.setSize(logicalWidth, logicalHeight);
  }

  function patchRuntime(nextRuntime) {
    if (!nextRuntime?.renderer || !nextRuntime?.camera || rendererPatched) return;
    runtime = nextRuntime;

    const nativeSetSize = runtime.renderer.setSize.bind(runtime.renderer);
    const nativeUpdateProjectionMatrix = runtime.camera.updateProjectionMatrix.bind(runtime.camera);

    runtime.renderer.setSize = function setOrientationAwareSize(width, height, updateStyle) {
      if (active) return nativeSetSize(logicalWidth, logicalHeight, updateStyle);
      return nativeSetSize(width, height, updateStyle);
    };

    runtime.camera.updateProjectionMatrix = function updateOrientationAwareProjection(...args) {
      if (active) runtime.camera.aspect = logicalWidth / logicalHeight;
      return nativeUpdateProjectionMatrix(...args);
    };

    rendererPatched = true;
    applyRendererSize();
  }

  function applyTransform() {
    if (!active) return;

    const currentViewport = readViewport();
    const transform = calculateOrientationFreezeTransform({
      lockedAngle,
      currentAngle: preflight.getAngleDegrees(),
      logicalWidth,
      logicalHeight,
      viewportWidth: currentViewport.width,
      viewportHeight: currentViewport.height
    });

    root.style.setProperty('--turn-freeze-width', `${transform.width}px`);
    root.style.setProperty('--turn-freeze-height', `${transform.height}px`);
    root.style.setProperty('--turn-freeze-rotation', `${transform.rotation}deg`);
    root.style.setProperty('--turn-freeze-scale', String(transform.scale));
    root.dataset.turnOrientationFreeze = 'active';
    root.dataset.turnOrientationFreezeRotation = String(transform.rotation);
    applyRendererSize();
  }

  function scheduleApply() {
    if (typeof windowRef.requestAnimationFrame !== 'function') {
      applyTransform();
      return;
    }

    windowRef.cancelAnimationFrame?.(resizeFrame);
    resizeFrame = windowRef.requestAnimationFrame(() => {
      windowRef.requestAnimationFrame(applyTransform);
    });
  }

  function clearStabilizationTimers() {
    for (const timer of stabilizationTimers) windowRef.clearTimeout?.(timer);
    stabilizationTimers.clear();
  }

  function stabilizeLogicalViewport() {
    if (!active) return;
    const angleDelta = Math.abs(normalizeDegrees(preflight.getAngleDegrees() - lockedAngle));
    if (angleDelta > 45) return;

    const size = readViewport();
    logicalWidth = size.width;
    logicalHeight = size.height;
    applyTransform();
  }

  function start() {
    if (active) return;
    const size = readViewport();
    active = true;
    lockedAngle = preflight.getAngleDegrees();
    logicalWidth = size.width;
    logicalHeight = size.height;
    root.dataset.turnOrientationFreezeSupport = 'visual';
    void platform?.display?.lockLandscape?.();
    applyTransform();

    clearStabilizationTimers();
    for (const delay of [80, 260, 700]) {
      const timer = windowRef.setTimeout?.(() => {
        stabilizationTimers.delete(timer);
        stabilizeLogicalViewport();
      }, delay);
      if (timer != null) stabilizationTimers.add(timer);
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    clearStabilizationTimers();
    root.removeAttribute('data-turn-orientation-freeze');
    root.removeAttribute('data-turn-orientation-freeze-rotation');
    root.style.removeProperty('--turn-freeze-width');
    root.style.removeProperty('--turn-freeze-height');
    root.style.removeProperty('--turn-freeze-rotation');
    root.style.removeProperty('--turn-freeze-scale');

    const EventType = windowRef.Event || environment.Event;
    if (typeof EventType === 'function') {
      windowRef.dispatchEvent?.(new EventType('resize'));
    }
  }

  function handleUiState(event) {
    if (event.detail?.running) start();
    else stop();
  }

  function handleRuntimeReady(event) {
    patchRuntime(event.detail);
  }

  windowRef.addEventListener?.('turn:ui-state-change', handleUiState);
  windowRef.addEventListener?.('turn:runtime-ready', handleRuntimeReady);
  windowRef.addEventListener?.('resize', scheduleApply, { passive: true });
  windowRef.addEventListener?.('orientationchange', scheduleApply, { passive: true });
  windowRef.addEventListener?.('pageshow', scheduleApply, { passive: true });
  windowRef.visualViewport?.addEventListener?.('resize', scheduleApply, { passive: true });
  windowRef.visualViewport?.addEventListener?.('scroll', scheduleApply, { passive: true });
  screenRef?.orientation?.addEventListener?.('change', scheduleApply, { passive: true });
  documentRef.addEventListener?.('visibilitychange', () => {
    if (!documentRef.hidden) scheduleApply();
  }, { passive: true });

  patchRuntime(environment.__turnRuntime);
  root.dataset.turnOrientationFreezeSupport = 'visual';
  console.info('TURN NEXT: visual orientation freeze prototype installed.');

  return Object.freeze({
    available: true,
    get active() {
      return active;
    },
    start,
    stop,
    refresh: applyTransform
  });
}
