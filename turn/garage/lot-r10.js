import * as THREE from 'three';
import {
  CAR_CATALOG,
  DEFAULT_VEHICLE_COLOR,
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  VEHICLE_STAT_LEGEND,
  getCarDefinition,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor,
  normalizeVehicleSelection
} from '../vehicle/catalog.js?build=20260724-r59';
import { createCarVisual, recolorCarVisual } from '../vehicle/car-models.js?build=20260720-r22';
import { recordPerformanceFrame } from '../performance-monitor.js?build=20260720-r20';

const UNSELECTED_COLOR = new THREE.Color(0x313131);
const VIEWER_INITIAL_YAW = Math.PI - 0.55;

export function showTheLot({ initialSelection } = {}) {
  return new Promise((resolve) => {
    const selection = normalizeVehicleSelection(initialSelection);
    const overlay = document.createElement('section');
    overlay.className = 'lot-screen';
    overlay.setAttribute('aria-label', 'The Lot car selection');
    overlay.innerHTML = `
      <div class="lot-canvas-host" aria-hidden="true"></div>
      <header class="lot-heading">
        <span>TURN GARAGE</span>
        <h1>THE LOT</h1>
        <p>Pick a ride. Then paint it.</p>
      </header>
      <button class="lot-back" type="button" aria-label="Back to start">×</button>

      <div class="lot-side">
        <section class="lot-viewbox" aria-label="Rotatable 3D view of selected car">
          <div class="lot-viewbox-head">
            <span>3D VIEW</span>
            <button class="lot-view-close" type="button" aria-label="Close 3D car view">×</button>
          </div>
          <div class="lot-view-host"></div>
          <small>DRAG TO ROTATE</small>
        </section>

        <aside class="lot-card" aria-live="polite">
          <div class="lot-car-title">
            <span>YOUR RIDE</span>
            <strong></strong>
          </div>
          <div class="lot-stats"></div>
          <button class="lot-stats-help" type="button" aria-expanded="false" aria-controls="lotStatsLegend">WHAT DO THE STATS MEAN?</button>
          <section class="lot-stats-legend" id="lotStatsLegend" hidden aria-label="Vehicle stat legend"></section>
          <div class="lot-colors" aria-label="Choose car paint colours"></div>
          <div class="lot-card-actions">
            <button class="lot-view-open" type="button" hidden>VIEW 3D</button>
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
    const stats = overlay.querySelector('.lot-stats');
    const statsHelp = overlay.querySelector('.lot-stats-help');
    const statsLegend = overlay.querySelector('.lot-stats-legend');
    const colors = overlay.querySelector('.lot-colors');
    const raceButton = overlay.querySelector('.lot-race');
    const backButton = overlay.querySelector('.lot-back');
    const loading = overlay.querySelector('.lot-loading');
    const viewbox = overlay.querySelector('.lot-viewbox');
    const viewHost = overlay.querySelector('.lot-view-host');
    const viewClose = overlay.querySelector('.lot-view-close');
    const viewOpen = overlay.querySelector('.lot-view-open');

    statsLegend.replaceChildren(...VEHICLE_STAT_LEGEND.map((entry) => {
      const item = document.createElement('div');
      item.className = 'lot-stats-legend-item';
      item.innerHTML = `<strong>${entry.label}</strong><p>${entry.description}</p>`;
      return item;
    }));

    statsHelp.addEventListener('click', () => {
      const expanded = statsHelp.getAttribute('aria-expanded') === 'true';
      statsHelp.setAttribute('aria-expanded', String(!expanded));
      statsLegend.hidden = expanded;
    });

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
    let selectedCarId = selection.carId;
    let selectedColor = selection.color;
    let selectedSecondaryColor = selection.secondaryColor;
    let disposed = false;
    let loadedCars = 0;

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
      stats.replaceChildren(...makeStats(car.stats));
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

    function selectCar(carId) {
      if (!carId) return;
      const changedCar = carId !== selectedCarId;
      selectedCarId = carId;
      if (changedCar) {
        selectedColor = DEFAULT_VEHICLE_COLOR;
        selectedSecondaryColor = DEFAULT_VEHICLE_SECONDARY_COLOR;
      }
      updateSelectionUi();
      navigator.vibrate?.(16);
    }

    function makeColorInput({ label, value, secondary = false, onInput }) {
      const control = document.createElement('label');
      control.className = 'lot-color-control';

      const name = document.createElement('span');
      name.textContent = label.toUpperCase();

      const input = document.createElement('input');
      input.type = 'color';
      input.className = 'lot-color-input';
      input.value = secondary
        ? normalizeVehicleSecondaryColor(value)
        : normalizeVehicleColor(value);
      input.setAttribute('aria-label', `Choose ${label.toLowerCase()} colour`);
      input.addEventListener('input', () => onInput(input.value));

      control.append(name, input);
      return control;
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

    viewClose.addEventListener('click', () => {
      viewbox.hidden = true;
      viewOpen.hidden = false;
      overlay.classList.add('is-view-closed');
      resize();
    });

    viewOpen.addEventListener('click', () => {
      viewbox.hidden = false;
      viewOpen.hidden = true;
      overlay.classList.remove('is-view-closed');
      resize();
      viewer.resize();
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
  key.position.set(-6, 9, 7);
  scene.add(key);

  let activeRoot = null;
  let requestId = 0;
  let yaw = VIEWER_INITIAL_YAW;
  let dragging = false;
  let lastX = 0;

  function disposeActive() {
    if (!activeRoot) return;
    scene.remove(activeRoot);
    activeRoot = null;
  }

  function show(carId, color, secondaryColor) {
    const token = ++requestId;
    return createCarVisual({ carId, color, secondaryColor, targetLength: 5.7, outline: true }).then((root) => {
      if (token !== requestId) return;
      disposeActive();
      root.rotation.y = yaw;
      scene.add(root);
      activeRoot = root;
    });
  }

  function recolor(color, secondaryColor) {
    if (activeRoot) recolorCarVisual(activeRoot, color, secondaryColor);
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
    camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
    camera.updateProjectionMatrix();
  }

  function render() {
    if (activeRoot) activeRoot.rotation.y = yaw;
    renderer.render(scene, camera);
    return true;
  }

  function dispose() {
    disposeActive();
    renderer.dispose();
  }

  host.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    host.setPointerCapture?.(event.pointerId);
  });
  host.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    yaw += (event.clientX - lastX) * 0.012;
    lastX = event.clientX;
  });
  host.addEventListener('pointerup', () => { dragging = false; });
  host.addEventListener('pointercancel', () => { dragging = false; });

  return { renderer, show, recolor, resize, render, dispose };
}

function makeLotGround(lot) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 34),
    new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  lot.add(ground);
}

function makeParkingPad(selected) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(6.7, 5.9),
    new THREE.MeshBasicMaterial({ color: selected ? 0x38d9ff : 0x61676d, transparent: true, opacity: selected ? 0.5 : 0.26 })
  );
  mesh.rotation.x = -Math.PI / 2;
  group.add(mesh);
  group.userData.turnPadMesh = mesh;
  return group;
}

function setParkingPadSelected(platform, selected) {
  const mesh = platform.userData.turnPadMesh;
  if (!mesh) return;
  mesh.material.color.set(selected ? 0x38d9ff : 0x61676d);
  mesh.material.opacity = selected ? 0.5 : 0.26;
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
    row.innerHTML = `<span>${label}</span><i>${Array.from({ length: 5 }, (_, index) => `<b class="${index < value ? 'is-full' : ''}"></b>`).join('')}</i>`;
    return row;
  });
}

function rememberMaterialState(root) {
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material?.color) continue;
      material.userData.turnOriginalColor = material.color.clone();
    }
  });
}

function applyLotCarPresentation(root, selected, color, secondaryColor) {
  if (selected) {
    recolorCarVisual(root, color, secondaryColor);
    return;
  }
  root.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material?.color) material.color.copy(UNSELECTED_COLOR);
    }
  });
}
