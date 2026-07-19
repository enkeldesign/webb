import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  CAR_CATALOG,
  CAR_PALETTE,
  getCarDefinition,
  normalizeVehicleSelection
} from '../vehicle/catalog.js';
import { createCarVisual, recolorCarVisual } from '../vehicle/car-models.js';

const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const lotLoader = new GLTFLoader();

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
      <aside class="lot-card" aria-live="polite">
        <div class="lot-car-title">
          <span>YOUR RIDE</span>
          <strong></strong>
        </div>
        <div class="lot-stats"></div>
        <div class="lot-colors" aria-label="Choose car colour"></div>
        <button class="lot-race" type="button">RACE THIS CAR</button>
      </aside>
      <div class="lot-loading">ROLLING OUT THE CARS…</div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add('turn-lot-open');

    const host = overlay.querySelector('.lot-canvas-host');
    const title = overlay.querySelector('.lot-car-title strong');
    const stats = overlay.querySelector('.lot-stats');
    const colors = overlay.querySelector('.lot-colors');
    const raceButton = overlay.querySelector('.lot-race');
    const backButton = overlay.querySelector('.lot-back');
    const loading = overlay.querySelector('.lot-loading');

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

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const hitTargets = [];
    const carRoots = new Map();
    const platforms = new Map();
    let selectedCarId = selection.carId;
    let selectedColor = selection.color;
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

      const showcaseColor = CAR_PALETTE[CAR_CATALOG.indexOf(car) % CAR_PALETTE.length].value;
      createCarVisual({
        carId: car.id,
        color: car.id === selectedCarId ? selectedColor : showcaseColor,
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
        lot.add(visual);
        carRoots.set(car.id, visual);
        loadedCars += 1;
        if (loadedCars >= CAR_CATALOG.length) loading.classList.add('is-done');
      }).catch((error) => {
        console.warn(`TURN: could not load ${car.name} in The Lot.`, error);
        loadedCars += 1;
        if (loadedCars >= CAR_CATALOG.length) loading.classList.add('is-done');
      });
    }

    installBrickScenery(lot).catch((error) => {
      console.warn('TURN: The Lot Brick Kit scenery could not load.', error);
    });

    function updateSelectionUi() {
      const car = getCarDefinition(selectedCarId);
      title.textContent = car.name;
      stats.replaceChildren(...makeStats(car.stats));
      colors.replaceChildren(...CAR_PALETTE.map((entry) => makeColorButton(entry)));

      for (const [carId, platform] of platforms) {
        setParkingPadSelected(platform, carId === selectedCarId);
      }
      for (const [carId, root] of carRoots) {
        root.userData.turnLotSelected = carId === selectedCarId;
      }
      const selectedRoot = carRoots.get(selectedCarId);
      if (selectedRoot) recolorCarVisual(selectedRoot, selectedColor);
    }

    function makeColorButton(entry) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'lot-color';
      button.style.setProperty('--lot-color', entry.value);
      button.title = entry.name;
      button.setAttribute('aria-label', entry.name);
      button.setAttribute('aria-pressed', String(entry.value === selectedColor));
      button.addEventListener('click', () => {
        selectedColor = entry.value;
        const selectedRoot = carRoots.get(selectedCarId);
        if (selectedRoot) recolorCarVisual(selectedRoot, selectedColor);
        colors.querySelectorAll('.lot-color').forEach((colorButton) => {
          colorButton.setAttribute('aria-pressed', String(colorButton === button));
        });
      });
      return button;
    }

    renderer.domElement.addEventListener('pointerdown', (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects([...hitTargets, ...carRoots.values()], true);
      const carId = hits.map((hit) => findCarId(hit.object)).find(Boolean);
      if (!carId) return;
      selectedCarId = carId;
      updateSelectionUi();
      navigator.vibrate?.(16);
    });

    raceButton.addEventListener('click', () => finish({ carId: selectedCarId, color: selectedColor }));
    backButton.addEventListener('click', () => finish(null));

    function finish(result) {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      renderer.dispose();
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
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const originalFinish = finish;
    finish = (result) => {
      resizeObserver.disconnect();
      originalFinish(result);
    };

    updateSelectionUi();
    resize();

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      if (disposed) return;
      const elapsed = clock.getElapsedTime();
      for (const root of carRoots.values()) {
        const selected = Boolean(root.userData.turnLotSelected);
        const targetScale = selected ? 1.08 : 1;
        root.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.12);
        root.position.y = selected ? 0.13 + Math.sin(elapsed * 3.1) * 0.07 : 0.08;
      }
      camera.position.x = Math.sin(elapsed * 0.12) * 1.5;
      camera.lookAt(0, 0, -1.5);
      renderer.render(scene, camera);
    });
  });
}

function makeLotGround(lot) {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 34),
    new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
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
    ['ACCEL', vehicleStats.acceleration],
    ['CONTROL', vehicleStats.control],
    ['DRIFT', vehicleStats.drift],
    ['BOOST', vehicleStats.boostPower],
    ['BOOST TANK', vehicleStats.boostDuration]
  ];

  return rows.map(([label, value]) => {
    const row = document.createElement('div');
    row.className = 'lot-stat';
    row.innerHTML = `<span>${label}</span><i>${Array.from({ length: 5 }, (_, index) => `<b class="${index < value ? 'is-full' : ''}"></b>`).join('')}</i>`;
    return row;
  });
}

async function installBrickScenery(lot) {
  const palette = [0xffd43b, 0xff4fa3, 0x38d9ff, 0x8ce99a, 0x9775fa];
  const placements = [
    [-23, 0, -13, 0], [-20, 0, -14, 0.25], [20, 0, -14, -0.2], [23, 0, -12, 0],
    [-23, 0, 13, 0.3], [-19, 0, 14, 0], [19, 0, 14, 0], [23, 0, 12, -0.3], [0, 0, -15, 0]
  ];

  await Promise.all(placements.map(async (placement, index) => {
    const gltf = await lotLoader.loadAsync(brickUrl(index + 1));
    const model = gltf.scene.clone(true);
    const color = new THREE.Color(palette[index % palette.length]);
    model.traverse((node) => {
      if (!node.isMesh || !node.material) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      const clones = materials.map((material) => {
        const clone = material.clone();
        clone.color?.lerp(color, 0.72);
        return clone;
      });
      node.material = Array.isArray(node.material) ? clones : clones[0];
    });
    normalizeProp(model, 3.2 + (index % 3) * 0.65);
    model.position.set(placement[0], placement[1], placement[2]);
    model.rotation.y = placement[3];
    lot.add(model);
  }));
}

function normalizeProp(model, targetSize) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const maxSize = Math.max(0.001, size.x, size.y, size.z);
  model.scale.setScalar(targetSize / maxSize);
  model.updateMatrixWorld(true);
  const nextBounds = new THREE.Box3().setFromObject(model);
  const center = nextBounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= nextBounds.min.y;
}

function brickUrl(index) {
  const url = new URL(`../assets/lot-bricks/brick-prop-${String(index).padStart(2, '0')}.glb`, import.meta.url);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}
