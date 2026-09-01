const DEFAULT_DPR_CAP = 1.5;
const DEFAULT_SHADOW_MAP_SIZE = 1024;
const TOUCH_DPR_CAP = 1.25;
const TOUCH_SHADOW_MAP_SIZE = 512;
const TOUCH_SHADOW_REFRESH_INTERVAL_MS = 1000 / 30;
const LEGACY_TABLET_MAX_LONG_SIDE = 1080;
const LEGACY_TABLET_MIN_SHORT_SIDE = 700;
const MOUNTAIN_TRACK_ID = 'mountain';
const MIN_DPR_CAP = 0.75;
const MAX_DPR_CAP = 1.5;
const SHADOW_MAP_SIZES = new Set([256, 512, 1024]);

let installed = null;

export function performanceProfileFromSearch(
  search = globalThis.location?.search || '',
  devicePixelRatio = globalThis.devicePixelRatio || 1,
  environment = currentPerformanceEnvironment()
) {
  const parameters = safeSearchParameters(search);
  const diagnostics = parameters.get('perf') === '1';
  const touchOptimized = Boolean(environment?.touchOptimized);
  const legacyTablet = Boolean(environment?.legacyTablet);
  const productionDprCap = touchOptimized ? TOUCH_DPR_CAP : DEFAULT_DPR_CAP;
  const productionShadowMapSize = touchOptimized ? TOUCH_SHADOW_MAP_SIZE : DEFAULT_SHADOW_MAP_SIZE;
  let dprCap = productionDprCap;
  let shadowsEnabled = true;
  let shadowMapSize = productionShadowMapSize;
  let shadowOverride = false;

  if (diagnostics) {
    const requestedDpr = Number(parameters.get('dpr'));
    if (Number.isFinite(requestedDpr) && requestedDpr > 0) {
      dprCap = clamp(requestedDpr, MIN_DPR_CAP, MAX_DPR_CAP);
    }

    const shadowSetting = parameters.get('shadow');
    if (shadowSetting === 'off' || shadowSetting === '0') {
      shadowsEnabled = false;
      shadowOverride = true;
    } else {
      const requestedShadowMapSize = Number(shadowSetting);
      if (SHADOW_MAP_SIZES.has(requestedShadowMapSize)) {
        shadowMapSize = requestedShadowMapSize;
        shadowOverride = true;
      }
    }
  }

  const pixelRatio = Math.min(Math.max(0.5, Number(devicePixelRatio) || 1), dprCap);
  const label = `DPR≤${dprCap.toFixed(2)} · shadows ${shadowsEnabled ? shadowMapSize : 'off'}`;

  return Object.freeze({
    active: diagnostics && (
      Math.abs(dprCap - productionDprCap) > 0.001
      || shadowsEnabled === false
      || shadowMapSize !== productionShadowMapSize
    ),
    diagnostics,
    touchOptimized,
    legacyTablet,
    dprCap,
    pixelRatio,
    shadowsEnabled,
    shadowMapSize,
    shadowOverride,
    label
  });
}

export function shadowsEnabledForTrack(profile, trackId) {
  if (profile?.shadowsEnabled !== true) return false;
  const normalizedTrackId = String(trackId || '').trim().toLowerCase();
  const legacyTabletMountain = profile.touchOptimized === true
    && profile.legacyTablet === true
    && profile.shadowOverride !== true
    && normalizedTrackId === MOUNTAIN_TRACK_ID;
  return !legacyTabletMountain;
}

export function isLegacyTabletScreen({ touchOptimized = false, width = 0, height = 0 } = {}) {
  const screenWidth = Math.max(0, Number(width) || 0);
  const screenHeight = Math.max(0, Number(height) || 0);
  const screenLongSide = Math.max(screenWidth, screenHeight);
  const screenShortSide = Math.min(screenWidth, screenHeight);
  return Boolean(touchOptimized)
    && screenShortSide >= LEGACY_TABLET_MIN_SHORT_SIDE
    && screenLongSide <= LEGACY_TABLET_MAX_LONG_SIDE;
}

