import './player-marker-r427.js?revision=r427';

const REFERENCE_CAR_LENGTH = 5.4;
const AUTO_ACTIVATION_DIAMETER_CAR_LENGTHS = 3;
const AUTO_ACTIVATION_RADIUS = REFERENCE_CAR_LENGTH * AUTO_ACTIVATION_DIAMETER_CAR_LENGTHS / 2;
const AUTO_EXIT_GRACE_MS = 220;
const MARKER_WORLD_UP_SAMPLE = 3;
const MARKER_OFFSET_VIEWPORT_RATIO = 0.13;
const MARKER_OFFSET_MIN_PX = 44;
const MARKER_OFFSET_MAX_PX = 78;
const FALLBACK_MARKER_COLOR = '#38d9ff';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function installStyles() {
  if (document.querySelector('#turn-player-marker-r428-styles')) return;
  const style = document.createElement('style');
  style.id = 'turn-player-marker-r428-styles';
  style.textContent = `
    .turn-player-marker {
      width: clamp(17px, 4.5vh, 23px);
      height: clamp(17px, 4.5vh, 23px);
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

function markerPose(runtime, rect) {
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

  const offset = clamp(
    rect.height * MARKER_OFFSET_VIEWPORT_RATIO,
    MARKER_OFFSET_MIN_PX,
    MARKER_OFFSET_MAX_PX
  );
  const x = playerPoint.x + upX * offset;
  const y = playerPoint.y + upY * offset;
  const rotation = Math.atan2(upX, -upY) * 180 / Math.PI;
  return { x, y, rotation };
}

export function nearestRivalWorldDistance(runtime) {
  if (!runtime?.state?.lapActive || !runtime?.playerCar?.position) return Infinity;
  const player = runtime.playerCar.position;
  let nearestSquared = Infinity;

  for (const car of runtime.competitorCars || []) {
    if (!car?.visible || !car.position) continue;
    const dx = car.position.x - player.x;
    const dz = car.position.z - player.z;
    nearestSquared = Math.min(nearestSquared, dx * dx + dz * dz);
  }

  return Number.isFinite(nearestSquared) ? Math.sqrt(nearestSquared) : Infinity;
}

export function playerMarkerAutoActive(distance) {
  return Number(distance) <= AUTO_ACTIVATION_RADIUS;
}

export function playerMarkerColor(runtime) {
  const color = runtime?.playerCar?.userData?.turnCarColor || runtime?.state?.vehicleColor;
  return typeof color === 'string' && color.trim() ? color.trim() : FALLBACK_MARKER_COLOR;
}

function installRuntime(runtime) {
  if (!runtime || runtime.__playerMarkerR428Installed) return runtime?.__playerMarkerR428Installed || null;

  runtime.__playerMarkerR427Installed?.stop?.();
  installStyles();

  const marker = createMarkerElement();
  let rect = null;
  let frame = 0;
  let blankOverlay = null;
  let autoVisibleUntil = 0;
  let lastColor = '';

  function measure() {
    rect = runtime.renderer?.domElement?.getBoundingClientRect?.() || null;
  }

  function raceActive() {
    if (runtime.state?.running !== true) return false;
    if (runtime.state?.mode === runtime.GAME_MODE?.SPECTATING) return false;
    blankOverlay ||= document.querySelector('.turn-screen-blank-overlay');
    if (blankOverlay && !blankOverlay.hidden) return false;
    if (document.querySelector('.m8-settings-dialog[open]')) return false;
    return true;
  }

  function render(now) {
    frame = requestAnimationFrame(render);
    const active = raceActive();
    if (!active) {
      autoVisibleUntil = 0;
      marker.hidden = true;
      return;
    }

    if (!rect?.width || !rect?.height) measure();
    if (!rect?.width || !rect?.height) {
      marker.hidden = true;
      return;
    }

    const mode = globalThis.__turnPlayerMarker?.getMode?.() || 'auto';
    let visible = mode === 'on';

    if (mode === 'auto') {
      const nearby = playerMarkerAutoActive(nearestRivalWorldDistance(runtime));
      if (nearby) autoVisibleUntil = now + AUTO_EXIT_GRACE_MS;
      visible = nearby || now < autoVisibleUntil;
    } else {
      autoVisibleUntil = 0;
    }

    if (mode === 'off') visible = false;
    marker.hidden = !visible;
    if (!visible) return;

    const pose = markerPose(runtime, rect);
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
  frame = requestAnimationFrame(render);

  const controller = Object.freeze({
    marker,
    activationRadius: AUTO_ACTIVATION_RADIUS,
    stop() {
      cancelAnimationFrame(frame);
      marker.remove();
    }
  });
  runtime.__playerMarkerR428Installed = controller;
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
