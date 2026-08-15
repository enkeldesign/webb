export const PLAYER_MARKER_STORAGE_KEY = 'turn-player-marker-mode-v1';

export const PLAYER_MARKER_MODE = Object.freeze({
  ON: 'on',
  AUTO: 'auto',
  OFF: 'off'
});

const DEFAULT_MODE = PLAYER_MARKER_MODE.AUTO;
const MARKER_WORLD_UP_SAMPLE = 3;
const MARKER_OFFSET_VIEWPORT_RATIO = 0.13;
const MARKER_OFFSET_MIN_PX = 44;
const MARKER_OFFSET_MAX_PX = 78;
const AUTO_SHOW_VIEWPORT_RATIO = 0.22;
const AUTO_SHOW_MIN_PX = 72;
const AUTO_SHOW_MAX_PX = 108;
const AUTO_HIDE_EXTRA_VIEWPORT_RATIO = 0.05;
const AUTO_HIDE_EXTRA_MIN_PX = 16;
const AUTO_HIDE_EXTRA_MAX_PX = 30;

export function normalizePlayerMarkerMode(value) {
  return Object.values(PLAYER_MARKER_MODE).includes(value) ? value : DEFAULT_MODE;
}

export function playerMarkerAutoThresholds(viewportHeight) {
  const height = Math.max(1, Number(viewportHeight) || 1);
  const show = clamp(
    height * AUTO_SHOW_VIEWPORT_RATIO,
    AUTO_SHOW_MIN_PX,
    AUTO_SHOW_MAX_PX
  );
  const hide = show + clamp(
    height * AUTO_HIDE_EXTRA_VIEWPORT_RATIO,
    AUTO_HIDE_EXTRA_MIN_PX,
    AUTO_HIDE_EXTRA_MAX_PX
  );
  return Object.freeze({ show, hide });
}

export function shouldShowPlayerMarker({
  mode,
  raceActive,
  nearestRivalPixels = Infinity,
  autoWasVisible = false,
  viewportHeight = 1
} = {}) {
  if (!raceActive) return false;

  const normalizedMode = normalizePlayerMarkerMode(mode);
  if (normalizedMode === PLAYER_MARKER_MODE.OFF) return false;
  if (normalizedMode === PLAYER_MARKER_MODE.ON) return true;

  const thresholds = playerMarkerAutoThresholds(viewportHeight);
  const threshold = autoWasVisible ? thresholds.hide : thresholds.show;
  return Number(nearestRivalPixels) <= threshold;
}

export function markerOffsetPixels(viewportHeight) {
  return clamp(
    (Number(viewportHeight) || 0) * MARKER_OFFSET_VIEWPORT_RATIO,
    MARKER_OFFSET_MIN_PX,
    MARKER_OFFSET_MAX_PX
  );
}

function loadMode(storage = globalThis.localStorage) {
  try {
    return normalizePlayerMarkerMode(storage?.getItem?.(PLAYER_MARKER_STORAGE_KEY));
  } catch (_) {
    return DEFAULT_MODE;
  }
}

function saveMode(mode, storage = globalThis.localStorage) {
  const normalized = normalizePlayerMarkerMode(mode);
  try {
    storage?.setItem?.(PLAYER_MARKER_STORAGE_KEY, normalized);
  } catch (_) {}
  return normalized;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function screenPoint(position, camera, rect, { allowOutside = false } = {}) {
  if (!position?.clone || !camera || !rect?.width || !rect?.height) return null;
  const projected = position.clone().project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y) || !Number.isFinite(projected.z)) {
    return null;
  }
  if (projected.z < -1 || projected.z > 1) return null;
  if (!allowOutside && (Math.abs(projected.x) > 1.15 || Math.abs(projected.y) > 1.15)) return null;

  return {
    x: rect.left + (projected.x + 1) * rect.width * 0.5,
    y: rect.top + (1 - projected.y) * rect.height * 0.5,
    z: projected.z
  };
}

function nearestVisibleRivalPixels(runtime, playerPoint, rect) {
  if (!runtime?.state?.lapActive || !playerPoint) return Infinity;
  let nearest = Infinity;

  for (const car of runtime.competitorCars || []) {
    if (!car?.visible || !car.position) continue;
    const rivalPoint = screenPoint(car.position, runtime.camera, rect);
    if (!rivalPoint) continue;
    nearest = Math.min(nearest, Math.hypot(rivalPoint.x - playerPoint.x, rivalPoint.y - playerPoint.y));
  }

  return nearest;
}

