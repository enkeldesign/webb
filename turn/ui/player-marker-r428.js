import * as THREE from 'three';
import './player-marker-r427.js?revision=r427';

const REFERENCE_CAR_LENGTH = 5.4;
const AUTO_ACTIVATION_DIAMETER_CAR_LENGTHS = 3;
const AUTO_ACTIVATION_RADIUS = REFERENCE_CAR_LENGTH * AUTO_ACTIVATION_DIAMETER_CAR_LENGTHS / 2;
const AUTO_ACTIVATION_RADIUS_SQUARED = AUTO_ACTIVATION_RADIUS * AUTO_ACTIVATION_RADIUS;
const AUTO_EXIT_GRACE_MS = 220;
const AUTO_CHECK_INTERVAL_MS = 50;
const MARKER_GAP_PX = 8;
const MARKER_SIZE_VIEWPORT_RATIO = 0.045;
const MARKER_SIZE_MIN_PX = 17;
const MARKER_SIZE_MAX_PX = 23;
const FALLBACK_ROOF_HEIGHT = 1.8;
const FALLBACK_MARKER_COLOR = '#38d9ff';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function markerSizePixels(viewportHeight) {
  return clamp(
    (Number(viewportHeight) || 0) * MARKER_SIZE_VIEWPORT_RATIO,
    MARKER_SIZE_MIN_PX,
    MARKER_SIZE_MAX_PX
  );
}

