const SETTLE_DELAYS_MS = Object.freeze([0, 120, 350, 900, 1500]);

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function readReachableViewport(windowRef = globalThis.window, documentRef = globalThis.document) {
  const visual = windowRef?.visualViewport;
  const visualWidth = finitePositive(visual?.width);
  const visualHeight = finitePositive(visual?.height);

  // YOUR TURN deliberately crosses portrait -> landscape after ACCEPT. On older
  // iPad Safari the layout viewport/client dimensions can lag behind that rotation.
  // visualViewport is the browser's actually reachable rectangle, including its
  // current toolbar allocation, so prefer it whenever both axes are available.
  if (visualWidth && visualHeight) {
    return Object.freeze({
      width: Math.max(1, Math.round(visualWidth)),
      height: Math.max(1, Math.round(visualHeight)),
      source: 'visualViewport'
    });
  }

  const innerWidth = finitePositive(windowRef?.innerWidth);
  const innerHeight = finitePositive(windowRef?.innerHeight);
  if (innerWidth && innerHeight) {
    return Object.freeze({
      width: Math.max(1, Math.round(innerWidth)),
      height: Math.max(1, Math.round(innerHeight)),
      source: 'innerViewport'
    });
  }

  const root = documentRef?.documentElement;
  return Object.freeze({
    width: Math.max(1, Math.round(finitePositive(root?.clientWidth) || 1)),
    height: Math.max(1, Math.round(finitePositive(root?.clientHeight) || 1)),
    source: 'clientViewport'
  });
}

function publishDiagnostics(size, reason, requested = null) {
  globalThis.__yourTurnViewportDiagnostics = Object.freeze({
    reason,
    source: size.source,
    width: size.width,
    height: size.height,
    requestedWidth: finitePositive(requested?.width) || null,
    requestedHeight: finitePositive(requested?.height) || null,
    visualWidth: finitePositive(globalThis.visualViewport?.width) || null,
    visualHeight: finitePositive(globalThis.visualViewport?.height) || null,
    innerWidth: finitePositive(globalThis.innerWidth) || null,
    innerHeight: finitePositive(globalThis.innerHeight) || null,
    clientWidth: finitePositive(globalThis.document?.documentElement?.clientWidth) || null,
    clientHeight: finitePositive(globalThis.document?.documentElement?.clientHeight) || null
  });
}

function applyReachableViewport(runtime, reason = 'apply') {
  if (!runtime?.renderer || !runtime?.camera) return false;
  const size = readReachableViewport();
  const root = globalThis.document?.documentElement;
  root?.style?.setProperty('--app-width', `${size.width}px`);
  root?.style?.setProperty('--app-height', `${size.height}px`);
  runtime.camera.aspect = size.width / size.height;
  runtime.camera.updateProjectionMatrix?.();
  runtime.renderer.setSize(size.width, size.height);
  publishDiagnostics(size, reason);
  return true;
}

function scheduleSettledApplies(runtime, reason) {
  for (const delay of SETTLE_DELAYS_MS) {
    globalThis.setTimeout?.(() => applyReachableViewport(runtime, `${reason}+${delay}`), delay);
  }
}

export function installYourTurnViewportBoundary(runtime = globalThis.__turnRuntime) {
  if (!runtime?.renderer || !runtime?.camera) return false;
  if (runtime.__yourTurnViewportBoundaryInstalled) return true;
  runtime.__yourTurnViewportBoundaryInstalled = true;

  const renderer = runtime.renderer;
  const nativeSetSize = renderer.setSize.bind(renderer);

  // The canonical TURN resize path can ask for stale portrait client dimensions
  // during the iPad Safari rotation. Clamp every renderer resize to the current
  // reachable viewport and repair the CSS app boundary/camera aspect at the same
  // seam. Production TURN never loads this module.
  renderer.setSize = (requestedWidth, requestedHeight, updateStyle) => {
    const size = readReachableViewport();
    const root = globalThis.document?.documentElement;
    root?.style?.setProperty('--app-width', `${size.width}px`);
    root?.style?.setProperty('--app-height', `${size.height}px`);
    runtime.camera.aspect = size.width / size.height;
    runtime.camera.updateProjectionMatrix?.();
    publishDiagnostics(size, 'renderer-setSize', {
      width: requestedWidth,
      height: requestedHeight
    });
    return nativeSetSize(size.width, size.height, updateStyle);
  };

  const resample = (reason) => scheduleSettledApplies(runtime, reason);
  globalThis.addEventListener?.('resize', () => resample('window-resize'), { passive: true });
  globalThis.addEventListener?.('orientationchange', () => resample('orientationchange'), { passive: true });
  globalThis.addEventListener?.('pageshow', () => resample('pageshow'), { passive: true });
  globalThis.visualViewport?.addEventListener?.('resize', () => resample('visual-resize'), { passive: true });
  globalThis.visualViewport?.addEventListener?.('scroll', () => resample('visual-scroll'), { passive: true });

  scheduleSettledApplies(runtime, 'install');
  return true;
}

function bootstrap() {
  if (installYourTurnViewportBoundary()) return;
  globalThis.addEventListener?.('turn:runtime-ready', (event) => {
    installYourTurnViewportBoundary(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

bootstrap();
