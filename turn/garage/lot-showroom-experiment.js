import * as THREE from 'three';
import {
  CAR_CATALOG,
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  getCarDefinition,
  getVehicleDefaultColor,
  getVehicleDefaultSecondaryColor,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor,
  normalizeVehicleSelection
} from '../vehicle/catalog.js?build=20260720-r20&revision=r588-canonical-attributes';
import { createCarVisual, recolorCarVisual } from '../vehicle/car-models.js?build=20260720-r22';
import { recordPerformanceFrame } from '../performance-monitor.js?build=20260720-r20';
import { describeColorCue } from '../accessibility/color-cues.js?revision=r163';
import { LOCK_ICON } from '../progression/trophy-road.js?revision=r166-bella-records';
import {
  hasTriedTrainingCar,
  installTrainingCarGuide,
  TRAINING_CAR_ID
} from './training-car-guide.js?revision=r1';

const LOT_FRAME_INTERVAL_MS = 1000 / 30;
const VIEWER_INITIAL_YAW = Math.PI - 0.55;
const THUMBNAIL_WIDTH = 240;
const THUMBNAIL_HEIGHT = 108;
let paintControlSerial = 0;

export const LOT_CAR_ORDER = Object.freeze([
  'classic',
  'truck',
  'sedan',
  'van',
  'suv',
  'convertible',
  'sedan-sports',
  'firetruck',
  'ambulance',
  'police',
  'race',
  'vintage-racer',
  'race-future',
  'monster-truck',
  'toy-racer'
]);

const CAR_BY_ID = new Map(CAR_CATALOG.map((car) => [car.id, car]));
const LOT_CARS = Object.freeze(LOT_CAR_ORDER.map((id) => CAR_BY_ID.get(id)).filter(Boolean));

const CAR_DESCRIPTIONS = Object.freeze({
  convertible: 'A low, open-top sports car with a long bonnet and compact cabin.',
  classic: 'A small, upright classic car with rounded bodywork and a friendly shape.',
  'vintage-racer': 'A narrow vintage racing car with exposed wheels and a long nose.',
  'toy-racer': 'A compact single-seat racing car with exposed wheels and a playful toy-like shape.',
  'monster-truck': 'A tall off-road truck with oversized tyres and a short, chunky body.',
  'race-future': 'A sleek futuristic racing car with a low cockpit and aerodynamic body.',
  race: 'A low single-seat race car with exposed wheels and a large rear wing.',
  'sedan-sports': 'A sporty four-door sedan with a low stance and rear spoiler.',
  sedan: 'A balanced four-door family car with a conventional three-box shape.',
  suv: 'A high-riding sport utility vehicle with a broad body and practical proportions.',
  firetruck: 'A heavy fire engine with roof equipment, blue emergency lights and a deep two-tone siren.',
  police: 'A quick patrol car with a red-and-blue light bar and an urgent electronic siren.',
  ambulance: 'A stable emergency van with blue roof lights and a clear hi-lo siren.',
  truck: 'A sturdy pickup truck with a separate cab and cargo bed.',
  van: 'A tall enclosed van with a boxy body and short bonnet.'
});