function installStyles() {
  if (document.querySelector('#turn-player-marker-r428-styles')) return;
  const style = document.createElement('style');
  style.id = 'turn-player-marker-r428-styles';
  style.textContent = `
    .turn-player-marker {
      width: clamp(${MARKER_SIZE_MIN_PX}px, 4.5vh, ${MARKER_SIZE_MAX_PX}px);
      height: clamp(${MARKER_SIZE_MIN_PX}px, 4.5vh, ${MARKER_SIZE_MAX_PX}px);
    }

    .turn-player-marker path {
      fill: var(--turn-player-marker-color, ${FALLBACK_MARKER_COLOR});
      stroke-width: 2.5px;
      vector-effect: non-scaling-stroke;
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

function markerPose(runtime, rect, roofHeight) {
  const position = runtime?.playerCar?.position;
  const camera = runtime?.camera;
  if (!position || !camera) return null;

  const playerPoint = screenPoint(position, camera, rect);
  if (!playerPoint) return null;

  const roofPosition = position.clone();
  roofPosition.y += roofHeight;
  const roofPoint = screenPoint(roofPosition, camera, rect, { allowOutside: true });
  if (!roofPoint) return null;

  let upX = roofPoint.x - playerPoint.x;
  let upY = roofPoint.y - playerPoint.y;
  const upLength = Math.hypot(upX, upY);
  if (upLength < 0.001) {
    upX = 0;
    upY = -1;
  } else {
    upX /= upLength;
    upY /= upLength;
  }

  // Standard overhead-marker treatment: anchor at the top of the vehicle silhouette,
  // then leave one small, constant visual gap. This keeps the marker associated with
  // the car without covering it, independent of FOV, speed or viewport height.
  const centerGap = MARKER_GAP_PX + markerSizePixels(rect.height) * 0.5;
  const x = roofPoint.x + upX * centerGap;
  const y = roofPoint.y + upY * centerGap;
  const rotation = Math.atan2(upX, -upY) * 180 / Math.PI;
  return { x, y, rotation };
}

function playerModelRoofHeight(runtime) {
  const car = runtime?.playerCar;
  const model = car?.children?.[0];
  if (!car?.position || !model) return FALLBACK_ROOF_HEIGHT;

  try {
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - car.position.y;
    if (Number.isFinite(height) && height > 0.4 && height < 6) return height;
  } catch (_) {}
  return FALLBACK_ROOF_HEIGHT;
}

function nearestRivalWorldDistanceSquared(runtime) {
  if (!runtime?.state?.lapActive || !runtime?.playerCar?.position) return Infinity;
  const player = runtime.playerCar.position;
  let nearestSquared = Infinity;

  for (const car of runtime.competitorCars || []) {
    if (!car?.visible || !car.position) continue;
    const dx = car.position.x - player.x;
    const dz = car.position.z - player.z;
    nearestSquared = Math.min(nearestSquared, dx * dx + dz * dz);
  }

  return nearestSquared;
}

export function nearestRivalWorldDistance(runtime) {
  const squared = nearestRivalWorldDistanceSquared(runtime);
  return Number.isFinite(squared) ? Math.sqrt(squared) : Infinity;
}

export function playerMarkerAutoActive(distance) {
  return Number(distance) <= AUTO_ACTIVATION_RADIUS;
}

export function playerMarkerColor(runtime) {
  const color = runtime?.playerCar?.userData?.turnCarColor || runtime?.state?.vehicleColor;
  return typeof color === 'string' && color.trim() ? color.trim() : FALLBACK_MARKER_COLOR;
}

function installRuntime(runtime) {
  if (!runtime || runtime.__playerMarkerR429Installed) return runtime?.__playerMarkerR429Installed || null;

  runtime.__playerMarkerR427Installed?.stop?.();
  runtime.__playerMarkerR428Installed?.stop?.();
  installStyles();

  const marker = createMarkerElement();
  let rect = null;
  let frame = 0;
  let blankOverlay = null;
  let autoVisibleUntil = 0;
  let nextAutoCheckAt = 0;
  let autoNearby = false;
  let lastColor = '';
  let lastCarId = null;
  let roofHeight = FALLBACK_ROOF_HEIGHT;

  function measure() {
    rect = runtime.renderer?.domElement?.getBoundingClientRect?.() || null;
  }

  function refreshCarMetrics() {
    const carId = runtime.playerCar?.userData?.turnCarId || runtime.state?.vehicleId || null;
    if (carId === lastCarId) return;
    lastCarId = carId;
    roofHeight = playerModelRoofHeight(runtime);
  }

  function raceActive() {
    if (runtime.state?.running !== true) return false;
    if (runtime.state?.mode === runtime.GAME_MODE?.SPECTATING) return false;
    blankOverlay ||= document.querySelector('.turn-screen-blank-overlay');
    if (blankOverlay && !blankOverlay.hidden) return false;
    if (document.querySelector('.m8-settings-dialog[open]')) return false;
    return true;
  }

  function updateAuto(now) {
    if (now < nextAutoCheckAt) return;
    nextAutoCheckAt = now + AUTO_CHECK_INTERVAL_MS;
    autoNearby = nearestRivalWorldDistanceSquared(runtime) <= AUTO_ACTIVATION_RADIUS_SQUARED;
    if (autoNearby) autoVisibleUntil = now + AUTO_EXIT_GRACE_MS;
  }

  function render(now) {
    frame = requestAnimationFrame(render);
    const active = raceActive();
    if (!active) {
      autoVisibleUntil = 0;
      autoNearby = false;
      nextAutoCheckAt = 0;
      marker.hidden = true;
      return;
    }

    const mode = globalThis.__turnPlayerMarker?.getMode?.() || 'auto';
    let visible = mode === 'on';

    if (mode === 'auto') {
      updateAuto(now);
      visible = autoNearby || now < autoVisibleUntil;
    } else {
      autoVisibleUntil = 0;
      autoNearby = false;
      nextAutoCheckAt = 0;
    }

    if (mode === 'off') visible = false;
    marker.hidden = !visible;
    if (!visible) return;

    if (!rect?.width || !rect?.height) measure();
    if (!rect?.width || !rect?.height) {
      marker.hidden = true;
      return;
    }

    refreshCarMetrics();
    const pose = markerPose(runtime, rect, roofHeight);
    if (!pose) {
      marker.hidden = true;
      return;
    }

    const color = playerMarkerColor(runtime);
    if (color !== lastColor) {
      marker.style.setProperty('--turn-player-marker-color', color);
      lastColor = color;
    }

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
  refreshCarMetrics();
  frame = requestAnimationFrame(render);

  const controller = Object.freeze({
    marker,
    activationRadius: AUTO_ACTIVATION_RADIUS,
    markerGapPixels: MARKER_GAP_PX,
    stop() {
      cancelAnimationFrame(frame);
      marker.remove();
    }
  });
  runtime.__playerMarkerR429Installed = controller;
  return controller;
}

function bootstrap() {
  installStyles();
  if (globalThis.__turnRuntime) {
    installRuntime(globalThis.__turnRuntime);
    return;
  }
  window.addEventListener('turn:runtime-ready', (event) => {
    installRuntime(event.detail || globalThis.__turnRuntime);
  }, { once: true });
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') bootstrap();