export function installPerformanceProfile() {
  if (installed) return installed;
  const profile = performanceProfileFromSearch();
  let runtimeApplied = false;

  function apply(runtime = globalThis.__turnRuntime) {
    if (!runtime?.renderer) return;
    const renderer = runtime.renderer;
    if (!renderer.userData) renderer.userData = {};
    if (!renderer.userData.turnOriginalSetPixelRatio) {
      const originalSetPixelRatio = renderer.setPixelRatio.bind(renderer);
      renderer.userData.turnOriginalSetPixelRatio = originalSetPixelRatio;
      renderer.setPixelRatio = (value) => originalSetPixelRatio(Math.min(Number(value) || 1, profile.dprCap));
    }
    renderer.setPixelRatio(profile.pixelRatio);
    renderer.shadowMap.enabled = profile.shadowsEnabled;
    installTouchShadowRefreshCap(renderer, profile, runtime);
    const shadowMapSize = profile.shadowMapSize;
    runtime.scene?.traverse?.((node) => {
      if (!node?.isLight || !node.shadow?.mapSize) return;
      node.shadow.mapSize.set(shadowMapSize, shadowMapSize);
      if (node.shadow.map) {
        node.shadow.map.dispose?.();
        node.shadow.map = null;
      }
      node.shadow.needsUpdate = true;
    });
    renderer.userData.turnPerformanceProfile = profile;
    runtimeApplied = true;
  }

  function onRuntimeReady(event) {
    apply(event.detail || globalThis.__turnRuntime);
  }

  window.addEventListener('turn:runtime-ready', onRuntimeReady);
  if (globalThis.__turnRuntime) apply(globalThis.__turnRuntime);

  installed = Object.freeze({
    profile,
    apply,
    get runtimeApplied() {
      return runtimeApplied;
    }
  });
  globalThis.__turnPerformanceProfile = profile;
  globalThis.__turnPerformanceProfileRuntime = installed;
  return installed;
}

function installTouchShadowRefreshCap(renderer, profile, runtime) {
  if (!renderer?.shadowMap) return;
  if (!profile.touchOptimized || !profile.shadowsEnabled) {
    renderer.shadowMap.autoUpdate = true;
    return;
  }

  renderer.shadowMap.autoUpdate = false;
  if (renderer.userData.turnOriginalRender) return;

  const originalRender = renderer.render.bind(renderer);
  renderer.userData.turnOriginalRender = originalRender;
  let activeTrackId = null;
  let lastShadowRefreshAt = -Infinity;

  function syncTrackShadowPolicy() {
    const trackId = String(runtime?.state?.trackId || '').trim().toLowerCase();
    if (trackId === activeTrackId) return;
    activeTrackId = trackId;
    const enabled = shadowsEnabledForTrack(profile, trackId);
    renderer.shadowMap.enabled = enabled;
    if (enabled) renderer.shadowMap.needsUpdate = true;
    const disabledForLegacyMountain = profile.shadowsEnabled === true && enabled === false;
    const diagnostics = Object.freeze({
      revision: 'r187-legacy-tablet-mountain-shadows',
      trackId,
      enabled,
      disabledForLegacyMountain,
      label: disabledForLegacyMountain ? 'track shadows off · legacy-tablet MOUNTAIN' : null
    });
    renderer.userData.turnTrackShadowPolicy = diagnostics;
    globalThis.__turnTrackShadowPolicy = diagnostics;
  }

  syncTrackShadowPolicy();

  renderer.render = (scene, camera) => {
    syncTrackShadowPolicy();
    const now = performance.now();
    if (renderer.shadowMap.enabled && now - lastShadowRefreshAt >= TOUCH_SHADOW_REFRESH_INTERVAL_MS) {
      renderer.shadowMap.needsUpdate = true;
      lastShadowRefreshAt = now;
    }
    return originalRender(scene, camera);
  };
}

function currentPerformanceEnvironment() {
  let coarsePointer = false;
  try {
    coarsePointer = Boolean(globalThis.matchMedia?.('(pointer: coarse)')?.matches);
  } catch (_) {}
  const maxTouchPoints = Math.max(0, Number(globalThis.navigator?.maxTouchPoints) || 0);
  const screenWidth = Math.max(0, Number(globalThis.screen?.width) || 0);
  const screenHeight = Math.max(0, Number(globalThis.screen?.height) || 0);
  const screenLongSide = Math.max(screenWidth, screenHeight);
  const screenShortSide = Math.min(screenWidth, screenHeight);
  const touchOptimized = coarsePointer || maxTouchPoints > 0;
  const legacyTablet = isLegacyTabletScreen({
    touchOptimized,
    width: screenWidth,
    height: screenHeight
  });
  return Object.freeze({
    coarsePointer,
    maxTouchPoints,
    screenLongSide,
    screenShortSide,
    touchOptimized,
    legacyTablet
  });
}

function safeSearchParameters(search) {
  try {
    return new URLSearchParams(search);
  } catch (_) {
    return new URLSearchParams();
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
