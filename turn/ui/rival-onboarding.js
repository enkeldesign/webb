import * as THREE from 'three';
import {
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor,
  makeGhostColor,
  normalizeVehicleColor,
  normalizeVehicleId,
  normalizeVehicleSecondaryColor
} from '../vehicle/catalog.js?build=20260720-r19';
import { createCarVisual, disposeCarVisual } from '../vehicle/car-models.js?build=20260720-r22';
import { retainCarVisualResources } from '../vehicle/car-visual-resources.js';

const RESULT_TOAST_HANDOFF_MS = 4300;
const ONBOARDING_VISIBLE_MS = 3200;
const ONBOARDING_EXIT_MS = 180;
const PREVIEW_FALLBACK_PREP_DELAY_MS = 500;
const PREVIEW_WARM_WIDTH = 126;
const PREVIEW_WARM_HEIGHT = 92;
const RACE_RIVAL_WARM_TARGET_SIZE = 64;
const RACE_RIVAL_WARM_RETRY_MS = 80;
const RACE_RIVAL_WARM_MAX_RETRIES = 6;
const VIEWER_INITIAL_YAW = THREE.MathUtils.degToRad(200);
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
  let raceWarmIdleHandle = 0;
  let raceWarmTimer = 0;
  let raceWarmGeneration = 0;
  let warmedRaceIdentity = '';

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

  function cancelRaceRivalWarmup() {
    raceWarmGeneration += 1;
    if (raceWarmIdleHandle && typeof globalThis.cancelIdleCallback === 'function') {
      globalThis.cancelIdleCallback(raceWarmIdleHandle);
    }
    window.clearTimeout(raceWarmTimer);
    raceWarmIdleHandle = 0;
    raceWarmTimer = 0;
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

    // Cross a frame boundary instead of forcing a synchronous layout read. The 3D
    // preview is prepared independently; revealing CHASE YOUR BEST must never wait for WebGL.
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      if (plate.hidden) return;
      preview?.start();
      plate.classList.add('is-visible');
    });
    hideTimer = window.setTimeout(() => hide(), ONBOARDING_VISIBLE_MS);
  }

  function normalizedPreviewData(source = {}) {
    const carId = normalizeVehicleId(source.carId || source.vehicleId || 'sedan');
    return {
      carId,
      color: normalizeVehicleColor(
        source.carColor || source.vehicleColor,
        getVehicleDefaultColor(carId)
      ),
      secondaryColor: normalizeVehicleSecondaryColor(
        source.carSecondaryColor || source.vehicleSecondaryColor,
        getVehicleDefaultSecondaryColor(carId)
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
    // the reveal wait for it. Pass the saved rival contract itself; preparePreview()
    // owns normalization, so an already-normalized { color, secondaryColor } object
    // must not be normalized a second time and fall back to factory paint.
    preparePreview(rival);

    showTimer = window.setTimeout(() => {
      showTimer = 0;
      reveal();
    }, RESULT_TOAST_HANDOFF_MS);
  }

  function raceRivalVisuals(runtime) {
    const cars = runtime?.competitorCars || [];
    const savedCount = Math.min(cars.length, runtime?.state?.competitorLaps?.length || 0);
    // With no saved rival, main.js still prepares ghostCar with the player's exact
    // selected identity so the first completed lap can become rival #1 cheaply.
    const expectedCount = savedCount || (cars.length ? 1 : 0);
    const visuals = [];
    for (let index = 0; index < expectedCount; index += 1) {
      const root = cars[index];
      const visual = root?.children?.find((child) => child.userData?.turnAssetVisual);
      if (visual) visuals.push({ root, visual });
    }
    return { expectedCount, visuals };
  }

  function raceRivalWarmIdentity(runtime, visuals) {
    const trackId = runtime?.state?.trackId || '';
    return `${trackId}|${visuals.map(({ root }) => root.userData?.turnVisualKey || '').join('||')}`;
  }

  function makeRaceRivalWarmScene(visuals) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5b6770, 3));
    const key = new THREE.DirectionalLight(0xfff2c9, 4);
    key.position.set(-6, 10, 7);
    scene.add(key);

    const stage = new THREE.Group();
    scene.add(stage);
    const spacing = 7;
    const center = (visuals.length - 1) * spacing * 0.5;
    try {
      for (let index = 0; index < visuals.length; index += 1) {
        const clone = visuals[index].visual.clone(true);
        retainCarVisualResources(visuals[index].visual, clone);
        stage.add(clone);
        clone.visible = true;
        clone.position.set(index * spacing - center, 0, 0);
        clone.traverse((node) => {
          if (node.isMesh) node.frustumCulled = false;
        });
      }
    } catch (error) {
      disposeCarVisual(scene);
      throw error;
    }

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 7, 18 + Math.max(0, visuals.length - 1) * 2.5);
    camera.lookAt(0, 1.1, 0);
    return { scene, camera };
  }

  async function warmRaceRivalRenderer(generation, retry = 0) {
    raceWarmIdleHandle = 0;
    raceWarmTimer = 0;
    if (generation !== raceWarmGeneration || document.visibilityState === 'hidden') return;

    const runtime = globalThis.__turnRuntime;
    const renderer = runtime?.renderer;
    if (!runtime?.scene || !renderer) return;

    const { expectedCount, visuals } = raceRivalVisuals(runtime);
    if (!expectedCount) return;
    if (visuals.length < expectedCount) {
      if (retry < RACE_RIVAL_WARM_MAX_RETRIES) {
        raceWarmTimer = window.setTimeout(
          () => void warmRaceRivalRenderer(generation, retry + 1),
          RACE_RIVAL_WARM_RETRY_MS
        );
      }
      return;
    }

    const identity = raceRivalWarmIdentity(runtime, visuals);
    if (!identity || identity === warmedRaceIdentity) return;

    let warm = null;
    try {
      warm = makeRaceRivalWarmScene(visuals);
      if (typeof renderer.compileAsync === 'function') {
        // Compile the actual stored-rival material graph against the race scene's
        // lighting before the timing line makes those cars visible. r184 supports
        // targetScene; disabling clone frustum culling also avoids its stale-frustum
        // compileAsync edge case without touching the live cars.
        await renderer.compileAsync(warm.scene, warm.camera, runtime.scene);
      } else {
        renderer.compile(warm.scene, warm.camera, runtime.scene);
      }
      if (generation !== raceWarmGeneration) return;

      // compileAsync handles shader programs. One tiny off-screen render on the same
      // WebGL context also uploads shared rival geometry/textures before their first
      // visible race frame. Never draw the warm-up into the gameplay framebuffer.
      const target = new THREE.WebGLRenderTarget(
        RACE_RIVAL_WARM_TARGET_SIZE,
        RACE_RIVAL_WARM_TARGET_SIZE
      );
      const previousTarget = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        renderer.render(warm.scene, warm.camera);
      } finally {
        renderer.setRenderTarget(previousTarget);
        target.dispose();
      }
      warmedRaceIdentity = identity;
    } catch (error) {
      console.warn('TURN: race rival GPU warm-up failed.', error);
    } finally {
      // A replaced/reset rival can release its live visual while this compiler is
      // still polling. The temporary warm scene owns a lease until that work ends.
      disposeCarVisual(warm?.scene);
    }
  }

  function scheduleRaceRivalWarmup({ racing = false } = {}) {
    cancelRaceRivalWarmup();
    const generation = raceWarmGeneration;
    const run = () => void warmRaceRivalRenderer(generation);
    if (typeof globalThis.requestIdleCallback === 'function') {
      raceWarmIdleHandle = globalThis.requestIdleCallback(run, {
        timeout: racing ? 180 : 700
      });
    } else {
      raceWarmTimer = window.setTimeout(run, racing ? 24 : 90);
    }
  }

  window.addEventListener('turn:rivals-reset', () => {
    hadRival = false;
    warmedRaceIdentity = '';
    cancelRaceRivalWarmup();
    hide({ immediate: true });
  });

  window.addEventListener('turn:ui-state-change', (event) => {
    const reason = event.detail?.reason;
    const state = globalThis.__turnRuntime?.state;
    const rivals = state?.competitorLaps || [];
    const hasRival = rivals.length > 0;

    if (reason === 'rivals-loaded') {
      hadRival = hasRival;
      scheduleRaceRivalWarmup();
    } else if (reason === 'race-started') {
      hadRival = hasRival;
      scheduleRaceRivalWarmup({ racing: true });
      if (!hasRival && state) preparePreview(state);
      else if (hasRival) destroyPreview();
    } else if (reason === 'lap-completed') {
      if (!hadRival && hasRival) schedule(rivals[0]);
      hadRival = hasRival;
    }

    if (!event.detail?.running || reason === 'race-reset') {
      if (reason !== 'rivals-loaded') cancelRaceRivalWarmup();
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
  let resourcesDisposed = false;
  let pendingCompilation = null;
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
        pendingCompilation = renderer.compileAsync(scene, camera);
        await pendingCompilation;
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
          dispose();
          onError?.(fallbackError);
        }
      });
    } finally {
      pendingCompilation = null;
      if (disposed) releaseResources();
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
    if (disposed) {
      disposeCarVisual(next);
      return;
    }
    visual = next;
    stage.add(visual);
    void warmRenderer();
  }).catch((error) => {
    if (disposed) return;
    console.warn('TURN: first rival could not load in the onboarding viewer.', error);
    dispose();
    onError?.(error);
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    active = false;
    cancelAnimationFrame(animationFrame);
    if (warmIdleHandle && typeof globalThis.cancelIdleCallback === 'function') {
      globalThis.cancelIdleCallback(warmIdleHandle);
    }
    window.clearTimeout(warmTimer);
    observer?.disconnect();
    renderer.domElement.remove();
    // Three's asynchronous compiler still polls material/program state. Stop the
    // preview immediately, but keep those resources valid until compilation ends.
    if (!pendingCompilation) releaseResources();
  }

  function releaseResources() {
    if (resourcesDisposed) return;
    resourcesDisposed = true;
    disposeCarVisual(visual);
    visual = null;
    renderer.dispose();
    renderer.forceContextLoss?.();
  }

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
    dispose
  };
}
