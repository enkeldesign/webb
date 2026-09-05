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
import { LOCK_ICON } from '../progression/trophy-road.js?revision=r243-mountain-1300';
import {
  hasTriedTrainingCar,
  installTrainingCarGuide,
  TRAINING_CAR_ID
} from './training-car-guide.js?revision=r1';

const VIEWER_INITIAL_YAW = Math.PI - 0.55;
const LOT_FRAME_INTERVAL_MS = 1000 / 30;
let paintControlSerial = 0;
let lockBadgeTexture = null;
let beginnerBadgeTexture = null;

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
  convertible: 'A compact all-wheel-drive utility car with a short wheelbase, high ride height and sure-footed handling.',
  classic: 'A small, upright classic car with rounded bodywork and a friendly shape.',
  'vintage-racer': 'A narrow vintage racer with exposed wheels, a contrasting bonnet stripe and matching deck trim.',
  'toy-racer': 'A grey-and-gold competition car with a low stance, high rear wing and rally-bred trim.',
  'monster-truck': 'A tall off-road truck with oversized tyres, exposed suspension and a rugged roll cage.',
  'race-future': 'A sleek futuristic racer with a low cockpit, central aero spine and contrasting rear deck trim.',
  race: 'A low single-seat race car with exposed wheels and a large rear wing.',
  'sedan-sports': 'A compact sporty hatchback with a short wheelbase, rear hatch and practical everyday shape.',
  sedan: 'A balanced four-door family car with a conventional three-box shape.',
  suv: 'A road-focused luxury SUV with a broad body, high cabin and strong acceleration.',
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
    overlay.className = 'lot-screen';
    overlay.setAttribute('aria-labelledby', 'lot-title');
    overlay.innerHTML = `
      <div class="lot-canvas-host" aria-hidden="true"></div>
      <header class="lot-heading">
        <h1 id="lot-title">THE LOT</h1>
        <p>Pick a ride. Then hit the road.</p>
      </header>
      <button class="lot-back" type="button" aria-label="Back to start">×</button>

      <div class="lot-car-picker" role="radiogroup" aria-label="Choose a car"></div>

      <div class="lot-side">
        <section class="lot-viewbox lot-viewbox-with-paint">
          <div class="lot-viewbox-head" aria-hidden="true">
            <span>3D VIEW</span>
          </div>
          <div class="lot-view-host" aria-hidden="true"></div>
          <small aria-hidden="true">DRAG TO ROTATE</small>
          <div class="lot-colors" aria-label="Choose car paint colours"></div>
        </section>

        <aside class="lot-card">
          <div class="lot-car-title">
            <span>YOUR RIDE</span>
            <strong></strong>
          </div>
          <p class="lot-car-description"></p>
          <div class="lot-stats"></div>
          <div class="lot-card-actions">
            <button class="lot-race" type="button">RACE THIS CAR</button>
          </div>
        </aside>
      </div>

      <div class="lot-loading">ROLLING OUT THE CARS…</div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('turn-lot-open');

    const host = overlay.querySelector('.lot-canvas-host');
    const title = overlay.querySelector('.lot-car-title strong');
    const description = overlay.querySelector('.lot-car-description');
    const stats = overlay.querySelector('.lot-stats');
    const colors = overlay.querySelector('.lot-colors');
    const carPicker = overlay.querySelector('.lot-car-picker');
    const raceButton = overlay.querySelector('.lot-race');
    const backButton = overlay.querySelector('.lot-back');
    const loading = overlay.querySelector('.lot-loading');
    const viewbox = overlay.querySelector('.lot-viewbox');
    const viewHost = overlay.querySelector('.lot-view-host');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x8ed8ff);
    scene.fog = new THREE.Fog(0x8ed8ff, 45, 90);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(rendererPixelRatio(1.5));
    renderer.shadowMap.enabled = false;
    host.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 130);
    camera.position.set(0, 28, 31);
    camera.lookAt(0, 0, -1.5);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x50643d, 3.4);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2c9, 4.4);
    sun.position.set(-18, 28, 20);
    scene.add(sun);

    const lot = new THREE.Group();
    scene.add(lot);
    makeLotGround(lot);

    const viewer = createViewer(viewHost);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitTargets = [];
    const carRoots = new Map();
    const platforms = new Map();
    const carButtons = new Map();
    const lockMarkers = new Map();
    let selectedCarId = selection.carId;
    let selectedColor = selection.color;
    let selectedSecondaryColor = selection.secondaryColor;
    let disposed = false;
    let loadedCars = 0;

    for (const car of LOT_CARS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lot-car-option';
      button.setAttribute('role', 'radio');
      button.dataset.carId = car.id;
      button.textContent = car.name;
      const beginner = car.id === TRAINING_CAR_ID && showBeginnerGuide;
      button.dataset.lotBaseLabel = beginner ? `${car.name}. Beginner-friendly.` : car.name;
      button.setAttribute('aria-label', button.dataset.lotBaseLabel);
      button.addEventListener('click', () => selectCar(car.id));
      carPicker.appendChild(button);
      carButtons.set(car.id, button);
    }

    const positions = LOT_CARS.map((car, index) => ({
      car,
      x: (index % 5 - 2) * 8.1,
      z: (1 - Math.floor(index / 5)) * 7.2
    }));

    for (const { car, x, z } of positions) {
      const platform = makeParkingPad(car.id === selectedCarId);
      platform.position.set(x, 0.025, z);
      lot.add(platform);
      platforms.set(car.id, platform);

      const lockMarker = makeLockMarker();
      lockMarker.position.set(x + 2.05, 3.2, z + 0.3);
      lockMarker.visible = false;
      lot.add(lockMarker);
      lockMarkers.set(car.id, lockMarker);

      if (car.id === TRAINING_CAR_ID && showBeginnerGuide) {
        const beginnerMarker = makeBeginnerFriendlyMarker();
        // Keep the guide inside the car grid rather than the left hardware-safe area.
        // The bubble sits above/right of the Training Car and its tail points back left.
        beginnerMarker.position.set(x + 2.0, 4.85, z + 0.65);
        lot.add(beginnerMarker);
      }

      const target = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 3.2, 5.8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      target.position.set(x, 1.5, z);
      target.userData.turnLotCarId = car.id;
      lot.add(target);
      hitTargets.push(target);

      createCarVisual({
        carId: car.id,
        color: getVehicleDefaultColor(car.id),
        secondaryColor: getVehicleDefaultSecondaryColor(car.id),
        targetLength: 5.15,
        outline: true
      }).then((visual) => {
        if (disposed) {
          disposeVisualMaterials(visual);
          return;
        }
        visual.position.set(x, 0.08, z);
        visual.rotation.y = Math.PI;
        visual.userData.turnLotCarId = car.id;
        visual.traverse((node) => {
          if (node.isMesh) node.userData.turnLotCarId = car.id;
        });
        rememberMaterialState(visual);
        lot.add(visual);
        carRoots.set(car.id, visual);
        applyLotCarPresentation(
          visual,
          car.id,
          car.id === selectedCarId,
          selectedColor,
          selectedSecondaryColor
        );
        loadedCars += 1;
        if (loadedCars >= LOT_CARS.length) loading.classList.add('is-done');
      }).catch((error) => {
        console.warn(`TURN: could not load ${car.name} in The Lot.`, error);
        loadedCars += 1;
        if (loadedCars >= LOT_CARS.length) loading.classList.add('is-done');
      });
    }

    function syncLockMarkers() {
      for (const [carId, marker] of lockMarkers) {
        marker.visible = carButtons.get(carId)?.classList.contains('is-trophy-locked') === true;
      }
    }

    const lockObserver = new MutationObserver(syncLockMarkers);
    lockObserver.observe(carPicker, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
    window.addEventListener('turn:trophy-road-updated', syncLockMarkers);
    queueMicrotask(syncLockMarkers);

    function updateSelectionUi({ refreshViewer = true } = {}) {
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

      for (const [carId, platform] of platforms) {
        setParkingPadSelected(platform, carId === selectedCarId);
      }

      for (const [carId, root] of carRoots) {
        const selected = carId === selectedCarId;
        root.userData.turnLotSelected = selected;
        applyLotCarPresentation(root, carId, selected, selectedColor, selectedSecondaryColor);
      }

      if (refreshViewer) void viewer.show(selectedCarId, selectedColor, selectedSecondaryColor);
    }

    function selectCar(carId, { focus = false } = {}) {
      if (!carId) return;
      const changedCar = carId !== selectedCarId;
      selectedCarId = carId;
      if (changedCar) {
        selectedColor = getVehicleDefaultColor(carId);
        selectedSecondaryColor = getVehicleDefaultSecondaryColor(carId);
      }
      updateSelectionUi();
      if (focus) carButtons.get(carId)?.focus();
      navigator.vibrate?.(16);
    }

    carPicker.addEventListener('keydown', (event) => {
      const currentIndex = LOT_CARS.findIndex((car) => car.id === selectedCarId);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % LOT_CARS.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + LOT_CARS.length) % LOT_CARS.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = LOT_CARS.length - 1;
      if (nextIndex === currentIndex) return;
      event.preventDefault();
      selectCar(LOT_CARS[nextIndex].id, { focus: true });
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

      const inputLabel = document.createElement('label');
      inputLabel.className = 'lot-color-name';
      inputLabel.htmlFor = input.id;

      const name = document.createElement('span');
      name.className = 'lot-color-label';
      name.textContent = label.toUpperCase();

      const cue = document.createElement('span');
      cue.className = 'turn-color-cue lot-color-cue';

      const syncCue = () => {
        cue.textContent = `COLOR · ${describeColorCue(input.value).toUpperCase()}`;
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
      const selectedRoot = carRoots.get(selectedCarId);
      if (selectedRoot) {
        applyLotCarPresentation(
          selectedRoot,
          selectedCarId,
          true,
          selectedColor,
          selectedSecondaryColor
        );
      }
      viewer.recolor(selectedColor, selectedSecondaryColor);
    }

    renderer.domElement.addEventListener('pointerdown', (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...hitTargets, ...carRoots.values()], true);
      const carId = hits.map((hit) => findCarId(hit.object)).find(Boolean);
      selectCar(carId);
    });

    raceButton.addEventListener('click', () => finish({
      carId: selectedCarId,
      color: selectedColor,
      secondaryColor: selectedSecondaryColor
    }));
    backButton.addEventListener('click', () => finish(null));

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(host);
    resizeObserver.observe(viewHost);

    function finish(result) {
      if (disposed) return;
      disposed = true;
      lockObserver.disconnect();
      window.removeEventListener('turn:trophy-road-updated', syncLockMarkers);
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      for (const root of carRoots.values()) disposeVisualMaterials(root);
      viewer.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
      overlay.remove();
      document.body.classList.remove('turn-lot-open');
      resolve(result ? normalizeVehicleSelection(result) : null);
    }

    function resize() {
      if (disposed) return;
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);

      const compact = camera.aspect < 1.45;
      camera.position.set(0, compact ? 32 : 28, compact ? 38 : 31);
      camera.lookAt(0, 0, -1.5);
      viewer.resize();
    }

    updateSelectionUi();
    resize();

    const clock = new THREE.Clock();
    let lastRenderAt = -Infinity;
    renderer.setAnimationLoop((now) => {
      if (disposed || now - lastRenderAt < LOT_FRAME_INTERVAL_MS) return;
      lastRenderAt = now;
      const elapsed = clock.getElapsedTime();
      for (const root of carRoots.values()) {
        const selected = Boolean(root.userData.turnLotSelected);
        const targetScale = selected ? 1.08 : 1;
        root.scale.setScalar(THREE.MathUtils.lerp(root.scale.x, targetScale, 0.12));
        root.position.y = selected ? 0.13 + Math.sin(elapsed * 3.1) * 0.07 : 0.08;
      }
      camera.position.x = Math.sin(elapsed * 0.12) * 1.5;
      camera.lookAt(0, 0, -1.5);
      renderer.render(scene, camera);
      const viewerRendered = !viewbox.hidden && viewer.render(elapsed);
      recordPerformanceFrame(
        'lot',
        viewerRendered ? [renderer, viewer.renderer] : renderer,
        now
      );
    });
  });
}

function createViewer(host) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(rendererPixelRatio(1.5));
  host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(7.8, 4.8, 8.8);
  camera.lookAt(0, 1.1, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5b6770, 3.2));
  const key = new THREE.DirectionalLight(0xfff2c9, 4.2);
  key.position.set(-6, 10, 7);
  scene.add(key);

  const stage = new THREE.Group();
  scene.add(stage);

  let visual = null;
  let generation = 0;
  let currentColor = DEFAULT_VEHICLE_COLOR;
  let currentSecondaryColor = DEFAULT_VEHICLE_SECONDARY_COLOR;
  let yaw = VIEWER_INITIAL_YAW;
  let pitch = 0.08;
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;

  host.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    host.setPointerCapture?.(event.pointerId);
  });

  host.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== pointerId) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    yaw += dx * 0.012;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.0035, -0.12, 0.24);
  });

  const stopDrag = (event) => {
    if (pointerId !== null && event?.pointerId != null && event.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
  };
  host.addEventListener('pointerup', stopDrag);
  host.addEventListener('pointercancel', stopDrag);
  host.addEventListener('lostpointercapture', stopDrag);

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
          targetLength: 6.4,
          outline: true
        });
        if (request !== generation) {
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
        pitch = 0.08;
      } catch (error) {
        console.warn('TURN: selected car could not load in the 3D viewer.', error);
      }
    },
    recolor(color, secondaryColor) {
      currentColor = normalizeVehicleColor(color);
      currentSecondaryColor = normalizeVehicleSecondaryColor(secondaryColor);
      if (visual) recolorCarVisual(visual, currentColor, currentSecondaryColor);
    },
    resize() {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setSize(Math.round(rect.width), Math.round(rect.height), false);
    },
    render(elapsed) {
      if (!dragging) yaw += 0.0024;
      stage.rotation.y = yaw;
      stage.rotation.x = pitch;
      if (visual) visual.position.y = Math.sin(elapsed * 2.1) * 0.04;
      renderer.render(scene, camera);
      return true;
    },
    dispose() {
      generation += 1;
      if (visual) {
        stage.remove(visual);
        disposeVisualMaterials(visual);
        visual = null;
      }
      renderer.dispose();
      renderer.forceContextLoss?.();
      renderer.domElement.remove();
    }
  };
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

function rememberMaterialState(root) {
  if (root.userData.turnLotMaterialState) return;
  const paintMaterials = new Set(root.userData.turnPaintMaterials || []);
  const records = [];

  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      records.push({
        material,
        paint: paintMaterials.has(material),
        outline: Boolean(node.userData?.turnOutline),
        color: material.color?.clone?.() || null,
        transparent: material.transparent,
        opacity: material.opacity,
        depthWrite: material.depthWrite
      });
    }
  });

  root.userData.turnLotMaterialState = records;
}

function applyLotCarPresentation(root, carId, selected, selectedColor, selectedSecondaryColor) {
  rememberMaterialState(root);
  const records = root.userData.turnLotMaterialState || [];

  for (const record of records) {
    const { material } = record;
    material.transparent = record.transparent;
    material.opacity = record.opacity;
    material.depthWrite = record.depthWrite;
    if (!record.paint && record.color && material.color) material.color.copy(record.color);
    material.needsUpdate = true;
  }

  recolorCarVisual(
    root,
    selected ? selectedColor : getVehicleDefaultColor(carId),
    selected ? selectedSecondaryColor : getVehicleDefaultSecondaryColor(carId)
  );
}

function makeLotGround(lot) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 34),
    new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  lot.add(ground);

  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xfff8e8 });
  for (let row = 0; row < 3; row += 1) {
    const z = (1 - row) * 7.2;
    for (let column = -2; column <= 3; column += 1) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 5.8), stripeMaterial);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set((column - 0.5) * 8.1, 0.014, z);
      lot.add(stripe);
    }
  }

  const centerLine = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xffd43b })
  );
  centerLine.rotation.x = -Math.PI / 2;
  centerLine.position.set(0, 0.016, 10.8);
  lot.add(centerLine);
}

function makeParkingPad(selected = false) {
  const group = new THREE.Group();
  const width = 6.7;
  const depth = 5.8;

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({
      color: 0xffd43b,
      transparent: true,
      opacity: 0.72,
      depthWrite: false
    })
  );
  fill.rotation.x = -Math.PI / 2;
  fill.position.y = 0.003;
  fill.renderOrder = 2;
  group.add(fill);

  const borderMaterial = new THREE.MeshBasicMaterial({ color: 0x08090a, depthWrite: false });
  const border = new THREE.Group();
  const horizontal = new THREE.PlaneGeometry(width, 0.18);
  const vertical = new THREE.PlaneGeometry(0.18, depth);
  for (const z of [-depth / 2, depth / 2]) {
    const edge = new THREE.Mesh(horizontal, borderMaterial);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(0, 0.008, z);
    border.add(edge);
  }
  for (const x of [-width / 2, width / 2]) {
    const edge = new THREE.Mesh(vertical, borderMaterial);
    edge.rotation.x = -Math.PI / 2;
    edge.position.set(x, 0.008, 0);
    border.add(edge);
  }
  group.add(border);

  const pointerOutline = new THREE.Mesh(
    new THREE.ConeGeometry(0.58, 1.05, 3),
    new THREE.MeshBasicMaterial({ color: 0x08090a, depthWrite: false })
  );
  pointerOutline.position.set(0, 3.2, 0.1);
  pointerOutline.rotation.z = Math.PI;
  pointerOutline.renderOrder = 102;
  group.add(pointerOutline);

  const pointer = new THREE.Mesh(
    new THREE.ConeGeometry(0.43, 0.78, 3),
    new THREE.MeshBasicMaterial({ color: 0xffd43b, depthWrite: false })
  );
  pointer.position.set(0, 3.18, 0.1);
  pointer.rotation.z = Math.PI;
  pointer.renderOrder = 103;
  group.add(pointer);

  group.userData.turnLotPadFill = fill;
  group.userData.turnLotPadBorder = border;
  group.userData.turnLotPadPointerOutline = pointerOutline;
  group.userData.turnLotPadPointer = pointer;
  setParkingPadSelected(group, selected);
  return group;
}

function setParkingPadSelected(group, selected) {
  const visible = Boolean(selected);
  group.userData.turnLotPadFill.visible = visible;
  group.userData.turnLotPadBorder.visible = visible;
  group.userData.turnLotPadPointerOutline.visible = visible;
  group.userData.turnLotPadPointer.visible = visible;
}

function makeLockMarker() {
  const material = new THREE.SpriteMaterial({
    map: getLockBadgeTexture(),
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.35, 2.35, 1);
  sprite.renderOrder = 120;
  return sprite;
}

function makeBeginnerFriendlyMarker() {
  const material = new THREE.SpriteMaterial({
    map: getBeginnerBadgeTexture(),
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(5.7, 3.15, 1);
  sprite.renderOrder = 121;
  return sprite;
}

function getLockBadgeTexture() {
  if (lockBadgeTexture) return lockBadgeTexture;

  const icon = LOCK_ICON
    .replace(/^<svg[^>]*>/, '')
    .replace(/<\/svg>$/, '');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <rect x="18" y="18" width="124" height="124" rx="28"
        fill="#ffd43b" stroke="#08090a" stroke-width="10"/>
      <g transform="translate(40 40) scale(3.333333)"
        fill="none" stroke="#08090a" stroke-width="2.4"
        stroke-linecap="round" stroke-linejoin="round">
        ${icon}
      </g>
    </svg>`;

  lockBadgeTexture = new THREE.TextureLoader().load(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  );
  lockBadgeTexture.colorSpace = THREE.SRGBColorSpace;
  return lockBadgeTexture;
}

