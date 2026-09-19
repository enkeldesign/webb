const DEFAULT_DPR_CAP = 1.5;
const TOUCH_DPR_CAP = 1.25;
const MIN_DPR_CAP = 0.75;
const MAX_DPR_CAP = 1.5;

let installed = null;

export function performanceProfileFromSearch(
  search = globalThis.location?.search || '',
  devicePixelRatio = globalThis.devicePixelRatio || 1,
  environment = currentPerformanceEnvironment()
) {
  const parameters = safeSearchParameters(search);
  const diagnostics = parameters.get('perf') === '1';
  const touchOptimized = Boolean(environment?.touchOptimized);
  const productionDprCap = touchOptimized ? TOUCH_DPR_CAP : DEFAULT_DPR_CAP;
  let dprCap = productionDprCap;

  if (diagnostics) {
    const requestedDpr = Number(parameters.get('dpr'));
    if (Number.isFinite(requestedDpr) && requestedDpr > 0) {
      dprCap = clamp(requestedDpr, MIN_DPR_CAP, MAX_DPR_CAP);
    }
  }

  const pixelRatio = Math.min(Math.max(0.5, Number(devicePixelRatio) || 1), dprCap);
  const label = `DPR≤${dprCap.toFixed(2)} · projected car shadows`;

  return Object.freeze({
    active: diagnostics && Math.abs(dprCap - productionDprCap) > 0.001,
    diagnostics,
    touchOptimized,
    dprCap,
    pixelRatio,
    label
  });
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
  return Object.freeze({
    coarsePointer,
    maxTouchPoints,
    screenLongSide,
    screenShortSide,
    touchOptimized
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
