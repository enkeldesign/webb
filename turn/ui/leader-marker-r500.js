import * as THREE from 'three';
import './player-marker-r428.js?revision=r227-night-marker-outline';

const LEADER_MARKER_SIZE_VIEWPORT_RATIO = 0.032;
const LEADER_MARKER_SIZE_MIN_PX = 12;
const LEADER_MARKER_SIZE_MAX_PX = 17;
const LEADER_MARKER_GAP_PX = 10;
const LEADER_VISUAL_RANGE_SHOW_PX = 6;
const LEADER_VISUAL_RANGE_HIDE_PX = 9;
const LEADER_PROGRESS_EPSILON = 0.002;
const LEADER_CHECK_INTERVAL_MS = 50;
const FALLBACK_ROOF_HEIGHT = 1.8;
const FALLBACK_MARKER_COLOR = '#38d9ff';
const DARK_MARKER_OUTLINE = '#08090a';
const LIGHT_MARKER_OUTLINE = '#ffffff';
const LIGHT_OUTLINE_TRACKS = new Set(['midnight-city', 'mountain']);
const FIXED_LIVERY_MARKER_COLORS = Object.freeze({
  firetruck: '#d92d20',
  police: '#0b0d10',
  ambulance: '#f8f9fa'
});
const LEGACY_RIVAL_COLORS = Object.freeze(['#38d9ff', '#ff4fa3', '#9775fa', '#ff922b']);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function markerSizePixels(viewportHeight) {
  return clamp(
    (Number(viewportHeight) || 0) * LEADER_MARKER_SIZE_VIEWPORT_RATIO,
    LEADER_MARKER_SIZE_MIN_PX,
    LEADER_MARKER_SIZE_MAX_PX
  );
}

export function leaderMarkerOutlineColor(trackId) {
  return LIGHT_OUTLINE_TRACKS.has(String(trackId || '').toLowerCase())
    ? LIGHT_MARKER_OUTLINE
    : DARK_MARKER_OUTLINE;
}

export function leaderMarkerNeedsHelp(apparentRoofPixels, wasVisible = false) {
  const threshold = wasVisible ? LEADER_VISUAL_RANGE_HIDE_PX : LEADER_VISUAL_RANGE_SHOW_PX;
  return Number(apparentRoofPixels) <= threshold;
}

export function leaderMarkerColor(lap, car, index = 0) {
  const carId = lap?.carId || car?.userData?.turnCarId;
  const fixedLiveryColor = FIXED_LIVERY_MARKER_COLORS[carId];
  if (fixedLiveryColor) return fixedLiveryColor;

  const color = lap?.carColor || car?.userData?.turnCarColor;
  return typeof color === 'string' && color.trim()
    ? color.trim()
    : LEGACY_RIVAL_COLORS[index] || FALLBACK_MARKER_COLOR;
}

export function leadingRival(runtime) {
  const state = runtime?.state;
  const elapsed = Number(state?.lapElapsed);
  const playerProgress = Number(state?.progress);
  const laps = state?.competitorLaps || [];
  if (!state?.lapActive || !Number.isFinite(elapsed) || !Number.isFinite(playerProgress)) return null;

  let leader = null;
  for (let index = 0; index < laps.length; index += 1) {
    const lap = laps[index];
    const lapTime = Number(lap?.time);
    if (!Number.isFinite(lapTime) || lapTime <= 0) continue;

    const frame = runtime?.lapFrameAt?.(lap, elapsed);
    const progress = Number(frame?.p);
    if (!Number.isFinite(progress)) continue;

    const completedLaps = Math.floor(elapsed / lapTime);
    const raceProgress = completedLaps + progress;
    if (!leader || raceProgress > leader.raceProgress) {
      leader = {
        index,
        lap,
        car: runtime?.competitorCars?.[index] || null,
        frame,
        progress,
        completedLaps,
        raceProgress
      };
    }
  }

  // Once the actual leader has finished this timed lap there is no longer a
  // physical car ahead to mark; do not silently switch the marker to P2.
  if (!leader || leader.completedLaps > 0) return null;
  if (leader.raceProgress <= playerProgress + LEADER_PROGRESS_EPSILON) return null;
  return leader;
}

function installStyles() {
  if (document.querySelector('#turn-leader-marker-r500-styles')) return;
  const style = document.createElement('style');
  style.id = 'turn-leader-marker-r500-styles';
  style.textContent = `
    .turn-leader-marker {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 4;
      width: clamp(${LEADER_MARKER_SIZE_MIN_PX}px, 3.2vh, ${LEADER_MARKER_SIZE_MAX_PX}px);
      height: clamp(${LEADER_MARKER_SIZE_MIN_PX}px, 3.2vh, ${LEADER_MARKER_SIZE_MAX_PX}px);
      pointer-events: none;
      transform-origin: 50% 50%;
      will-change: left, top, transform;
    }

    .turn-leader-marker[hidden] {
      display: none;
    }

    .turn-leader-marker svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .turn-leader-marker path {
      fill: var(--turn-leader-marker-color, ${FALLBACK_MARKER_COLOR});
      stroke: var(--turn-leader-marker-outline, ${DARK_MARKER_OUTLINE});
      stroke-width: 2.5px;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
  `;
  document.head.appendChild(style);
}

