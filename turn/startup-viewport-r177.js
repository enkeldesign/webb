const MIN_RACING_ASPECT = 16 / 9;
const SLOW_LOADING_MESSAGE_DELAY_MS = 1400;
const ORIENTATION_SETTLE_DELAYS_MS = Object.freeze([0, 70, 180, 420, 900]);
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
  // These modules sit late in the current sequential startup chain. Starting their
  // downloads immediately removes much of the first-install network waterfall without
  // changing initialization order or running game code early.
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
      --turn-stage-width: 100vw;
      --turn-stage-height: 100vh;
      --turn-racing-cover-width: 100vw;
      --turn-racing-cover-height: 100vh;
    }
    html,
    body {
      margin: 0 !important;
      overflow: hidden !important;
      background: var(--turn-color-cyan, var(--cyan, #38d9ff)) !important;
    }
    body {
      position: fixed !important;
      inset: auto !important;
      top: 0 !important;
      left: 0 !important;
      width: var(--turn-stage-width) !important;
      height: var(--turn-stage-height) !important;
      min-width: 0 !important;
      min-height: 0 !important;
    }
    #game {
      position: fixed !important;
      inset: auto !important;
      top: 0 !important;
      left: 0 !important;
      width: var(--turn-stage-width) !important;
      height: var(--turn-stage-height) !important;
      overflow: hidden !important;
      background: var(--turn-color-cyan, var(--cyan, #38d9ff)) !important;
    }
    html body .install-gate,
    html body .m8-home.m8-home-fixed-layout {
      position: fixed !important;
      inset: auto !important;
      top: 0 !important;
      left: 0 !important;
      width: var(--turn-stage-width) !important;
      height: var(--turn-stage-height) !important;
      min-width: 0 !important;
      min-height: 0 !important;
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
    note.hidden = true;
    copy.insertAdjacentElement('afterend', note);
  }

  let timer = 0;
  const loading = () => gate.classList.contains('turn-startup-loading')
    || document.documentElement.classList.contains('turn-startup-pending');

  function clearExpectation() {
    window.clearTimeout(timer);
    timer = 0;
    note.hidden = true;
  }

  function syncExpectation() {
    if (!loading()) {
      clearExpectation();
      return;
    }
    if (timer || !note.hidden) return;
    timer = window.setTimeout(() => {
      timer = 0;
      if (loading()) note.hidden = false;
    }, SLOW_LOADING_MESSAGE_DELAY_MS);
  }

  const observer = new MutationObserver(syncExpectation);
  observer.observe(gate, { attributes: true, attributeFilter: ['class', 'hidden'] });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('turn:home-ready', () => {
    clearExpectation();
    observer.disconnect();
  }, { once: true });
  syncExpectation();
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

function standaloneScreenSize(live) {
  if (!isStandaloneDisplayMode()) return null;
  const reportedWidth = Math.max(Number(screen.width) || 0, Number(screen.availWidth) || 0);
  const reportedHeight = Math.max(Number(screen.height) || 0, Number(screen.availHeight) || 0);
  if (!validSize(reportedWidth, reportedHeight)) return null;

  const longSide = Math.max(reportedWidth, reportedHeight);
  const shortSide = Math.min(reportedWidth, reportedHeight);
  return live.width >= live.height
    ? { width: longSide, height: shortSide }
    : { width: shortSide, height: longSide };
}

function targetViewportSize() {
  const live = liveViewportSize();
  return standaloneScreenSize(live) || live;
}

function fitRacingSurface(width, height) {
  const viewportAspect = width / Math.max(1, height);
  const renderAspect = Math.max(viewportAspect, MIN_RACING_ASPECT);
  const viewportArea = width * height;
  let bufferWidth;
  let bufferHeight;

  if (viewportAspect < MIN_RACING_ASPECT) {
    // Exact 16:9 integer multiples guarantee that the iPad drawing buffer, camera and
    // centred CSS cover have the same ratio. The buffer area stays close to the previous
    // 4:3 workload, so crop-not-stretch does not become a performance regression.
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
  rootStyle.setProperty('--turn-stage-width', `${width}px`);
  rootStyle.setProperty('--turn-stage-height', `${height}px`);
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