function playerMarkerPose(runtime, rect) {
  const position = runtime?.playerCar?.position;
  const camera = runtime?.camera;
  if (!position || !camera) return null;

  const playerPoint = screenPoint(position, camera, rect);
  if (!playerPoint) return null;

  const elevated = position.clone();
  elevated.y += MARKER_WORLD_UP_SAMPLE;
  const elevatedPoint = screenPoint(elevated, camera, rect, { allowOutside: true });

  let upX = (elevatedPoint?.x ?? playerPoint.x) - playerPoint.x;
  let upY = (elevatedPoint?.y ?? playerPoint.y - 1) - playerPoint.y;
  const upLength = Math.hypot(upX, upY);
  if (upLength < 0.001) {
    upX = 0;
    upY = -1;
  } else {
    upX /= upLength;
    upY /= upLength;
  }

  const offset = markerOffsetPixels(rect.height);
  const x = playerPoint.x + upX * offset;
  const y = playerPoint.y + upY * offset;
  const towardCarX = -upX;
  const towardCarY = -upY;
  const rotation = Math.atan2(-towardCarX, towardCarY) * 180 / Math.PI;

  return { playerPoint, x, y, rotation };
}

function installStyles() {
  if (document.querySelector('#turn-player-marker-r427-styles')) return;
  const style = document.createElement('style');
  style.id = 'turn-player-marker-r427-styles';
  style.textContent = `
    .turn-player-marker {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 4;
      width: clamp(34px, 9vh, 46px);
      height: clamp(34px, 9vh, 46px);
      pointer-events: none;
      transform-origin: 50% 50%;
      will-change: left, top, transform;
    }

    .turn-player-marker[hidden] {
      display: none;
    }

    .turn-player-marker svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .turn-player-marker path {
      fill: var(--turn-action-information, #38d9ff);
      stroke: #08090a;
      stroke-width: 6;
      stroke-linejoin: round;
    }

    .m8-player-marker-setting {
      grid-column: 1 / -1;
    }

    .turn-player-marker-options {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 8px;
    }

    .turn-player-marker-options label {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      gap: 12px;
      min-width: 0;
      padding: 10px;
      border-radius: 14px;
      cursor: pointer;
    }

    .turn-player-marker-options strong,
    .turn-player-marker-options small {
      display: block;
    }

    .turn-player-marker-options small {
      margin-top: 2px;
      line-height: 1.3;
    }

    @media (max-width: 760px) and (orientation: portrait) {
      .turn-player-marker-options {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

function createMarkerElement() {
  const marker = document.createElement('div');
  marker.className = 'turn-player-marker';
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML = `
    <svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">
      <path d="M24 42 L5 7 L43 7 Z"></path>
    </svg>`;
  document.body.appendChild(marker);
  return marker;
}

function installSettings(modeApi) {
  const dialog = document.querySelector('.m8-settings-dialog');
  if (!dialog) return false;
  if (dialog.querySelector('.m8-player-marker-setting')) return true;

  const fieldset = document.createElement('fieldset');
  fieldset.className = 'm8-setting-card m8-player-marker-setting';
  fieldset.innerHTML = `
    <legend>Player marker</legend>
    <div class="turn-player-marker-options">
      <label>
        <input type="radio" name="turnPlayerMarkerMode" value="on">
        <span><strong>On</strong><small>Always show the marker above your car while racing.</small></span>
      </label>
      <label>
        <input type="radio" name="turnPlayerMarkerMode" value="auto">
        <span><strong>Auto</strong><small>Show the marker only when another car is close.</small></span>
      </label>
      <label>
        <input type="radio" name="turnPlayerMarkerMode" value="off">
        <span><strong>Off</strong><small>Never show the player marker.</small></span>
      </label>
    </div>`;

  const records = dialog.querySelector('.m8-record-setting');
  if (records) records.insertAdjacentElement('beforebegin', fieldset);
  else dialog.querySelector('.m8-settings-list')?.appendChild(fieldset);

  const radios = [...fieldset.querySelectorAll('input[type="radio"]')];
  const status = dialog.querySelector('.m8-settings-status');

  function sync() {
    const mode = modeApi.getMode();
    for (const radio of radios) radio.checked = radio.value === mode;
  }

  for (const radio of radios) {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      const mode = modeApi.setMode(radio.value);
      sync();
      if (status) status.textContent = `Player marker ${mode === 'auto' ? 'set to auto' : mode}.`;
    });
  }

  dialog.addEventListener('toggle', sync);
  window.addEventListener('turn:player-marker-mode-change', sync);
  sync();
  return true;
}

function observeSettings(modeApi) {
  if (installSettings(modeApi)) return null;
  if (typeof MutationObserver !== 'function') return null;

  const observer = new MutationObserver(() => {
    if (!installSettings(modeApi)) return;
    observer.disconnect();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

function installRuntime(runtime, modeApi) {
  if (!runtime || runtime.__playerMarkerR427Installed) return runtime?.__playerMarkerR427Installed || null;
  runtime.__playerMarkerR427Installed = true;

  installStyles();
  const marker = createMarkerElement();
  let autoVisible = false;
  let rect = null;
  let frame = 0;
  let blankOverlay = null;

  function measure() {
    const canvas = runtime.renderer?.domElement;
    rect = canvas?.getBoundingClientRect?.() || null;
  }

  function raceActive() {
    if (runtime.state?.running !== true) return false;
    if (runtime.state?.mode === runtime.GAME_MODE?.SPECTATING) return false;
    blankOverlay ||= document.querySelector('.turn-screen-blank-overlay');
    if (blankOverlay && !blankOverlay.hidden) return false;
    if (document.querySelector('.m8-settings-dialog[open]')) return false;
    return true;
  }

  function render() {
    frame = requestAnimationFrame(render);
    const active = raceActive();
    if (!active) {
      autoVisible = false;
      marker.hidden = true;
      return;
    }

    if (!rect?.width || !rect?.height) measure();
    if (!rect?.width || !rect?.height) {
      marker.hidden = true;
      return;
    }

    const pose = playerMarkerPose(runtime, rect);
    if (!pose) {
      marker.hidden = true;
      return;
    }

    const nearestRivalPixels = nearestVisibleRivalPixels(runtime, pose.playerPoint, rect);
    const mode = modeApi.getMode();
    const visible = shouldShowPlayerMarker({
      mode,
      raceActive: active,
      nearestRivalPixels,
      autoWasVisible: autoVisible,
      viewportHeight: rect.height
    });
    autoVisible = mode === PLAYER_MARKER_MODE.AUTO && visible;

    marker.hidden = !visible;
    if (!visible) return;

    marker.style.left = `${pose.x.toFixed(1)}px`;
    marker.style.top = `${pose.y.toFixed(1)}px`;
    marker.style.transform = `translate(-50%, -50%) rotate(${pose.rotation.toFixed(2)}deg)`;
  }

  const refreshMeasurement = () => {
    rect = null;
  };
  window.addEventListener('resize', refreshMeasurement, { passive: true });
  window.addEventListener('orientationchange', refreshMeasurement, { passive: true });
  window.addEventListener('pageshow', refreshMeasurement, { passive: true });
  window.visualViewport?.addEventListener('resize', refreshMeasurement, { passive: true });
  document.addEventListener('fullscreenchange', refreshMeasurement, { passive: true });
  document.addEventListener('webkitfullscreenchange', refreshMeasurement, { passive: true });

  measure();
  frame = requestAnimationFrame(render);

  const controller = Object.freeze({
    marker,
    refreshMeasurement,
    stop() {
      cancelAnimationFrame(frame);
      marker.remove();
    }
  });
  runtime.__playerMarkerR427Installed = controller;
  return controller;
}

function bootstrap() {
  let mode = loadMode();
  const modeApi = Object.freeze({
    getMode() {
      return mode;
    },
    setMode(nextMode) {
      mode = saveMode(nextMode);
      window.dispatchEvent(new CustomEvent('turn:player-marker-mode-change', {
        detail: { mode }
      }));
      return mode;
    }
  });

  globalThis.__turnPlayerMarker = modeApi;
  installStyles();
  observeSettings(modeApi);

  if (globalThis.__turnRuntime) {
    installRuntime(globalThis.__turnRuntime, modeApi);
  } else {
    window.addEventListener('turn:runtime-ready', (event) => {
      installRuntime(event.detail || globalThis.__turnRuntime, modeApi);
    }, { once: true });
  }
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  bootstrap();
}
