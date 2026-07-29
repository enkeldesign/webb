import * as THREE from 'three';
import {
  CAR_CATALOG,
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  getCarDefinition,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor,
  normalizeVehicleSelection
} from '../vehicle/catalog.js?build=20260720-r20';
import { createCarVisual, recolorCarVisual } from '../vehicle/car-models.js?build=20260720-r22';
import { recordPerformanceFrame } from '../performance-monitor.js?build=20260720-r20';

const UNSELECTED_COLOR = new THREE.Color(0x313131);
const VIEWER_INITIAL_YAW = Math.PI - 0.55;
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
  'suv-luxury': 'A large premium SUV with a tall body, wide grille and substantial presence.',
  'hatchback-sports': 'A compact sporty hatchback with a short rear and planted stance.',
  'truck-flat': 'A work truck with a cab at the front and an open flatbed behind it.',
  truck: 'A sturdy pickup truck with a separate cab and cargo bed.',
  van: 'A tall enclosed van with a boxy body and short bonnet.'
});

export function showTheLot({ initialSelection } = {}) {
  return new Promise((resolve) => {
    const selection = normalizeVehicleSelection(initialSelection);
    const overlay = document.createElement('section');
    overlay.className = 'lot-screen';
    overlay.setAttribute('aria-labelledby', 'lot-title');
    overlay.innerHTML = `
      <div class="lot-canvas-host" aria-hidden="true"></div>
      <header class="lot-heading">
        <h1 id="lot-title">THE LOT</h1>
        <p>Pick a ride. Then paint it.</p>
      </header>
      <button class="lot-back" type="button" aria-label="Back to start">×</button>

      <div class="lot-car-picker" role="radiogroup" aria-label="Choose a car"></div>

      <div class="lot-side">
        <section class="lot-viewbox" aria-hidden="true">
          <div class="lot-viewbox-head">
            <span>3D VIEW</span>
            <button class="lot-view-close" type="button" tabindex="-1">×</button>
          </div>
          <div class="lot-view-host"></div>
          <small>DRAG TO ROTATE</small>
        </section>

        <aside class="lot-card">
          <div class="lot-car-title">
            <span>YOUR RIDE</span>
            <strong></strong>
          </div>
          <p class="lot-car-description"></p>
          <div class="lot-stats"></div>
          <div class="lot-colors" aria-label="Choose car paint colours"></div>
          <div class="lot-card-actions">
            <button class="lot-view-open" type="button" hidden aria-hidden="true" tabindex="-1">VIEW 3D</button>
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
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55));
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
    let selectedCarId = selection.carId;
    let selectedColor = selection.color;
    let selectedSecondaryColor = selection.secondaryColor;
    let disposed = false;
    let loadedCars = 0;

    for (const car of CAR_CATALOG) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lot-car-option';
      button.setAttribute('role', 'radio');
      button.dataset.carId = car.id;
      button.textContent = car.name;
      button.addEventListener('click', () => selectCar(car.id));
      carPicker.appendChild(button);
      carButtons.set(car.id, button);
    }

    const positions = CAR_CATALOG.map((car, index) => ({
      car,
      x: (index % 5 - 2) * 8.1,
      z: (1 - Math.floor(index / 5)) * 7.2
    }));

    for (const { car, x, z } of positions) {
      const platform = makeParkingPad(car.id === selectedCarId);
      platform.position.set(x, 0.025, z);
      lot.add(platform);
      platforms.set(car.id, platform);

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
        color: DEFAULT_VEHICLE_COLOR,
        secondaryColor: DEFAULT_VEHICLE_SECONDARY_COLOR,
        targetLength: 5.15,
        outline: true
      }).then((visual) => {
        if (disposed) return;
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
          car.id === selectedCarId,
          selectedColor,
          selectedSecondaryColor
        );
        loadedCars += 1;
        if (loadedCars >= CAR_CATALOG.length) loading.classList.add('is-done');
      }).catch((error) => {
        console.warn(`TURN: could not load ${car.name} in The Lot.`, error);
        loadedCars += 1;
        if (loadedCars >= CAR_CATALOG.length) loading.classList.add('is-done');
      });
    }

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
        button.setAttribute('aria-label', `${getCarDefinition(carId).name}. ${CAR_DESCRIPTIONS[carId] || ''}`.trim());
      }

      const paintControls = [makeColorInput({
        label: 'Body',
        value: selectedColor,
        onInput(value) {
          selectedColor = normalizeVehicleColor(value);
          applySelectedPaint();
          updatePaintAccessibleNames();
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
            updatePaintAccessibleNames();
          }
        }));
      }
      colors.replaceChildren(...paintControls);
      updatePaintAccessibleNames();

      for (const [carId, platform] of platforms) {
        setParkingPadSelected(platform, carId === selectedCarId);
      }

      for (const [carId, root] of carRoots) {
        const selected = carId === selectedCarId;
        root.userData.turnLotSelected = selected;
        applyLotCarPresentation(root, selected, selectedColor, selectedSecondaryColor);
      }

      if (refreshViewer) void viewer.show(selectedCarId, selectedColor, selectedSecondaryColor);
    }

    function selectCar(carId, { focus = false } = {}) {
      if (!carId) return;
      const changedCar = carId !== selectedCarId;
      selectedCarId = carId;
      if (changedCar) {
        selectedColor = DEFAULT_VEHICLE_COLOR;
        selectedSecondaryColor = DEFAULT_VEHICLE_SECONDARY_COLOR;
      }
      updateSelectionUi();
      if (focus) carButtons.get(carId)?.focus();
      navigator.vibrate?.(16);
    }

    carPicker.addEventListener('keydown', (event) => {
      const currentIndex = CAR_CATALOG.findIndex((car) => car.id === selectedCarId);
      let nextIndex = currentIndex;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % CAR_CATALOG.length;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + CAR_CATALOG.length) % CAR_CATALOG.length;
      if (event.key === 'Home') nextIndex = 0;
      if (event.key === 'End') nextIndex = CAR_CATALOG.length - 1;
      if (nextIndex === currentIndex) return;
      event.preventDefault();
      selectCar(CAR_CATALOG[nextIndex].id, { focus: true });
    });

    function makeColorInput({ label, value, secondary = false, onInput }) {
      const control = document.createElement('label');
      control.className = 'lot-color-control';
      control.dataset.paintLabel = label;

      const name = document.createElement('span');
      name.textContent = label.toUpperCase();

      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'lot-color-input';
      input.value = secondary
        ? normalizeVehicleSecondaryColor(value)
        : normalizeVehicleColor(value);
      input.addEventListener('input', () => onInput(input.value));

      control.append(name, input);
      return control;
    }

    function updatePaintAccessibleNames() {
      colors.querySelectorAll('.lot-color-control').forEach((control) => {
        const input = control.querySelector('input');
        const label = control.dataset.paintLabel || 'Paint';
        const colourName = describeHexColor(input.value);
        input.setAttribute('aria-label', `${label} colour. ${colourName}`);
      });
    }

    function applySelectedPaint() {
      const selectedRoot = carRoots.get(selectedCarId);
      if (selectedRoot) {
        applyLotCarPresentation(selectedRoot, true, selectedColor, selectedSecondaryColor);
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
      resizeObserver.disconnect();
      renderer.setAnimationLoop(null);
      renderer.dispose();
      viewer.dispose();
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
    renderer.setAnimationLoop(() => {
      if (disposed) return;
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
        performance.now()
      );
    });
  });
}

function createViewer(host) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
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
        if (request !== generation) return;
        if (visual) stage.remove(visual);
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
      renderer.dispose();
    }
  };
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

function applyLotCarPresentation(root, selected, selectedColor, selectedSecondaryColor) {
  rememberMaterialState(root);
  const records = root.userData.turnLotMaterialState || [];

  for (const record of records) {
    const { material } = record;
    if (selected || record.outline) {
      material.transparent = record.transparent;
      material.opacity = record.opacity;
      material.depthWrite = record.depthWrite;
      if (!record.paint && record.color && material.color) material.color.copy(record.color);
    } else {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      if (material.color) material.color.copy(UNSELECTED_COLOR);
    }
    material.needsUpdate = true;
  }

  if (selected) {
    recolorCarVisual(
      root,
      selectedColor || DEFAULT_VEHICLE_COLOR,
      selectedSecondaryColor || DEFAULT_VEHICLE_SECONDARY_COLOR
    );
  }
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

function makeParkingPad() {
  return new THREE.Group();
}

function setParkingPadSelected() {}

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

function describeHexColor(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-f]{6}$/i.test(clean)) return 'custom colour';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * (((b - r) / delta) + 2);
    else hue = 60 * (((r - g) / delta) + 4);
  }
  if (hue < 0) hue += 360;

  if (lightness < 0.09) return 'black';
  if (lightness > 0.94 && saturation < 0.16) return 'white';
  if (saturation < 0.12) {
    if (lightness < 0.32) return 'dark grey';
    if (lightness > 0.72) return 'light grey';
    return 'grey';
  }

  const names = [
    [15, 'red'], [42, 'orange'], [68, 'yellow'], [105, 'yellow green'],
    [165, 'green'], [195, 'turquoise'], [225, 'blue'], [255, 'indigo'],
    [285, 'violet'], [330, 'magenta'], [360, 'red']
  ];
  const base = names.find(([limit]) => hue < limit)?.[1] || 'red';
  if (lightness < 0.28) return `dark ${base}`;
  if (lightness > 0.74) return `light ${base}`;
  return base;
}
