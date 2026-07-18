// TURN runtime adaptations.
// Keep the main prototype readable while applying experimental control/rendering changes
// before the module is evaluated.

globalThis.__turnAnalogGas = 0;

const KENNEY_SEDAN_URL =
  'https://cdn.jsdelivr.net/gh/wayne-wu/webgpu-crowd-simulation@8caf9be46ec35e26dc28b3ecae000d7aa4d0d177/public/sedan.glb';
const WORLD_ASSETS_MODULE_URL = new URL('./world-assets.js', location.href).href;

const response = await fetch('./game.js', { cache: 'no-store' });
if (!response.ok) throw new Error(`Could not load game.js (${response.status})`);
let source = await response.text();

function replaceRequired(search, replacement, label) {
  const next = source.replace(search, replacement);
  if (next === source) console.warn(`TURN patch not applied: ${label}`);
  source = next;
}

// Load glTF assets through the same Three.js version as the game.
replaceRequired(
  "import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';",
  `import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';\nimport { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';\nimport { installKenneyWorld } from '${WORLD_ASSETS_MODULE_URL}';`,
  'GLTFLoader and world asset imports'
);

// Let the new distant mountains sit at the horizon instead of disappearing into the old close fog.
replaceRequired(
  'scene.fog = new THREE.Fog(0x74c0fc, 110, 420);',
  'scene.fog = new THREE.Fog(0x74c0fc, 180, 700);',
  'longer horizon fog'
);

// Motion has two separate jobs:
// 1. Horizon roll is absolute and follows gravity in screen coordinates.
// 2. Steering is relative to the player's chosen neutral steering position.
// DeviceMotion coordinates use the device's natural axes, so rotate the gravity vector
// into the current screen axes before deriving roll.
// A horizon is 180-degree symmetric, so fold the result into the nearest upright half-turn
// to prevent the camera from choosing the mathematically equivalent upside-down solution.
replaceRequired(
  'function motionPoseFromGravity(event) {',
  `function getScreenOrientationAngle() {
  const degrees = Number.isFinite(screen.orientation?.angle)
    ? screen.orientation.angle
    : Number(window.orientation || 0);
  return THREE.MathUtils.degToRad(degrees);
}

function getScreenSpaceRoll(gravity) {
  const angle = getScreenOrientationAngle();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const screenX = gravity.x * cos + gravity.y * sin;
  const screenY = -gravity.x * sin + gravity.y * cos;
  let roll = normalizeAngle(Math.atan2(screenX, -screenY));

  if (roll > Math.PI / 2) roll -= Math.PI;
  if (roll < -Math.PI / 2) roll += Math.PI;

  return roll;
}

function motionPoseFromGravity(event) {`,
  'screen-space gravity helper'
);

replaceRequired(
  '    roll: normalizeAngle(Math.atan2(gravity.x, -gravity.y)),',
  '    roll: getScreenSpaceRoll(gravity),',
  'screen-space absolute roll'
);

// Steering keeps the sensitivity the player liked, but uses the opposite sign from raw roll.
replaceRequired(
  'state.steering = Math.sign(linearSteer) * Math.pow(Math.abs(linearSteer), 0.78);',
  'state.steering = -Math.sign(linearSteer) * Math.pow(Math.abs(linearSteer), 0.78);',
  'motion steering direction'
);

// The horizon must not use the steering calibration reference.
replaceRequired(
  `    const horizonRoll = normalizeAngle(state.roll - state.horizonRollReference);
    camera.rotateZ(-horizonRoll);`,
  '    camera.rotateZ(-state.roll);',
  'absolute horizon stabilization'
);

// Return acceleration/braking to direct controls. Pitch is no longer used for driving.
replaceRequired(
  /  const pitchDelta = state\.neutralPitch - state\.pitch;[\s\S]*?  state\.tiltDrive = Math\.sign\(pitchDelta\) \* Math\.pow\(driveMagnitude, 0\.72\);/,
  '  state.tiltDrive = 0;',
  'remove tilt drive input'
);
replaceRequired(
  '  const tiltGas = Math.max(0, state.tiltDrive);',
  '  const tiltGas = Math.max(0, globalThis.__turnAnalogGas || 0);',
  'analog throttle input'
);
replaceRequired(
  '  const tiltBrake = Math.max(0, -state.tiltDrive);',
  '  const tiltBrake = 0;',
  'remove tilt braking'
);
replaceRequired(
  "bindHold(gasButton, 'touchGas');",
  '// Gas is analog and handled by motion-adapter.js.',
  'remove digital gas binding'
);

// Build a clearly readable road: dark asphalt, red/white curbs and a dashed white centre line.
// The previous road triangles were wound downward, so the asphalt itself was back-face culled.
replaceRequired('const TRACK_WIDTH = 18;', 'const TRACK_WIDTH = 24;', 'wider road');

