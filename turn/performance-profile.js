const DEFAULT_DPR_CAP = 2;
const DEFAULT_SHADOW_MAP_SIZE = 1024;
const MIN_DPR_CAP = 0.75;
const MAX_DPR_CAP = 2;
const SHADOW_MAP_SIZES = new Set([256, 512, 1024]);

let installed = false;

export function performanceProfileFromSearch(
  search = globalThis.location?.search || '',
  devicePixelRatio = Number(globalThis.devicePixelRatio) || 1
) {
  let params;
  try {
    params = new URLSearchParams(search);
  } catch (_) {
    params = new URLSearchParams();
  }

  const perfEnabled = params.get('perf') === '1';
  const requestedDpr = Number(params.get('dpr'));
  const dprCap = perfEnabled && Number.isFinite(requestedDpr)
    ? clamp(requestedDpr, MIN_DPR_CAP, MAX_DPR_CAP)
    : DEFAULT_DPR_CAP;

  const shadowRequest = perfEnabled ? String(params.get('shadow') || '') : '';
  const shadowsEnabled = shadowRequest !== 'off';
  const requestedShadowSize = Number(shadowRequest);
  const shadowMapSize = shadowsEnabled && SHADOW_MAP_SIZES.has(requestedShadowSize)
    ? requestedShadowSize
    : DEFAULT_SHADOW_MAP_SIZE;

  const active = perfEnabled && (
    params.has('dpr') ||
    params.has('shadow')
  );

  return Object.freeze({
    active,
    perfEnabled,
    dprCap,
    pixelRatio: Math.min(Math.max(0.1, Number(devicePixelRatio) || 1), dprCap),
    shadowsEnabled,
    shadowMapSize,
    label: profileLabel({ dprCap, shadowsEnabled, shadowMapSize })
  });
}

export function installPerformanceProfile() {
  if (installed) return globalThis.__turnPerformanceProfile || null;
  installed = true;

  const profile = performanceProfileFromSearch();
  globalThis.__turnPerformanceProfile = profile;

  const apply = (runtime) => {
    if (!profile.active || !runtime?.renderer) return;
    applyRendererProfile(runtime, profile);
  };

  if (globalThis.__turnRuntime) apply(globalThis.__turnRuntime);
  else {
    window.addEventListener('turn:runtime-ready', (event) => {
      apply(event.detail || globalThis.__turnRuntime);
    }, { once: true });
  }

  return profile;
}

function applyRendererProfile(runtime, profile) {
  const { renderer, sun } = runtime;

  if (!renderer.userData.turnBaseSetPixelRatio) {
    renderer.userData.turnBaseSetPixelRatio = renderer.setPixelRatio.bind(renderer);
  }
  const setBasePixelRatio = renderer.userData.turnBaseSetPixelRatio;
  renderer.setPixelRatio = (value) => {
    const requested = Number(value);
    const safeRequested = Number.isFinite(requested) ? requested : 1;
    return setBasePixelRatio(Math.min(safeRequested, profile.dprCap));
  };
  renderer.setPixelRatio(Math.min(Number(globalThis.devicePixelRatio) || 1, profile.dprCap));

  const viewport = globalThis.visualViewport;
  const width = Math.max(1, Math.round(viewport?.width || globalThis.innerWidth || renderer.domElement.clientWidth || 1));
  const height = Math.max(1, Math.round(viewport?.height || globalThis.innerHeight || renderer.domElement.clientHeight || 1));
  renderer.setSize(width, height);

  renderer.shadowMap.enabled = profile.shadowsEnabled;
  if (sun) {
    sun.castShadow = profile.shadowsEnabled;
    if (profile.shadowsEnabled && sun.shadow?.mapSize) {
      const sizeChanged = sun.shadow.mapSize.x !== profile.shadowMapSize || sun.shadow.mapSize.y !== profile.shadowMapSize;
      sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
      if (sizeChanged && sun.shadow.map) {
        sun.shadow.map.dispose?.();
        sun.shadow.map = null;
      }
    }
  }
  renderer.shadowMap.needsUpdate = true;

  globalThis.__turnPerformanceProfile = Object.freeze({ ...profile, applied: true });
}

function profileLabel({ dprCap, shadowsEnabled, shadowMapSize }) {
  const shadows = shadowsEnabled ? `shadows ${shadowMapSize}` : 'shadows off';
  return `DPR≤${Number(dprCap).toFixed(2)} · ${shadows}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