export function showTheLot({ initialSelection } = {}) {
  return new Promise((resolve) => {
    installTrainingCarGuide();
    const showBeginnerGuide = !hasTriedTrainingCar();
    const selection = normalizeVehicleSelection(initialSelection);
    const overlay = document.createElement('section');
    overlay.className = 'lot-screen lot-showroom';
    overlay.setAttribute('aria-labelledby', 'lot-title');
    overlay.innerHTML = `
      <header class="lot-heading">
        <div class="lot-heading-copy">
          <h1 id="lot-title">THE LOT</h1>
          <p>CHOOSE YOUR RIDE</p>
        </div>
        <div class="lot-progress-summary" aria-live="polite">
          <span class="lot-progress-lock" aria-hidden="true">${LOCK_ICON}</span>
          <span>
            <strong data-lot-available>15 / 15 AVAILABLE</strong>
            <small data-lot-next-unlock>All cars available</small>
          </span>
        </div>
      </header>

      <button class="lot-back" type="button" aria-label="Back to track selection">← BACK</button>

      <div class="lot-side">
        <section class="lot-viewbox lot-viewbox-with-paint">
          <div class="lot-viewbox-head" aria-hidden="true">
            <span>3D PREVIEW</span>
            <b>DRAG LEFT / RIGHT TO ROTATE</b>
          </div>
          <div class="lot-view-host" aria-hidden="true"></div>
          <button class="lot-cycle lot-cycle-prev" type="button" aria-label="Previous car">‹</button>
          <button class="lot-cycle lot-cycle-next" type="button" aria-label="Next car">›</button>
          <div class="lot-colors" aria-label="Choose car paint colours"></div>
        </section>

        <aside class="lot-card">
          <div class="lot-car-title">
            <span>SELECTED CAR</span>
            <strong></strong>
          </div>
          <p class="lot-car-description"></p>
          <div class="lot-stats"></div>
          <div class="lot-card-actions">
            <button class="lot-race" type="button">RACE THIS CAR</button>
          </div>
        </aside>
      </div>

      <div class="lot-car-picker-shell">
        <div class="lot-car-picker" role="radiogroup" aria-label="Choose a car"></div>
        <p class="lot-car-picker-help" aria-hidden="true">SWIPE OR USE ARROWS TO BROWSE</p>
      </div>

      <div class="lot-loading">ROLLING OUT YOUR CAR…</div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('turn-lot-open');

    const title = overlay.querySelector('.lot-car-title strong');
    const description = overlay.querySelector('.lot-car-description');
    const stats = overlay.querySelector('.lot-stats');
    const colors = overlay.querySelector('.lot-colors');
    const carPicker = overlay.querySelector('.lot-car-picker');
    const raceButton = overlay.querySelector('.lot-race');
    const backButton = overlay.querySelector('.lot-back');
    const loading = overlay.querySelector('.lot-loading');
    const viewHost = overlay.querySelector('.lot-view-host');
    const previousButton = overlay.querySelector('.lot-cycle-prev');
    const nextButton = overlay.querySelector('.lot-cycle-next');
    const availableLabel = overlay.querySelector('[data-lot-available]');
    const nextUnlockLabel = overlay.querySelector('[data-lot-next-unlock]');

    const viewer = createViewer(viewHost);
    const carButtons = new Map();
    const thumbnailRenderer = createThumbnailRenderer();
    let selectedCarId = selection.carId;
    let selectedColor = selection.color;
    let selectedSecondaryColor = selection.secondaryColor;
    let disposed = false;

    for (const car of LOT_CARS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lot-car-option';
      button.setAttribute('role', 'radio');
      button.dataset.carId = car.id;
      button.style.setProperty('--lot-car-color', getVehicleDefaultColor(car.id));
      button.style.setProperty('--lot-car-secondary', getVehicleDefaultSecondaryColor(car.id));

      const preview = document.createElement('span');
      preview.className = 'lot-car-option-preview';
      preview.setAttribute('aria-hidden', 'true');

      const fallback = document.createElement('span');
      fallback.className = 'lot-car-option-fallback';
      fallback.innerHTML = '<i></i><i></i><i></i>';

      const thumbnail = document.createElement('canvas');
      thumbnail.className = 'lot-car-option-thumbnail';
      thumbnail.width = THUMBNAIL_WIDTH;
      thumbnail.height = THUMBNAIL_HEIGHT;
      thumbnail.setAttribute('aria-hidden', 'true');
      preview.append(fallback, thumbnail);

      const name = document.createElement('span');
      name.className = 'lot-car-option-name';
      name.textContent = car.name;

      const lock = document.createElement('span');
      lock.className = 'lot-car-option-lock';
      lock.setAttribute('aria-hidden', 'true');
      lock.innerHTML = LOCK_ICON;

      button.append(preview, name, lock);
      const beginner = car.id === TRAINING_CAR_ID && showBeginnerGuide;
      button.dataset.lotBaseLabel = beginner ? `${car.name}. Beginner-friendly.` : car.name;
      button.setAttribute('aria-label', button.dataset.lotBaseLabel);
      button.addEventListener('click', () => selectCar(car.id, { reveal: false }));
      carPicker.appendChild(button);
      carButtons.set(car.id, button);
    }

    function syncAvailabilitySummary() {
      const buttons = [...carButtons.values()];
      const locked = buttons.filter((button) => button.classList.contains('is-trophy-locked'));
      const available = buttons.length - locked.length;
      availableLabel.textContent = `${available} / ${buttons.length} AVAILABLE`;

      const thresholds = locked
        .map((button) => Number.parseInt(button.dataset.trophyLockLabel, 10))
        .filter(Number.isFinite);
      if (!thresholds.length) {
        nextUnlockLabel.textContent = 'All cars available';
        return;
      }
      nextUnlockLabel.textContent = `${Math.min(...thresholds)} TROPHIES TO NEXT CAR`;
    }

    const lockObserver = new MutationObserver(syncAvailabilitySummary);
    lockObserver.observe(carPicker, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-trophy-lock-label']
    });
    window.addEventListener('turn:trophy-road-updated', syncAvailabilitySummary);

    function updateSelectionUi({ refreshViewer = true, reveal = false } = {}) {
      const car = getCarDefinition(selectedCarId);
      title.textContent = car.name;
      description.textContent = CAR_DESCRIPTIONS[car.id] || 'A selectable car in The Lot.';
      stats.replaceChildren(...makeStats(car.stats));
      raceButton.setAttribute('aria-label', `Race the ${car.name}`);

      for (const [carId, button] of carButtons) {
        const selected = carId === selectedCarId;
        button.setAttribute('aria-checked', String(selected));
        button.tabIndex = selected ? 0 : -1;
        const baseLabel = button.dataset.lotBaseLabel || getCarDefinition(carId).name;
        button.setAttribute(
          'aria-label',
          `${baseLabel} ${CAR_DESCRIPTIONS[carId] || ''}`.trim()
        );
      }

      if (car.fixedLivery) {
        colors.replaceChildren();
        colors.hidden = false;
        colors.setAttribute('aria-hidden', 'true');
        colors.removeAttribute('aria-label');
      } else {
        const paintControls = [makeColorInput({
          label: 'Body',
          value: selectedColor,
          onInput(value) {
            selectedColor = normalizeVehicleColor(value);
            applySelectedPaint();
          }
        })];
        if (car.secondaryPaint) {
          paintControls.push(makeColorInput({
            label: car.secondaryPaint.label,
            value: selectedSecondaryColor,
            secondary: true,
            onInput(value) {
              selectedSecondaryColor = normalizeVehicleSecondaryColor(value);
              applySelectedPaint();
            }
          }));
        }
        colors.replaceChildren(...paintControls);
        colors.hidden = false;
        colors.removeAttribute('aria-hidden');
        colors.setAttribute('aria-label', 'Choose car paint colours');
      }

      if (refreshViewer) {
        loading.classList.remove('is-done');
        void viewer.show(selectedCarId, selectedColor, selectedSecondaryColor).finally(() => {
          if (!disposed) loading.classList.add('is-done');
        });
      }

      if (reveal) revealSelectedCar();
    }

    function revealSelectedCar() {
      const selectedButton = carButtons.get(selectedCarId);
      if (!selectedButton) return;
      const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
      selectedButton.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }

    function selectCar(carId, { focus = false, reveal = true } = {}) {
      if (!carId || !carButtons.has(carId)) return;
      const changedCar = carId !== selectedCarId;
      selectedCarId = carId;
      if (changedCar) {
        selectedColor = getVehicleDefaultColor(carId);
        selectedSecondaryColor = getVehicleDefaultSecondaryColor(carId);
      }
      updateSelectionUi({ reveal });
      if (focus) carButtons.get(carId)?.focus();
      navigator.vibrate?.(16);
    }

    function cycleCar(direction, { focus = false } = {}) {
      const currentIndex = LOT_CARS.findIndex((car) => car.id === selectedCarId);
      const nextIndex = (currentIndex + direction + LOT_CARS.length) % LOT_CARS.length;
      selectCar(LOT_CARS[nextIndex].id, { focus, reveal: true });
    }

    previousButton.addEventListener('click', () => cycleCar(-1));
    nextButton.addEventListener('click', () => cycleCar(1));

    carPicker.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        cycleCar(1, { focus: true });
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        cycleCar(-1, { focus: true });
      } else if (event.key === 'Home') {
        event.preventDefault();
        selectCar(LOT_CARS[0].id, { focus: true });
      } else if (event.key === 'End') {
        event.preventDefault();
        selectCar(LOT_CARS.at(-1).id, { focus: true });
      }
    });

    function makeColorInput({ label, value, secondary = false, onInput }) {
      const control = document.createElement('div');
      control.className = 'lot-color-control';
      control.dataset.paintLabel = label;

      const input = document.createElement('input');
      input.type = 'color';
      input.id = `turnPaintColor${++paintControlSerial}`;
      input.value = secondary
        ? normalizeVehicleSecondaryColor(value)
        : normalizeVehicleColor(value);
      input.setAttribute('aria-label', `${label} colour`);
      input.title = `${label} colour`;

      const inputLabel = document.createElement('label');
      inputLabel.className = 'lot-color-name';
      inputLabel.htmlFor = input.id;

      const name = document.createElement('span');
      name.className = 'lot-color-label';
      name.textContent = label.toUpperCase();

      const cue = document.createElement('span');
      cue.className = 'turn-color-cue lot-color-cue';

      const syncCue = () => {
        const description = describeColorCue(input.value).toUpperCase();
        cue.textContent = `COLOR · ${description}`;
        input.title = `${label} colour · ${description}`;
      };

      input.addEventListener('input', () => {
        syncCue();
        onInput(input.value);
      });

      inputLabel.append(name, cue);
      control.append(input, inputLabel);
      syncCue();
      return control;
    }

    function applySelectedPaint() {
      viewer.recolor(selectedColor, selectedSecondaryColor);
    }

    raceButton.addEventListener('click', () => finish({
      carId: selectedCarId,
      color: selectedColor,
      secondaryColor: selectedSecondaryColor
    }));
    backButton.addEventListener('click', () => finish(null));

    const resizeObserver = new ResizeObserver(() => viewer.resize());
    resizeObserver.observe(viewHost);

    function finish(result) {
      if (disposed) return;
      disposed = true;
      lockObserver.disconnect();
      window.removeEventListener('turn:trophy-road-updated', syncAvailabilitySummary);
      resizeObserver.disconnect();
      thumbnailRenderer.cancel();
      viewer.dispose();
      overlay.remove();
      document.body.classList.remove('turn-lot-open');
      resolve(result ? normalizeVehicleSelection(result) : null);
    }

    updateSelectionUi({ reveal: false });
    syncAvailabilitySummary();
    requestAnimationFrame(() => {
      viewer.resize();
      revealSelectedCar();
      void thumbnailRenderer.renderAll(LOT_CARS, carButtons);
    });
  });
}

function createViewer(host) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(rendererPixelRatio(1.5));
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 70);
  camera.position.set(8.6, 4.9, 9.7);
  camera.lookAt(0, 1.05, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x43556c, 3.4));
  const key = new THREE.DirectionalLight(0xfff2c9, 4.4);
  key.position.set(-7, 11, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8ed8ff, 2.2);
  rim.position.set(8, 5, -7);
  scene.add(rim);

  const platformResources = [];
  const platform = new THREE.Group();
  scene.add(platform);

  const baseGeometry = new THREE.CylinderGeometry(4.25, 4.45, 0.42, 48);
  const baseMaterial = new THREE.MeshStandardMaterial({ color: 0x252a31, roughness: 0.72 });
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.position.y = -0.12;
  platform.add(base);
  platformResources.push(baseGeometry, baseMaterial);

  const topGeometry = new THREE.CylinderGeometry(3.85, 3.85, 0.12, 48);
  const topMaterial = new THREE.MeshStandardMaterial({ color: 0x606c78, roughness: 0.38, metalness: 0.25 });
  const top = new THREE.Mesh(topGeometry, topMaterial);
  top.position.y = 0.14;
  platform.add(top);
  platformResources.push(topGeometry, topMaterial);

  const ringGeometry = new THREE.TorusGeometry(3.62, 0.045, 8, 64);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffd43b });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.22;
  platform.add(ring);
  platformResources.push(ringGeometry, ringMaterial);

  const stage = new THREE.Group();
  stage.position.y = 0.26;
  scene.add(stage);

  let visual = null;
  let generation = 0;
  let currentColor = DEFAULT_VEHICLE_COLOR;
  let currentSecondaryColor = DEFAULT_VEHICLE_SECONDARY_COLOR;
  let yaw = VIEWER_INITIAL_YAW;
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let disposed = false;
  let lastRenderAt = -Infinity;
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
  const clock = new THREE.Clock();

  host.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    host.setPointerCapture?.(event.pointerId);
  });

  host.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    lastX = event.clientX;
    yaw += dx * 0.012;
  });

  const stopDrag = (event) => {
    if (pointerId !== null && event?.pointerId != null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
  };
  host.addEventListener('pointerup', stopDrag);
  host.addEventListener('pointercancel', stopDrag);
  host.addEventListener('lostpointercapture', stopDrag);

  renderer.setAnimationLoop((now) => {
    if (disposed || document.hidden || now - lastRenderAt < LOT_FRAME_INTERVAL_MS) return;
    lastRenderAt = now;
    const elapsed = clock.getElapsedTime();
    if (!dragging && !reducedMotion) yaw += 0.0022;
    stage.rotation.set(0, yaw, 0);
    if (visual) visual.position.y = reducedMotion ? 0 : Math.sin(elapsed * 2.1) * 0.035;
    renderer.render(scene, camera);
    recordPerformanceFrame('lot', renderer, now);
  });

  return {
    renderer,
    async show(carId, color, secondaryColor) {
      const request = ++generation;
      currentColor = normalizeVehicleColor(color);
      currentSecondaryColor = normalizeVehicleSecondaryColor(secondaryColor);
      try {
        const next = await createCarVisual({
          carId,
          color: currentColor,
          secondaryColor: currentSecondaryColor,
          targetLength: 6.5,
          outline: true
        });
        if (request !== generation || disposed) {
          disposeVisualMaterials(next);
          return;
        }
        if (visual) {
          stage.remove(visual);
          disposeVisualMaterials(visual);
        }
        visual = next;
        stage.add(visual);
        recolorCarVisual(visual, currentColor, currentSecondaryColor);
        yaw = VIEWER_INITIAL_YAW;
      } catch (error) {
        console.warn('TURN: selected car could not load in the showroom preview.', error);
      }
    },
    recolor(color, secondaryColor) {
      currentColor = normalizeVehicleColor(color);
      currentSecondaryColor = normalizeVehicleSecondaryColor(secondaryColor);
      if (visual) recolorCarVisual(visual, currentColor, currentSecondaryColor);
    },
    resize() {
      if (disposed) return;
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
      const compact = rect.height < 250;
      camera.position.set(compact ? 9.6 : 8.6, compact ? 5.2 : 4.9, compact ? 10.6 : 9.7);
      camera.lookAt(0, 1.05, 0);
    },
    dispose() {
      disposed = true;
      generation += 1;
      renderer.setAnimationLoop(null);
      if (visual) {
        stage.remove(visual);
        disposeVisualMaterials(visual);
        visual = null;
      }
      for (const resource of platformResources) resource.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    }
  };
}

function createThumbnailRenderer() {
  let cancelled = false;
  let renderer = null;
  let activeVisual = null;

  async function renderAll(cars, carButtons) {
    if (cancelled) return;

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x43556c, 3.2));
    const key = new THREE.DirectionalLight(0xfff2c9, 4.1);
    key.position.set(-6, 9, 7);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x8ed8ff, 1.5);
    rim.position.set(6, 4, -5);
    scene.add(rim);

    const stage = new THREE.Group();
    stage.rotation.y = VIEWER_INITIAL_YAW;
    scene.add(stage);
    const camera = new THREE.PerspectiveCamera(36, THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT, 0.1, 80);

    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power'
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(1);
    renderer.setSize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, false);
    renderer.setClearColor(0x000000, 0);

    try {
      for (const car of cars) {
        if (cancelled) break;
        const button = carButtons.get(car.id);
        const canvas = button?.querySelector('.lot-car-option-thumbnail');
        if (!canvas) continue;

        try {
          const visual = await createCarVisual({
            carId: car.id,
            color: getVehicleDefaultColor(car.id),
            secondaryColor: getVehicleDefaultSecondaryColor(car.id),
            targetLength: 5.8,
            outline: true
          });
          activeVisual = visual;
          if (cancelled) {
            disposeVisualMaterials(visual);
            activeVisual = null;
            break;
          }

          stage.add(visual);
          fitThumbnailCamera(camera, visual);
          renderer.render(scene, camera);
          const context = canvas.getContext('2d');
          context?.clearRect(0, 0, canvas.width, canvas.height);
          context?.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
          button.classList.add('has-3d-thumbnail');
          stage.remove(visual);
          disposeVisualMaterials(visual);
          activeVisual = null;
        } catch (error) {
          console.warn(`TURN: could not render ${car.name} thumbnail in The Lot.`, error);
          if (activeVisual) {
            stage.remove(activeVisual);
            disposeVisualMaterials(activeVisual);
            activeVisual = null;
          }
        }
        await yieldForThumbnailWork();
      }
    } finally {
      if (activeVisual) {
        stage.remove(activeVisual);
        disposeVisualMaterials(activeVisual);
        activeVisual = null;
      }
      renderer?.dispose();
      renderer?.forceContextLoss?.();
      renderer = null;
    }
  }

  return {
    renderAll,
    cancel() {
      cancelled = true;
      if (activeVisual) disposeVisualMaterials(activeVisual);
      activeVisual = null;
      renderer?.dispose();
      renderer?.forceContextLoss?.();
      renderer = null;
    }
  };
}

function fitThumbnailCamera(camera, visual) {
  visual.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(visual);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y * 1.45, size.z);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.max(6.8, (maxDimension / (2 * Math.tan(fov / 2))) * 1.45);
  const direction = new THREE.Vector3(1, 0.56, 1).normalize();
  camera.position.copy(center).add(direction.multiplyScalar(distance));
  camera.near = 0.1;
  camera.far = Math.max(80, distance * 5);
  camera.lookAt(center.x, center.y + size.y * 0.04, center.z);
  camera.updateProjectionMatrix();
}

function yieldForThumbnailWork() {
  return new Promise((resolve) => {
    if (typeof globalThis.requestIdleCallback === 'function') {
      globalThis.requestIdleCallback(() => resolve(), { timeout: 80 });
      return;
    }
    globalThis.setTimeout(resolve, 0);
  });
}

function rendererPixelRatio(fallbackCap) {
  const deviceRatio = Math.max(1, Number(globalThis.devicePixelRatio) || 1);
  const profileCap = Number(globalThis.__turnPerformanceProfile?.dprCap);
  const cap = Number.isFinite(profileCap) ? profileCap : fallbackCap;
  return Math.min(deviceRatio, cap);
}

function disposeVisualMaterials(root) {
  const materials = new Set();
  root?.traverse?.((node) => {
    if (!node?.isMesh || !node.material) return;
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of nodeMaterials) materials.add(material);
  });
  for (const material of materials) material.dispose?.();
}

function makeStats(vehicleStats) {
  const rows = [
    ['TOP SPEED', vehicleStats.speed],
    ['ACCELERATION', vehicleStats.acceleration],
    ['CONTROL', vehicleStats.control],
    ['DRIFT', vehicleStats.drift],
    ['BOOST POWER', vehicleStats.boostPower],
    ['BOOST TANK', vehicleStats.boostDuration]
  ];

  return rows.map(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'lot-stat';
    row.setAttribute('aria-label', `${label}. ${value} out of 5.`);
    row.innerHTML = `<span aria-hidden="true">${label}</span><i aria-hidden="true">${Array.from({ length: 5 }, (_, index) => `<b class="${index < value ? 'is-full' : ''}"></b>`).join('')}</i>`;
    return row;
  });
}