const roadFunction = `function makeRoad() {
  const roadPositions = [];
  const roadColors = [];
  const roadIndices = [];
  const asphaltDark = new THREE.Color(0x34383d);
  const asphaltLight = new THREE.Color(0x4a4f55);

  for (let i = 0; i <= TRACK_SAMPLES; i += 1) {
    const sample = samples[i % TRACK_SAMPLES];
    const left = sample.point.clone().addScaledVector(sample.normal, TRACK_WIDTH / 2);
    const right = sample.point.clone().addScaledVector(sample.normal, -TRACK_WIDTH / 2);
    left.y = 0.13;
    right.y = 0.13;
    roadPositions.push(left.x, left.y, left.z, right.x, right.y, right.z);

    const variation = THREE.MathUtils.clamp(
      0.42 + Math.sin(i * 0.19) * 0.12 + Math.sin(i * 0.73 + 1.4) * 0.07,
      0,
      1
    );
    const color = asphaltDark.clone().lerp(asphaltLight, variation);
    roadColors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }

  for (let i = 0; i < TRACK_SAMPLES; i += 1) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    // Reverse the old winding so the road faces upward toward the camera.
    roadIndices.push(a, c, b, b, c, d);
  }

  const roadGeometry = new THREE.BufferGeometry();
  roadGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeometry.setAttribute('color', new THREE.Float32BufferAttribute(roadColors, 3));
  roadGeometry.setIndex(roadIndices);
  roadGeometry.computeVertexNormals();

  const road = new THREE.Mesh(
    roadGeometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.98,
      metalness: 0,
      side: THREE.DoubleSide
    })
  );
  road.receiveShadow = true;
  world.add(road);

  const curbWidth = 1.75;
  const curbSegmentLength = 12;
  const curbColors = [new THREE.Color(0xe63946), new THREE.Color(0xfff8e8)];

  for (const side of [-1, 1]) {
    const positions = [];
    const colors = [];

    for (let i = 0; i < TRACK_SAMPLES; i += 1) {
      const current = samples[i];
      const next = samples[(i + 1) % TRACK_SAMPLES];
      const innerOffset = side * (TRACK_WIDTH / 2 - 0.05);
      const outerOffset = side * (TRACK_WIDTH / 2 + curbWidth);

      const a = current.point.clone().addScaledVector(current.normal, innerOffset).setY(0.165);
      const b = current.point.clone().addScaledVector(current.normal, outerOffset).setY(0.165);
      const c = next.point.clone().addScaledVector(next.normal, innerOffset).setY(0.165);
      const d = next.point.clone().addScaledVector(next.normal, outerOffset).setY(0.165);

      positions.push(
        a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z,
        b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z
      );

      const color = curbColors[Math.floor(i / curbSegmentLength) % 2];
      for (let vertex = 0; vertex < 6; vertex += 1) {
        colors.push(color.r, color.g, color.b);
      }
    }

    const curbGeometry = new THREE.BufferGeometry();
    curbGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    curbGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    curbGeometry.computeVertexNormals();

    const curb = new THREE.Mesh(
      curbGeometry,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.9,
        metalness: 0,
        side: THREE.DoubleSide
      })
    );
    curb.receiveShadow = true;
    world.add(curb);
  }

  const dashStep = 8;
  const dashCount = Math.ceil(TRACK_SAMPLES / dashStep);
  const dashGeometry = new THREE.BoxGeometry(0.34, 0.045, 5.2);
  const dashMaterial = new THREE.MeshStandardMaterial({
    color: 0xfaf8ee,
    roughness: 0.92,
    metalness: 0
  });
  const centreLine = new THREE.InstancedMesh(dashGeometry, dashMaterial, dashCount);
  const marker = new THREE.Object3D();
  let dashIndex = 0;

  for (let i = 0; i < TRACK_SAMPLES; i += dashStep) {
    const sample = samples[i];
    marker.position.copy(sample.point);
    marker.position.y = 0.19;
    marker.rotation.set(0, Math.atan2(sample.tangent.x, sample.tangent.z), 0);
    marker.updateMatrix();
    centreLine.setMatrixAt(dashIndex, marker.matrix);
    dashIndex += 1;
  }

  centreLine.instanceMatrix.needsUpdate = true;
  centreLine.receiveShadow = true;
  world.add(centreLine);
}`;

