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
const PREVIEW_FALLBACK_PREP_DELAY_MS = 500;
const PREVIEW_WARM_WIDTH = 126;
const PREVIEW_WARM_HEIGHT = 92;
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
  let revealFrame = 0;
  let preparationIdleHandle = 0;
  let preparationTimer = 0;
  let previewGeneration = 0;
  let pendingPreviewIdentity = '';
  let previewIdentity = '';
  let preview = null;

  function clearTimers() {
    window.clearTimeout(showTimer);
    window.clearTimeout(hideTimer);
    window.clearTimeout(exitTimer);
    cancelAnimationFrame(revealFrame);
    showTimer = 0;
    hideTimer = 0;
    exitTimer = 0;
    revealFrame = 0;
  }

  function cancelPreparation() {
    previewGeneration += 1;
    if (preparationIdleHandle && typeof globalThis.cancelIdleCallback === 'function') {
      globalThis.cancelIdleCallback(preparationIdleHandle);
    }
    window.clearTimeout(preparationTimer);
    preparationIdleHandle = 0;
    preparationTimer = 0;
    pendingPreviewIdentity = '';
  }

  function disposePreviewVisual() {
    preview?.dispose();
    preview = null;
    previewIdentity = '';
    modelHost.replaceChildren();
  }

  function destroyPreview() {
    cancelPreparation();
    disposePreviewVisual();
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

    // Cross a frame boundary instead of forcing layout with offsetWidth. The 3D preview
    // is prepared independently; revealing CHASE YOUR BEST must never wait for WebGL.
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      if (plate.hidden) return;
      preview?.start();
      plate.classList.add('is-visible');
    });
    hideTimer = window.setTimeout(() => hide(), ONBOARDING_VISIBLE_MS);
  }

  function normalizedPreviewData(source = {}) {
    return {
      carId: source.carId || source.vehicleId || 'sedan',
      color: normalizeVehicleColor(
        source.carColor || source.vehicleColor || DEFAULT_VEHICLE_COLOR
      ),
      secondaryColor: normalizeVehicleSecondaryColor(
        source.carSecondaryColor || source.vehicleSecondaryColor || DEFAULT_VEHICLE_SECONDARY_COLOR
      )
    };
  }

  function previewKey({ carId, color, secondaryColor }) {
    return `${carId}|${color}|${secondaryColor}`;
  }

  function preparePreview(data) {
    const normalized = normalizedPreviewData(data);
    const identity = previewKey(normalized);
    if ((preview && previewIdentity === identity) || pendingPreviewIdentity === identity) return;

    cancelPreparation();
    disposePreviewVisual();
    plate.classList.remove('is-model-unavailable');
    pendingPreviewIdentity = identity;
    const generation = previewGeneration;

    const prepare = () => {
      preparationIdleHandle = 0;
      preparationTimer = 0;
      if (generation !== previewGeneration || pendingPreviewIdentity !== identity) return;

      const nextPreview = createGhostPreview({
        modelHost,
        ...normalized,
        onError() {
          plate.classList.add('is-model-unavailable');
        }
      });
      if (generation !== previewGeneration || pendingPreviewIdentity !== identity) {
        nextPreview.dispose();
        return;
      }
      preview = nextPreview;
      previewIdentity = identity;
      pendingPreviewIdentity = '';
      if (!plate.hidden) preview.start();
    };

    // With no rival yet, race-started gives us an entire first lap to prepare the
    // optional second WebGL context. Do it only when the browser reports idle time.
    // Older engines get a delayed fallback, still well before the first rival reveal.
    if (typeof globalThis.requestIdleCallback === 'function') {
      preparationIdleHandle = globalThis.requestIdleCallback(prepare);
    } else {
      preparationTimer = window.setTimeout(prepare, PREVIEW_FALLBACK_PREP_DELAY_MS);
    }
  }

  function schedule(rival) {
    clearTimers();
    plate.hidden = true;
    plate.classList.remove('is-visible', 'is-leaving');

    const normalized = normalizedPreviewData(rival);
    plate.style.setProperty('--rival-onboarding-color', makeGhostColor(normalized.color));
    // Normally this is already the exact preview prepared at race-started. If the
    // saved rival differs for any reason, prepare the corrected model without making
    // the reveal wait for it.
    preparePreview(normalized);

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
    const state = globalThis.__turnRuntime?.state;
    const rivals = state?.competitorLaps || [];
    const hasRival = rivals.length > 0;

    if (reason === 'rivals-loaded') {
      hadRival = hasRival;
    } else if (reason === 'race-started') {
      hadRival = hasRival;
      if (!hasRival && state) preparePreview(state);
      else if (hasRival) destroyPreview();
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
  // Warm at the maximum CSS preview size so the visible reveal does not discover a
  // larger drawing buffer. This surface is still tiny compared with the race canvas.
  renderer.setSize(PREVIEW_WARM_WIDTH, PREVIEW_WARM_HEIGHT, false);
  modelHost.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, PREVIEW_WARM_WIDTH / PREVIEW_WARM_HEIGHT, 0.1, 60);
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
  let warmed = false;
  let animationFrame = 0;
  let warmIdleHandle = 0;
  let warmTimer = 0;
  let lastTickAt = 0;
  let lastRenderAt = 0;
  let yaw = VIEWER_INITIAL_YAW;
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

  const resizeTo = (width, height) => {
    if (disposed || !width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(Math.round(width), Math.round(height), false);
    if (active && warmed && reducedMotion) renderer.render(scene, camera);
  };

  const resize = () => {
    if (disposed) return;
    const rect = modelHost.getBoundingClientRect();
    resizeTo(rect.width, rect.height);
  };

  const renderFrame = (now) => {
    if (disposed || !warmed) return;
    stage.rotation.y = yaw;
    stage.rotation.x = 0.08;
    if (visual) visual.position.y = reducedMotion ? 0 : Math.sin((now / 1000) * 2.1) * 0.04;
    renderer.render(scene, camera);
  };

  const tick = (now) => {
    if (!active || disposed) return;
    if (!warmed) {
      animationFrame = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.1, Math.max(0, (now - lastTickAt) / 1000));
    lastTickAt = now;
    if (!reducedMotion) yaw += dt * VIEWER_ROTATION_RADIANS_PER_SECOND;
    if (now - lastRenderAt >= VIEWER_FRAME_INTERVAL_MS) {
      lastRenderAt = now;
      renderFrame(now);
    }
    animationFrame = reducedMotion ? 0 : requestAnimationFrame(tick);
  };

  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) resizeTo(rect.width, rect.height);
    })
    : null;
  observer?.observe(modelHost);

  const runWarmupWhenIdle = (callback) => {
    if (disposed) return;
    if (typeof globalThis.requestIdleCallback === 'function') {
      warmIdleHandle = globalThis.requestIdleCallback(() => {
        warmIdleHandle = 0;
        if (!disposed) callback();
      });
    } else {
      warmTimer = window.setTimeout(() => {
        warmTimer = 0;
        if (!disposed) callback();
      }, 120);
    }
  };

  const finishWarmup = () => {
    if (disposed || !visual) return;
    // One hidden render uploads geometry and textures after shader compilation. The
    // first visible frame then has no new GPU program or texture work to discover.
    renderer.render(scene, camera);
    warmed = true;
    if (active && !animationFrame) {
      lastTickAt = performance.now();
      animationFrame = requestAnimationFrame(tick);
    }
  };

  const warmRenderer = async () => {
    if (disposed || !visual) return;
    try {
      if (typeof renderer.compileAsync === 'function') {
        // The native semantic paint system made these shaders more substantial than
        // the original r40 onboarding. Compile them asynchronously in this separate
        // WebGL context rather than on the CHASE YOUR BEST reveal frame.
        await renderer.compileAsync(scene, camera);
        if (disposed) return;
        runWarmupWhenIdle(finishWarmup);
      } else {
        runWarmupWhenIdle(() => {
          if (disposed) return;
          renderer.compile(scene, camera);
          finishWarmup();
        });
      }
    } catch (error) {
      if (disposed) return;
      console.warn('TURN: first rival preview shader warm-up failed.', error);
      // Even the recovery compile stays off the reveal path. If it fails too, keep the
      // onboarding copy and hide only the optional model.
      runWarmupWhenIdle(() => {
        if (disposed) return;
        try {
          renderer.compile(scene, camera);
          finishWarmup();
        } catch (fallbackError) {
          console.warn('TURN: first rival preview fallback warm-up failed.', fallbackError);
          onError?.(fallbackError);
        }
      });
    }
  };

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
    void warmRenderer();
  }).catch((error) => {
    if (disposed) return;
    console.warn('TURN: first rival could not load in the onboarding viewer.', error);
    onError?.(error);
  });

  return {
    renderer,
    resize,
    start() {
      if (disposed || active) return;
      active = true;
      lastTickAt = performance.now();
      if (!observer) resize();
      // Never synchronously render on reveal. If warm-up is still finishing, CHASE
      // YOUR BEST appears on time and the 3D ghost joins on a later animation frame.
      animationFrame = requestAnimationFrame(tick);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      cancelAnimationFrame(animationFrame);
      if (warmIdleHandle && typeof globalThis.cancelIdleCallback === 'function') {
        globalThis.cancelIdleCallback(warmIdleHandle);
      }
      window.clearTimeout(warmTimer);
      observer?.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
