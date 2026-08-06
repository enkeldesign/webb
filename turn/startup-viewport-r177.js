const MIN_RACING_ASPECT = 16 / 9;
const SLOW_LOADING_MESSAGE_DELAY_MS = 1400;
const ORIENTATION_SETTLE_DELAYS_MS = Object.freeze([0, 70, 180, 420, 900, 1600]);
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const moduleBase = new URL('/turn/', globalThis.location?.href || 'https://enkel.design/turn/');

function withBuild(path) {
  const url = new URL(path, moduleBase);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

function preloadModule(path, { crossOrigin = false } = {}) {
  const href = path.startsWith('https://') ? path : withBuild(path);
  if (document.querySelector(`link[rel="modulepreload"][href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'modulepreload';
  link.href = href;
  if (crossOrigin) link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
}

function preloadCriticalStartupGraph() {
  // Start the slow downloads immediately, but keep execution in app.js's established
  // order. This shortens a fresh install without running game modules prematurely.
  for (const path of [
    './platform/web-platform.js',
    './platform/platform-context.js',
    './motion-lifecycle-bridge.js',
    './display-lifecycle-bridge.js',
    './main.js',
    './render/world.js?revision=r175-bella-broad-rear-zone',
    './m8-home.js?revision=r131-motion-permission-retry&trophy-road=r159',
    './m8-home-fixed-layout.js?revision=m8.9-track-title-alignment&trophy-road=r159&achievements=r166-bella-records&bella-rescue=r174-siren-zone'
  ]) preloadModule(path);

  preloadModule(
    'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js',
    { crossOrigin: true }
  );
}

function installResponsiveViewportStyle() {
  if (document.querySelector('#turn-responsive-viewport-r177-style')) return;
  const style = document.createElement('style');
  style.id = 'turn-responsive-viewport-r177-style';
  style.textContent = `
    :root {
      --turn-racing-cover-width: 100vw;
      --turn-racing-cover-height: 100vh;
    }
    html,
    body {
      margin: 0 !important;
      overflow: hidden !important;
      background: var(--turn-color-cyan, var(--cyan, #38d9ff)) !important;
    }
    html {
      width: 100% !important;
      height: 100% !important;
    }
    body {
      position: fixed !important;
      inset: 0 !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
    }
    #game,
    html body .install-gate,
    html body .rotate-panel,
    html body .m8-home.m8-home-fixed-layout {
      position: fixed !important;
      inset: 0 !important;
      width: auto !important;
      height: auto !important;
      min-width: 0 !important;
      min-height: 0 !important;
    }
    #game {
      overflow: hidden !important;
      background: var(--turn-color-cyan, var(--cyan, #38d9ff)) !important;
    }
    #game canvas {
      position: absolute !important;
      inset: auto !important;
      top: 50% !important;
      left: 50% !important;
      width: var(--turn-racing-cover-width) !important;
      height: var(--turn-racing-cover-height) !important;
      max-width: none !important;
      max-height: none !important;
      transform: translate(-50%, -50%) !important;
    }
    .turn-startup-expectation {
      margin: -8px 0 18px;
      max-width: 34rem;
      font-size: .92rem;
      font-weight: 750;
      line-height: 1.35;
      letter-spacing: 0;
      text-transform: none;
      opacity: .74;
    }
  `;
  document.head.appendChild(style);
}

function installSlowLoadingMessage() {
  const gate = document.querySelector('#installGate');
  const copy = gate?.querySelector('.install-copy');
  if (!gate || !copy) return;

  let note = gate.querySelector('.turn-startup-expectation');
  if (!note) {
    note = document.createElement('p');
    note.className = 'turn-startup-expectation';
    note.textContent = 'This might take a minute.';
    note.setAttribute('role', 'status');
    note.setAttribute('aria-live', 'polite');
    note.hidden = true;
    copy.insertAdjacentElement('afterend', note);
  }

  const launchStartedAt = performance.now();
  let timer = 0;
  let finished = false;

  function loadingCoverIsActive() {
    return gate.classList.contains('turn-startup-loading')
      || document.documentElement.classList.contains('turn-startup-pending')
      || gate.style.display === 'grid';
  }

  function stop() {
    finished = true;
    window.clearTimeout(timer);
    timer = 0;
    note.hidden = true;
  }

  function poll() {
    if (finished || document.documentElement.classList.contains('turn-home-ready')) {
      stop();
      return;
    }

    const elapsed = performance.now() - launchStartedAt;
    if (elapsed >= SLOW_LOADING_MESSAGE_DELAY_MS && loadingCoverIsActive()) {
      note.hidden = false;
    }
    timer = window.setTimeout(poll, 100);
  }

  document.addEventListener('turn:home-ready', stop, { once: true });
  timer = window.setTimeout(poll, SLOW_LOADING_MESSAGE_DELAY_MS);
}

function isStandaloneDisplayMode() {
  return document.documentElement.classList.contains('turn-standalone')
    || window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || navigator.standalone === true;
}

function validSize(width, height) {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

function orientSize(width, height, landscape) {
  if (!validSize(width, height)) return null;
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  return landscape
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}

function liveViewportSize() {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const candidates = [
    [Number(viewport?.width), Number(viewport?.height)],
    [Number(window.innerWidth), Number(window.innerHeight)],
    [Number(root.clientWidth), Number(root.clientHeight)]
  ];
  const current = candidates.find(([width, height]) => validSize(width, height));
  if (!current) return { width: 1, height: 1 };
  return {
    width: Math.max(1, Math.round(current[0])),
    height: Math.max(1, Math.round(current[1]))
  };
}

function viewportIsLandscape(live) {
  if (window.matchMedia?.('(orientation: landscape)').matches) return true;
  if (window.matchMedia?.('(orientation: portrait)').matches) return false;
  const type = String(screen.orientation?.type || '');
  if (type.startsWith('landscape')) return true;
  if (type.startsWith('portrait')) return false;
  const legacyAngle = Math.abs(Number(window.orientation));
  if (legacyAngle === 90) return true;
  return live.width >= live.height;
}

function measureCssViewport(cssText) {
  if (!document.body) return null;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = `${cssText};position:fixed;visibility:hidden;pointer-events:none;z-index:-2147483648;`;
  document.body.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return validSize(rect.width, rect.height)
    ? { width: rect.width, height: rect.height }
    : null;
}

function targetViewportSize() {
  const live = liveViewportSize();
  if (!isStandaloneDisplayMode()) return live;

  const landscape = viewportIsLandscape(live);
  const candidates = [
    orientSize(live.width, live.height, landscape),
    orientSize(Number(screen.width), Number(screen.height), landscape),
    orientSize(Number(screen.availWidth), Number(screen.availHeight), landscape),
    orientSize(Number(window.outerWidth), Number(window.outerHeight), landscape),
    orientSize(
      measureCssViewport('inset:0;width:auto;height:auto')?.width,
      measureCssViewport('inset:0;width:auto;height:auto')?.height,
      landscape
    ),
    orientSize(
      measureCssViewport('inset:auto;left:0;top:0;width:100lvw;height:100lvh')?.width,
      measureCssViewport('inset:auto;left:0;top:0;width:100lvw;height:100lvh')?.height,
      landscape
    )
  ].filter(Boolean);

  return {
    width: Math.max(1, Math.round(Math.max(...candidates.map((size) => size.width)))),
    height: Math.max(1, Math.round(Math.max(...candidates.map((size) => size.height))))
  };
}

function fitRacingSurface(width, height) {
  const viewportAspect = width / Math.max(1, height);
  const renderAspect = Math.max(viewportAspect, MIN_RACING_ASPECT);
  const viewportArea = width * height;
  let bufferWidth;
  let bufferHeight;

  if (viewportAspect < MIN_RACING_ASPECT) {
    const aspectUnit = Math.max(1, Math.round(Math.sqrt(viewportArea / (16 * 9))));
    bufferWidth = aspectUnit * 16;
    bufferHeight = aspectUnit * 9;
  } else {
    bufferWidth = width;
    bufferHeight = height;
  }

  const coverHeight = renderAspect >= viewportAspect
    ? height
    : width / renderAspect;
  const coverWidth = renderAspect >= viewportAspect
    ? height * renderAspect
    : width;

  return Object.freeze({
    viewportAspect,
    renderAspect,
    bufferWidth,
    bufferHeight,
    coverWidth: Math.ceil(coverWidth),
    coverHeight: Math.ceil(coverHeight)
  });
}

function applyStageSize(width, height, fit = null) {
  const root = document.documentElement;
  const rootStyle = root.style;
  rootStyle.setProperty('--app-width', `${width}px`);
  rootStyle.setProperty('--app-height', `${height}px`);
  if (fit) {
    rootStyle.setProperty('--turn-racing-cover-width', `${fit.coverWidth}px`);
    rootStyle.setProperty('--turn-racing-cover-height', `${fit.coverHeight}px`);
  }
  root.dataset.turnViewportFit = 'crop-not-stretch';
  root.dataset.turnViewportSize = `${width}x${height}`;
}

function installResponsiveRenderer(runtime) {
  if (!runtime?.renderer || !runtime?.camera || runtime.__responsiveViewportR177Installed) return false;
  runtime.__responsiveViewportR177Installed = true;

  const renderer = runtime.renderer;
  const camera = runtime.camera;
  const canvas = renderer.domElement;
  const nativeSetSize = renderer.setSize.bind(renderer);
  let applying = false;
  let animationFrame = 0;
  let settleTimers = [];
  let latest = null;

  function syncNow() {
    animationFrame = 0;
    const { width, height } = targetViewportSize();
    const fit = fitRacingSurface(width, height);
    latest = Object.freeze({ width, height, ...fit });
    applyStageSize(width, height, fit);

    camera.aspect = fit.renderAspect;
    camera.updateProjectionMatrix();
    applying = true;
    nativeSetSize(fit.bufferWidth, fit.bufferHeight, false);
    applying = false;

    canvas.style.setProperty('width', `${fit.coverWidth}px`, 'important');
    canvas.style.setProperty('height', `${fit.coverHeight}px`, 'important');
    canvas.style.setProperty('top', '50%', 'important');
    canvas.style.setProperty('left', '50%', 'important');
    canvas.style.setProperty('transform', 'translate(-50%, -50%)', 'important');

    document.documentElement.dataset.turnRenderAspect = fit.renderAspect.toFixed(4);
  }

  function queueSync() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      animationFrame = requestAnimationFrame(syncNow);
    });
  }

  function scheduleSettledSync() {
    for (const timer of settleTimers) window.clearTimeout(timer);
    settleTimers = ORIENTATION_SETTLE_DELAYS_MS.map((delay) => window.setTimeout(queueSync, delay));
  }

  renderer.setSize = function guardedResponsiveSetSize(width, height, updateStyle = true) {
    if (applying) return nativeSetSize(width, height, updateStyle);
    queueSync();
    return renderer;
  };

  for (const eventName of ['resize', 'orientationchange', 'pageshow', 'focus']) {
    window.addEventListener(eventName, scheduleSettledSync, { passive: true });
  }
  window.visualViewport?.addEventListener('resize', scheduleSettledSync, { passive: true });
  window.visualViewport?.addEventListener('scroll', scheduleSettledSync, { passive: true });
  screen.orientation?.addEventListener?.('change', scheduleSettledSync, { passive: true });
  document.addEventListener('fullscreenchange', scheduleSettledSync, { passive: true });
  document.addEventListener('webkitfullscreenchange', scheduleSettledSync, { passive: true });

  globalThis.__turnResponsiveViewport = Object.freeze({
    sync: scheduleSettledSync,
    getState: () => latest,
    minimumRacingAspect: MIN_RACING_ASPECT
  });

  scheduleSettledSync();
  return true;
}

function waitForRuntime() {
  if (installResponsiveRenderer(globalThis.__turnRuntime)) return;
  window.addEventListener('turn:runtime-ready', (event) => {
    installResponsiveRenderer(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

installResponsiveViewportStyle();
preloadCriticalStartupGraph();
installSlowLoadingMessage();
const initialStage = targetViewportSize();
applyStageSize(initialStage.width, initialStage.height);
waitForRuntime();