replaceRequired(
  /function makeRoad\(\) \{[\s\S]*?\n\}\n\nfunction makeScenery\(\) \{/,
  `${roadFunction}\n\nfunction makeScenery() {`,
  'road rendering'
);

// Keep only the large continuous ground procedural. Everything sitting on top of it now
// comes from Kenney models loaded by world-assets.js.
const sceneryFunction = `function makeScenery() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(520, 96),
    new THREE.MeshStandardMaterial({ color: 0x8ce99a, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  world.add(ground);

  installKenneyWorld({ world, samples, trackWidth: TRACK_WIDTH }).catch((error) => {
    console.warn('TURN: world assets failed to install.', error);
  });
}`;

replaceRequired(
  /function makeScenery\(\) \{[\s\S]*?\n\}\n\nfunction makeStartArch\(\) \{/,
  `${sceneryFunction}\n\nfunction makeStartArch() {`,
  'Kenney world scenery'
);

// Test a real Kenney vehicle asset. The procedural car remains in the scene as an invisible
// fallback so physics, ghost logic, and wheel animation code do not need to know about loading.
const ghostCarBlock = `const ghostCar = makeCar(0x38d9ff, 0.34);
ghostCar.visible = false;
ghostCar.traverse((node) => {
  if (node.isMesh) node.castShadow = false;
});
world.add(ghostCar);`;

const assetCarBlock = `${ghostCarBlock}

const proceduralPlayerParts = [...playerCar.children];
const proceduralGhostParts = [...ghostCar.children];

function makeAssetCar(sourceModel, ghost = false) {
  const model = sourceModel.clone(true);
  model.rotation.y = Math.PI;
  model.scale.setScalar(2.35);

  const originalMeshes = [];
  model.traverse((node) => {
    if (node.isMesh) originalMeshes.push(node);
  });

  for (const node of originalMeshes) {
    const sourceMaterials = Array.isArray(node.material) ? node.material : [node.material];
    const styledMaterials = sourceMaterials.map((material) => {
      const styled = material.clone();
      const materialName = styled.name || '';

      if (ghost) {
        styled.transparent = true;
        styled.opacity = 0.28;
        styled.depthWrite = false;
        styled.color?.lerp(new THREE.Color(0x38d9ff), 0.72);
      } else if (/paint/i.test(materialName)) {
        styled.color?.set(0xffd43b);
      }

      return styled;
    });

    node.material = Array.isArray(node.material) ? styledMaterials : styledMaterials[0];
    node.castShadow = !ghost;
    node.receiveShadow = true;

    const outline = new THREE.Mesh(
      node.geometry,
      new THREE.MeshBasicMaterial({
        color: 0x08090a,
        side: THREE.BackSide,
        transparent: ghost,
        opacity: ghost ? 0.14 : 0.88
      })
    );
    outline.scale.setScalar(1.045);
    outline.castShadow = false;
    node.add(outline);
  }

  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;

  return model;
}

async function installCarAssets() {
  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('${KENNEY_SEDAN_URL}');
    const playerAsset = makeAssetCar(gltf.scene, false);
    const ghostAsset = makeAssetCar(gltf.scene, true);

    for (const part of proceduralPlayerParts) part.visible = false;
    for (const part of proceduralGhostParts) part.visible = false;

    playerCar.add(playerAsset);
    ghostCar.add(ghostAsset);
    console.info('TURN: Kenney sedan asset loaded.');
  } catch (error) {
    console.warn('TURN: car asset failed to load, using procedural fallback.', error);
  }
}

installCarAssets();`;

replaceRequired(ghostCarBlock, assetCarBlock, 'Kenney sedan asset');

const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}

// Analog throttle: touch the pedal for a useful base input, drag upward for more
// and downward for less. Releasing the pedal always returns throttle to zero.
const gasButton = document.querySelector('#gasButton');
let gasPointerId = null;
let gasStartY = 0;
const GAS_BASE = 0.42;
const GAS_DRAG_RANGE = 110;

function setAnalogGas(value) {
  const throttle = Math.max(0, Math.min(1, value));
  globalThis.__turnAnalogGas = throttle;
  gasButton.style.setProperty('--gas-level', throttle.toFixed(3));
  gasButton.textContent = 'Gas';
  gasButton.setAttribute('aria-label', throttle > 0 ? `Gas ${Math.round(throttle * 100)} percent` : 'Gas');
}

function releaseGas(event) {
  if (gasPointerId === null || (event && event.pointerId !== gasPointerId)) return;
  gasButton.releasePointerCapture?.(gasPointerId);
  gasPointerId = null;
  gasButton.classList.remove('is-dragging');
  setAnalogGas(0);
}

gasButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  gasPointerId = event.pointerId;
  gasStartY = event.clientY;
  gasButton.setPointerCapture?.(event.pointerId);
  gasButton.classList.add('is-dragging');
  setAnalogGas(GAS_BASE);
});

gasButton.addEventListener('pointermove', (event) => {
  if (event.pointerId !== gasPointerId) return;
  event.preventDefault();
  const drag = (gasStartY - event.clientY) / GAS_DRAG_RANGE;
  setAnalogGas(GAS_BASE + drag);
});

gasButton.addEventListener('pointerup', releaseGas);
gasButton.addEventListener('pointercancel', releaseGas);
gasButton.addEventListener('lostpointercapture', () => {
  if (gasPointerId !== null) {
    gasPointerId = null;
    gasButton.classList.remove('is-dragging');
    setAnalogGas(0);
  }
});

setAnalogGas(0);
