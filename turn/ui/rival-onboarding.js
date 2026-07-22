import * as THREE from 'three';
import {
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  makeGhostColor,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?build=20260720-r19';
import { createCarVisual } from '../vehicle/car-models.js?build=20260720-r22';

const RESULT_TOAST_HANDOFF_MS = 4300;
const ONBOARDING_VISIBLE_MS = 3200;
const ONBOARDING_EXIT_MS = 180;
const VIEWER_INITIAL_YAW = Math.PI - 0.55;
const VIEWER_ROTATION_RADIANS_PER_SECOND = 0.144;
const VIEWER_FRAME_INTERVAL_MS = 1000 / 30;

export function installRivalOnboarding() {
  if (globalThis.__turnRivalOnboardingInstalled) return;
  globalThis.__turnRivalOnboardingInstalled = true;

  const hud = document.querySelector('#hud');
  if (!hud) return;

  const plate = document.createElement('div');
  plate.className = 'rival-onboarding';
  plate.hidden = true;
  plate.setAttribute('role', 'status');
  plate.setAttribute('aria-live', 'polite');
  plate.setAttribute('aria-atomic', 'true');

  const modelHost = document.createElement('div');
  modelHost.className = 'rival-onboarding-model';
  modelHost.setAttribute('aria-hidden', 'true');

  const copy = document.createElement('div');
  copy.className = 'rival-onboarding-copy';
  copy.textContent = 'CHASE YOUR BEST';

  plate.append(modelHost, copy);
  hud.appendChild(plate);

  let hadRival = false;
  let showTimer = 0;
  let hideTimer = 0;
  let exitTimer = 0;
  let preview = null;

  function clearTimers() {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    window.clearTimeout(exitTimer);
    showTimer = 0;
    hideTimer = 0;
    exitTimer = 0;
  }

  function destroyPreview() {
    preview?.dispose();
    preview = null;
    modelHost.replaceChildren();
    plate.classList.remove('is-model-unavailable');
  }

  function hide({ immediate = false } = {}) {
    clearTimers();
    if (plate.hidden) {
      destroyPreview();
      return;
    }

    if (immediate) {
      plate.hidden = true;
      plate.classList.remove('is-visible', 'is-leaving');
      destroyPreview();
      return;
    }

    plate.classList.remove('is-visible');
    plate.classList.add('is-leaving');
    exitTimer = window.setTimeout(() => {
      plate.hidden = true;
      plate.classList.remove('is-leaving');
      exitTimer = 0;
      destroyPreview();
    }, ONBOARDING_EXIT_MS);
  }

  function reveal() {
    clearTimers();
    plate.hidden = false;
    plate.classList.remove('is-visible', 'is-leaving');
    preview?.resize();
    preview?.start();
    void plate.offsetWidth;
    plate.classList.add('is-visible');
    hideTimer = window.setTimeout(() => hide(), ONBOARDING_VISIBLE_MS);
  }

  function schedule(rival) {
    clearTimers();
    destroyPreview();
    plate.hidden = true;
    plate.classList.remove('is-visible', 'is-leaving');

    const carId = rival?.carId || 'sedan';
    const color = normalizeVehicleColor(rival?.carColor || DEFAULT_VEHICLE_COLOR);
    const secondaryColor = normalizeVehicleSecondaryColor(
      rival?.carSecondaryColor || DEFAULT_VEHICLE_SECONDARY_COLOR
    );

    plate.style.setProperty('--rival-onboarding-color', makeGhostColor(color));
    preview = createGhostPreview({ modelHost, carId, color, secondaryColor, onError() {
      plate.classList.add('is-model-unavailable');
    } });

    showTimer = window.setTimeout(() => {
      showTimer = 0;
      reveal();
    }, RESULT_TOAST_HANDOFF_MS);
  }

  window.addEventListener('turn:rivals-reset', () => {
    hadRival = false;
    hide({ immediate: true });
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    const rivals = globalThis.__turnRuntime?.state?.competitorLaps || [];
    const hasRival = rivals.length > 0;

    if (reason === 'rivals-loaded' || reason === 'race-started') {
      hadRival = hasRival;
    } else if (reason === 'lap-completed') {
      if (!hadRival && hasRival) schedule(rivals[0]);
      hadRival = hasRival;
    }

    if (!event.detail?.running || reason === 'race-reset') {
      hide({ immediate: true });
    }
  });
}

function createGhostPreview({ modelHost, carId, color, secondaryColor, onError }) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.35));
  renderer.setClearColor(0x000000, 0);
  modelHost.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(7.8, 4.8, 8.8);
  camera.lookAt(0, 1.1, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5b6770, 3.2));
  const key = new THREE.DirectionalLight(0xfff2c9, 4.2);
  key.position.set(-6, 10, 7);
  scene.add(key);

  const stage = new THREE.Group();
  stage.rotation.y = VIEWER_INITIAL_YAW;
  stage.rotation.x = 0.08;
  scene.add(stage);

  let visual = null;
  let disposed = false;
  let active = false;
  let animationFrame = 0;
  let lastTickAt = 0;
  let lastRenderAt = 0;
  let yaw = VIEWER_INITIAL_YAW;
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  const resize = () => {
    if (disposed) return;
    const rect = modelHost.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
  };

  const renderFrame = (now) => {
    if (disposed) return;
    stage.rotation.y = yaw;
    stage.rotation.x = 0.08;
    if (visual) visual.position.y = reducedMotion ? 0 : Math.sin((now / 1000) * 2.1) * 0.04;
    renderer.render(scene, camera);
  };

  const tick = (now) => {
    if (!active || disposed) return;
    const dt = Math.min(0.1, Math.max(0, (now - lastTickAt) / 1000));
    lastTickAt = now;
    if (!reducedMotion) yaw += dt * VIEWER_ROTATION_RADIANS_PER_SECOND;
    if (now - lastRenderAt >= VIEWER_FRAME_INTERVAL_MS) {
      lastRenderAt = now;
      renderFrame(now);
    }
    animationFrame = requestAnimationFrame(tick);
  };

  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(modelHost);

  void createCarVisual({
    carId,
    color,
    secondaryColor,
    ghost: true,
    targetLength: 6.4,
    outline: true
  }).then((next) => {
    if (disposed) return;
    visual = next;
    stage.add(visual);
    resize();
    if (active) renderFrame(performance.now());
  }).catch((error) => {
    if (disposed) return;
    console.warn('TURN: first rival could not load in the onboarding viewer.', error);
    onError?.(error);
  });

  resize();

  return {
    renderer,
    resize,
    start() {
      if (disposed || active) return;
      active = true;
      resize();
      const now = performance.now();
      lastTickAt = now;
      lastRenderAt = 0;
      renderFrame(now);
      if (!reducedMotion) animationFrame = requestAnimationFrame(tick);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
