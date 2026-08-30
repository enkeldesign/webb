import * as THREE from 'three';
import { playerMarkerOutlineColor } from './player-marker-r428.js?revision=r227-night-marker-outline';

const STYLE_ID = 'turn-minor-ux-polish-r229-styles';
const PERK_ATTENTION_STORAGE_KEY = 'turn-perk-first-encounter-seen-v1';
const FALLBACK_MARKER_COLOR = '#38d9ff';
const FALLBACK_ROOF_HEIGHT = 1.8;
const MARKER_GAP_PX = 20;
const FIXED_LIVERY_MARKER_COLORS = Object.freeze({
  firetruck: '#d92d20',
  police: '#0b0d10',
  ambulance: '#f8f9fa'
});

let perkAttentionSeenThisSession = false;

function installStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .turn-achievements-filters button[data-achievement-filter="new"] {
      position: relative;
      overflow: visible;
    }

    .turn-achievements-filters button[data-achievement-filter="new"][aria-pressed="true"]:not(:disabled)::after {
      content: "";
      position: absolute;
      z-index: 3;
      top: -9px;
      right: -9px;
      width: 16px;
      height: 16px;
      box-sizing: border-box;
      border: 3px solid var(--turn-ink, #08090a);
      border-radius: 50%;
      background: var(--turn-action-warning, #ffd43b);
      box-shadow: 2px 2px 0 var(--turn-ink, #08090a);
      pointer-events: none;
    }

    .lot-showroom .lot-perk-button.turn-first-perk-attention {
      animation: turn-first-perk-attention 620ms cubic-bezier(.2,.85,.25,1.15) 2;
      transform-origin: 50% 50%;
    }

    @keyframes turn-first-perk-attention {
      0%, 100% { transform: rotate(0deg) scale(1); }
      25% { transform: rotate(-4deg) scale(1.08); }
      50% { transform: rotate(4deg) scale(1.08); }
      75% { transform: rotate(-2deg) scale(1.04); }
    }

    .turn-spectate-player-marker {
      z-index: 22;
    }

    @media (prefers-reduced-motion: reduce) {
      .lot-showroom .lot-perk-button.turn-first-perk-attention {
        animation: none;
        outline: 5px solid var(--turn-action-warning, #ffd43b);
        outline-offset: 4px;
      }
    }
  `;
  document.head.appendChild(style);
}

function perkAttentionWasSeen() {
  if (perkAttentionSeenThisSession) return true;
  try {
    return globalThis.localStorage?.getItem(PERK_ATTENTION_STORAGE_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function markPerkAttentionSeen() {
  perkAttentionSeenThisSession = true;
  try {
    globalThis.localStorage?.setItem(PERK_ATTENTION_STORAGE_KEY, '1');
  } catch (_) {}
}

function installFirstPerkAttention() {
  if (perkAttentionWasSeen() || typeof MutationObserver !== 'function') return null;

  let queued = false;
  let observer = null;

  function findAvailablePerkButton() {
    return document.querySelector(
      '.lot-showroom .lot-perk-button:not(.is-layout-placeholder):not(:disabled)'
    );
  }

  function showAttention(trigger) {
    if (!trigger || perkAttentionWasSeen()) return false;
    markPerkAttentionSeen();
    observer?.disconnect();
    requestAnimationFrame(() => {
      if (!trigger.isConnected) return;
      trigger.classList.add('turn-first-perk-attention');
      const clear = () => trigger.classList.remove('turn-first-perk-attention');
      trigger.addEventListener('animationend', clear, { once: true });
      globalThis.setTimeout?.(clear, 1700);
    });
    return true;
  }

  function check() {
    queued = false;
    const trigger = findAvailablePerkButton();
    if (trigger) showAttention(trigger);
  }

  function queueCheck() {
    if (queued || perkAttentionWasSeen()) return;
    queued = true;
    queueMicrotask(check);
  }

  observer = new MutationObserver(queueCheck);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'disabled']
  });
  check();
  return observer;
}

function createSpectateMarker() {
  const marker = document.createElement('div');
  marker.className = 'turn-player-marker turn-spectate-player-marker';
  marker.hidden = true;
  marker.setAttribute('aria-hidden', 'true');
  marker.innerHTML = `
    <svg viewBox="0 0 48 48" focusable="false" aria-hidden="true">
      <path d="M24 42 L5 7 L43 7 Z"></path>
    </svg>`;
  document.body.appendChild(marker);
  return marker;
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
    y: rect.top + (1 - projected.y) * rect.height * 0.5
  };
}

function markerSizePixels(rect) {
  return Math.min(23, Math.max(17, (Number(rect?.height) || 0) * 0.045));
}

function carRoofHeight(car) {
  if (!car?.position) return FALLBACK_ROOF_HEIGHT;
  try {
    const bounds = new THREE.Box3().setFromObject(car);
    const height = bounds.max.y - car.position.y;
    if (Number.isFinite(height) && height > 0.4 && height < 6) return height;
  } catch (_) {}
  return FALLBACK_ROOF_HEIGHT;
}

function spectateMarkerPose(car, camera, rect, roofHeight) {
  if (!car?.position || !camera) return null;
  const carPoint = screenPoint(car.position, camera, rect);
  if (!carPoint) return null;

  const roof = car.position.clone();
  roof.y += roofHeight;
  const roofPoint = screenPoint(roof, camera, rect, { allowOutside: true });
  if (!roofPoint) return null;

  let upX = roofPoint.x - carPoint.x;
  let upY = roofPoint.y - carPoint.y;
  const length = Math.hypot(upX, upY);
  if (length < 0.001) {
    upX = 0;
    upY = -1;
  } else {
    upX /= length;
    upY /= length;
  }

  const centerGap = MARKER_GAP_PX + markerSizePixels(rect) * 0.5;
  return {
    x: roofPoint.x + upX * centerGap,
    y: roofPoint.y + upY * centerGap,
    rotation: Math.atan2(upX, -upY) * 180 / Math.PI
  };
}

function spectatedMarkerColor(runtime, index) {
  const lap = runtime?.state?.competitorLaps?.[index];
  const carId = lap?.carId || '';
  const fixed = FIXED_LIVERY_MARKER_COLORS[carId];
  if (fixed) return fixed;
  return typeof lap?.carColor === 'string' && lap.carColor.trim()
    ? lap.carColor.trim()
    : FALLBACK_MARKER_COLOR;
}

function installSpectatePlayerMarker(runtime) {
  if (!runtime || runtime.__minorUxSpectateMarkerR229) {
    return runtime?.__minorUxSpectateMarkerR229 || null;
  }

  const marker = createSpectateMarker();
  let frame = 0;
  let rect = null;
  let metricCar = null;
  let metricVisualKey = '';
  let roofHeight = FALLBACK_ROOF_HEIGHT;

  function measure() {
    rect = runtime.renderer?.domElement?.getBoundingClientRect?.() || null;
  }

  function render() {
    frame = requestAnimationFrame(render);
    const current = globalThis.__turnGetSpectateV3State?.();
    if (!current?.active) {
      marker.hidden = true;
      return;
    }

    const car = runtime.competitorCars?.[current.index];
    if (!car?.visible) {
      marker.hidden = true;
      return;
    }

    if (!rect?.width || !rect?.height) measure();
    if (!rect?.width || !rect?.height) {
      marker.hidden = true;
      return;
    }

    const visualKey = car.userData?.turnVisualKey || '';
    if (car !== metricCar || visualKey !== metricVisualKey) {
      metricCar = car;
      metricVisualKey = visualKey;
      roofHeight = carRoofHeight(car);
    }

    const pose = spectateMarkerPose(car, runtime.camera, rect, roofHeight);
    if (!pose) {
      marker.hidden = true;
      return;
    }

    marker.style.setProperty('--turn-player-marker-color', spectatedMarkerColor(runtime, current.index));
    marker.style.setProperty(
      '--turn-player-marker-outline',
      playerMarkerOutlineColor(runtime.state?.trackId)
    );
    marker.style.left = `${pose.x.toFixed(1)}px`;
    marker.style.top = `${pose.y.toFixed(1)}px`;
    marker.style.transform = `translate(-50%, -50%) rotate(${pose.rotation.toFixed(2)}deg)`;
    marker.hidden = false;
  }

  const invalidateMeasurement = () => {
    rect = null;
  };
  globalThis.addEventListener?.('resize', invalidateMeasurement, { passive: true });
  globalThis.addEventListener?.('orientationchange', invalidateMeasurement, { passive: true });
  globalThis.visualViewport?.addEventListener?.('resize', invalidateMeasurement, { passive: true });

  measure();
  frame = requestAnimationFrame(render);
  const api = Object.freeze({
    marker,
    stop() {
      cancelAnimationFrame(frame);
      marker.remove();
      globalThis.removeEventListener?.('resize', invalidateMeasurement);
      globalThis.removeEventListener?.('orientationchange', invalidateMeasurement);
      globalThis.visualViewport?.removeEventListener?.('resize', invalidateMeasurement);
    }
  });
  runtime.__minorUxSpectateMarkerR229 = api;
  return api;
}

function installSpectateMarkerWhenReady() {
  if (globalThis.__turnRuntime) return installSpectatePlayerMarker(globalThis.__turnRuntime);
  globalThis.addEventListener?.('turn:runtime-ready', (event) => {
    installSpectatePlayerMarker(event.detail || globalThis.__turnRuntime);
  }, { once: true });
  return null;
}

function bootstrap() {
  installStyles();
  installFirstPerkAttention();
  installSpectateMarkerWhenReady();
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') bootstrap();

export {
  PERK_ATTENTION_STORAGE_KEY,
  spectatedMarkerColor
};