function createMarkerElement() {
  const marker = document.createElement('div');
  marker.className = 'turn-leader-marker';
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
  if (!allowOutside && (Math.abs(projected.x) > 1.08 || Math.abs(projected.y) > 1.08)) return null;

  return {
    x: rect.left + (projected.x + 1) * rect.width * 0.5,
    y: rect.top + (1 - projected.y) * rect.height * 0.5
  };
}

function markerPose(car, camera, rect, roofHeight) {
  const position = car?.position;
  if (!position || !camera) return null;

  const carPoint = screenPoint(position, camera, rect);
  if (!carPoint) return null;

  const roofPosition = position.clone();
  roofPosition.y += roofHeight;
  const roofPoint = screenPoint(roofPosition, camera, rect, { allowOutside: true });
  if (!roofPoint) return null;

  let upX = roofPoint.x - carPoint.x;
  let upY = roofPoint.y - carPoint.y;
  const apparentRoofPixels = Math.hypot(upX, upY);
  if (apparentRoofPixels < 0.001) {
    upX = 0;
    upY = -1;
  } else {
    upX /= apparentRoofPixels;
    upY /= apparentRoofPixels;
  }

  const centerGap = LEADER_MARKER_GAP_PX + markerSizePixels(rect.height) * 0.5;
  const x = roofPoint.x + upX * centerGap;
  const y = roofPoint.y + upY * centerGap;
  const rotation = Math.atan2(upX, -upY) * 180 / Math.PI;
  return { x, y, rotation, apparentRoofPixels };
}

function carRoofHeight(car, roofCache) {
  if (!car?.position) return FALLBACK_ROOF_HEIGHT;
  const model = car.children?.find((child) => child.userData?.turnAssetVisual)
    || car.children?.find((child) => child.visible !== false);
  if (!model) return FALLBACK_ROOF_HEIGHT;

  const cached = roofCache.get(car);
  if (cached?.model === model) return cached.height;

  let height = FALLBACK_ROOF_HEIGHT;
  try {
    const bounds = new THREE.Box3().setFromObject(model);
    const measured = bounds.max.y - car.position.y;
    if (Number.isFinite(measured) && measured > 0.4 && measured < 6) height = measured;
  } catch (_) {}

  roofCache.set(car, { model, height });
  return height;
}

function installRuntime(runtime) {
  if (!runtime || runtime.__leaderMarkerR500Installed) return runtime?.__leaderMarkerR500Installed || null;

  installStyles();
  const marker = createMarkerElement();
  const roofCache = new WeakMap();
  let rect = null;
  let frame = 0;
  let blankOverlay = null;
  let leader = null;
  let nextLeaderCheckAt = 0;
  let visualHelpActive = false;
  let lastLeaderIndex = -1;
  let lastColor = '';
  let lastOutlineColor = '';

  function measure() {
    rect = runtime.renderer?.domElement?.getBoundingClientRect?.() || null;
  }

  function raceActive() {
    if (runtime.state?.running !== true || runtime.state?.lapActive !== true) return false;
    if (runtime.state?.mode === runtime.GAME_MODE?.SPECTATING) return false;
    blankOverlay ||= document.querySelector('.turn-screen-blank-overlay');
    if (blankOverlay && !blankOverlay.hidden) return false;
    if (document.querySelector('.m8-settings-dialog[open]')) return false;
    return true;
  }

  function refreshLeader(now) {
    if (now < nextLeaderCheckAt) return;
    nextLeaderCheckAt = now + LEADER_CHECK_INTERVAL_MS;
    const nextLeader = leadingRival(runtime);
    if (nextLeader?.index !== lastLeaderIndex) visualHelpActive = false;
    leader = nextLeader;
    lastLeaderIndex = nextLeader?.index ?? -1;
  }

  function hide() {
    marker.hidden = true;
    visualHelpActive = false;
  }

  function render(now) {
    frame = requestAnimationFrame(render);
    if (!raceActive()) {
      leader = null;
      nextLeaderCheckAt = 0;
      lastLeaderIndex = -1;
      hide();
      return;
    }

    refreshLeader(now);
    const car = leader?.car;
    if (!leader || !car?.visible || !car.position) {
      hide();
      return;
    }

    if (!rect?.width || !rect?.height) measure();
    if (!rect?.width || !rect?.height) {
      hide();
      return;
    }

    const pose = markerPose(car, runtime.camera, rect, carRoofHeight(car, roofCache));
    if (!pose) {
      hide();
      return;
    }

    visualHelpActive = leaderMarkerNeedsHelp(pose.apparentRoofPixels, visualHelpActive);
    marker.hidden = !visualHelpActive;
    if (!visualHelpActive) return;

    const color = leaderMarkerColor(leader.lap, car, leader.index);
    if (color !== lastColor) {
      marker.style.setProperty('--turn-leader-marker-color', color);
      lastColor = color;
    }

    const outlineColor = leaderMarkerOutlineColor(runtime.state?.trackId);
    if (outlineColor !== lastOutlineColor) {
      marker.style.setProperty('--turn-leader-marker-outline', outlineColor);
      lastOutlineColor = outlineColor;
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
    stop() {
      cancelAnimationFrame(frame);
      marker.remove();
    }
  });
  runtime.__leaderMarkerR500Installed = controller;
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