function getBeginnerBadgeTexture() {
  if (beginnerBadgeTexture) return beginnerBadgeTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  const scale = 2;
  const width = canvas.width / scale;
  const height = canvas.height / scale;
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);

  // Draw the body and pointer as one continuous silhouette. Besides matching the
  // reference more closely, this removes the horizontal seam created by the old
  // rounded-rectangle-plus-triangle construction.
  const left = 10;
  const top = 10;
  const right = 350;
  const bottom = 146;
  const radius = 34;
  const tailLeft = 83;
  const tailRight = 133;
  const tailTipX = 108;
  const tailTipY = 191;

  ctx.beginPath();
  ctx.moveTo(left + radius, top);
  ctx.lineTo(right - radius, top);
  ctx.quadraticCurveTo(right, top, right, top + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(tailRight, bottom);
  ctx.lineTo(tailTipX, tailTipY);
  ctx.lineTo(tailLeft, bottom);
  ctx.lineTo(left + radius, bottom);
  ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
  ctx.lineTo(left, top + radius);
  ctx.quadraticCurveTo(left, top, left + radius, top);
  ctx.closePath();

  ctx.fillStyle = '#fff8e8';
  ctx.fill();
  ctx.strokeStyle = '#08090a';
  ctx.lineWidth = 10;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.fillStyle = '#08090a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 37px system-ui, sans-serif';
  ctx.fillText('BEGINNER-', 180, 58);
  ctx.fillText('FRIENDLY', 180, 108);

  beginnerBadgeTexture = new THREE.CanvasTexture(canvas);
  beginnerBadgeTexture.colorSpace = THREE.SRGBColorSpace;
  return beginnerBadgeTexture;
}

function findCarId(object) {
  let node = object;
  while (node) {
    if (node.userData?.turnLotCarId) return node.userData.turnLotCarId;
    node = node.parent;
  }
  return null;
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
