import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { signalSecretAchievement } from '../achievements/secret-events.js?revision=r166-bella-records';

// Kenney Cube Pets · animal-cat.glb · CC0.
// Pinned mirror of the original pack asset so the model cannot drift between releases.
const BELLA_MODEL_URL =
  'https://cdn.jsdelivr.net/gh/satoLG/defend_the_crystal@99136ff0d498d327d912528be5c1931d24d6a8d1/apps/web/public/models/pets/animal-cat.glb';
const BELLA_SAMPLE_INDEX = 500;
const BELLA_SIDE = -1;
const BELLA_DISTANCE_FROM_ROAD = 42;
const BELLA_TANGENT_OFFSET = 18;
const BELLA_HEIGHT = 5.2;
const BELLA_SCALE = 0.58;
const BELLA_PERCH_HEIGHT = 8.25;
const REQUIRED_VEHICLE_ID = 'firetruck';
const DISCOVERY_DISTANCE = 76;
const DISCOVERY_DISTANCE_SQUARED = DISCOVERY_DISTANCE * DISCOVERY_DISTANCE;
const DISCOVERY_VIEW_DOT = 0.55;
const DISCOVERY_HOLD_MS = 650;

const BELLA_PALETTE = Object.freeze({
  cream: 0xd2c9af,
  sealBrown: 0x382c1f,
  paws: 0xd2c9af,
  eyes: 0x74a7ff,
  pupils: 0x08090a,
  leafDark: 0x1f7a45,
  leafMid: 0x369653,
  leafLight: 0x58b95d
});

const loader = new GLTFLoader();
let sourcePromise = null;

function loadKenneyCat() {
  if (!sourcePromise) sourcePromise = loader.loadAsync(BELLA_MODEL_URL);
  return sourcePromise;
}

function material(color, roughness = 0.92) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
}

function flatColorMaterial(color) {
  return new THREE.MeshBasicMaterial({ color, toneMapped: false });
}

function outlinedPrimitive(geometry, fillMaterial, outlineScale = 1.065) {
  const group = new THREE.Group();
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x08090a, side: THREE.BackSide, toneMapped: false })
  );
  outline.scale.setScalar(outlineScale);
  const fill = new THREE.Mesh(geometry, fillMaterial);
  fill.castShadow = true;
  fill.receiveShadow = true;
  group.add(outline, fill);
  return group;
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function applyBellaCoatGradient(scene) {
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const point = new THREE.Vector3();
  const light = new THREE.Color(BELLA_PALETTE.cream);
  const dark = new THREE.Color(BELLA_PALETTE.sealBrown);
  const mixed = new THREE.Color();

  scene.traverse((node) => {
    if ((!node.isMesh && !node.isSkinnedMesh) || !node.geometry?.attributes?.position) return;

    const geometry = node.geometry.clone();
    const positions = geometry.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    node.updateWorldMatrix(true, false);

    for (let index = 0; index < positions.count; index += 1) {
      point.fromBufferAttribute(positions, index);
      node.localToWorld(point);

      const normalizedX = Math.abs(point.x - center.x) / Math.max(size.x * 0.5, 0.001);
      const normalizedY = (point.y - bounds.min.y) / Math.max(size.y, 0.001);
      const normalizedZ = (point.z - bounds.min.z) / Math.max(size.z, 0.001);

      // The Kenney cat faces negative Z. Keep the body at the exact cream colour and
      // blend only the actual source vertices that form Bella's face, ears, legs and tail.
      const frontMask = 1 - smoothstep(0.24, 0.58, normalizedZ);
      const faceHeight = smoothstep(0.46, 0.62, normalizedY);
      const faceWidth = 1 - smoothstep(0.54, 0.88, normalizedX);
      const faceMask = frontMask * faceHeight * faceWidth;

      const earMask = frontMask * smoothstep(0.78, 0.94, normalizedY);
      const legHeight = 1 - smoothstep(0.17, 0.37, normalizedY);
      const legColumns = smoothstep(0.26, 0.5, normalizedX);
      const legMask = legHeight * legColumns;

      const tailDepth = smoothstep(0.68, 0.92, normalizedZ);
      const tailLower = smoothstep(0.08, 0.2, normalizedY);
      const tailUpper = 1 - smoothstep(0.58, 0.76, normalizedY);
      const tailSide = smoothstep(0.54, 0.86, normalizedX);
      const tailMask = tailDepth * tailLower * tailUpper * tailSide;

      const darkMix = Math.max(faceMask, earMask, legMask, tailMask);
      mixed.copy(light).lerp(dark, darkMix);
      colors[index * 3] = mixed.r;
      colors[index * 3 + 1] = mixed.g;
      colors[index * 3 + 2] = mixed.b;
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    node.geometry = geometry;
    node.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      toneMapped: false
    });
    node.castShadow = true;
    node.receiveShadow = true;
  });
}

function normalizeCat(scene) {
  applyBellaCoatGradient(scene);
  scene.updateMatrixWorld(true);
  let bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  scene.scale.multiplyScalar(BELLA_HEIGHT / Math.max(size.y, 0.001));
  scene.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(scene);
  const center = bounds.getCenter(new THREE.Vector3());
  scene.position.set(-center.x, -bounds.min.y, -center.z);
  return scene;
}

function eyeGradientMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      irisColor: { value: new THREE.Color(BELLA_PALETTE.eyes) },
      pupilColor: { value: new THREE.Color(BELLA_PALETTE.pupils) }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 irisColor;
      uniform vec3 pupilColor;
      varying vec2 vUv;
      void main() {
        float radius = length((vUv - vec2(0.5)) * 2.0);
        float pupilToIris = smoothstep(0.22, 0.82, radius);
        gl_FragColor = vec4(mix(pupilColor, irisColor, pupilToIris), 1.0);
      }
    `,
    side: THREE.DoubleSide,
    toneMapped: false
  });
}

function addBellaEyes(holder, bounds) {
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const eyeRadius = Math.max(size.x * 0.078, 0.22);
  const eyeSpacing = size.x * 0.13;
  const eyeY = bounds.min.y + size.y * 0.67;
  const eyeZ = bounds.min.z - size.z * 0.018;
  const gradient = eyeGradientMaterial();

  for (const xOffset of [-eyeSpacing, eyeSpacing]) {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(eyeRadius, 18), gradient);
    eye.position.set(center.x + xOffset, eyeY, eyeZ);
    eye.rotation.y = Math.PI;
    eye.scale.y = 1.08;
    eye.renderOrder = 5;
    eye.name = 'Bella eye · black pupil to #74A7FF iris';
    holder.add(eye);
  }
}

function createFallbackCat() {
  const holder = new THREE.Group();
  const cream = flatColorMaterial(BELLA_PALETTE.cream);
  const dark = flatColorMaterial(BELLA_PALETTE.sealBrown);
  const paws = flatColorMaterial(BELLA_PALETTE.paws);

  const body = outlinedPrimitive(new THREE.BoxGeometry(2.55, 2.25, 3.05), cream);
  body.position.y = 2.05;
  holder.add(body);

  const head = outlinedPrimitive(new THREE.BoxGeometry(2.2, 1.95, 1.9), cream);
  head.position.set(0, 3.65, -1.15);
  holder.add(head);

  const face = outlinedPrimitive(new THREE.BoxGeometry(1.42, 1.38, 0.24), dark, 1.035);
  face.position.set(0, 3.62, -2.17);
  holder.add(face);

  for (const x of [-0.58, 0.58]) {
    const ear = outlinedPrimitive(new THREE.ConeGeometry(0.44, 1.02, 4), dark, 1.045);
    ear.position.set(x, 4.9, -1.18);
    ear.rotation.y = Math.PI / 4;
    holder.add(ear);
  }

  for (const [x, z] of [[-0.83, -0.72], [0.83, -0.72], [-0.83, 0.72], [0.83, 0.72]]) {
    const leg = outlinedPrimitive(new THREE.BoxGeometry(0.62, 1.35, 0.62), dark, 1.04);
    leg.position.set(x, 0.92, z);
    holder.add(leg);
    const paw = outlinedPrimitive(new THREE.BoxGeometry(0.72, 0.38, 0.82), paws, 1.04);
    paw.position.set(x, 0.28, z - 0.08);
    holder.add(paw);
  }

  const tail = outlinedPrimitive(new THREE.BoxGeometry(0.56, 0.56, 2.75), dark, 1.045);
  tail.position.set(-1.18, 1.48, 1.58);
  tail.rotation.set(0.34, -0.36, -0.18);
  holder.add(tail);
  return holder;
}

function createRescueTree() {
  const tree = new THREE.Group();
  tree.name = 'Bella rescue tree';
  tree.userData.turnBellaRescueTree = true;
  tree.userData.turnBellaFoliage = 'green';
  tree.userData.turnBellaFoliagePalette = '#1F7A45 / #369653 / #58B95D';

  const bark = material(0x684027, 1);
  // Unlit foliage keeps every rescue-tree leaf visibly green under Countryside's warm sun.
  const leafDark = flatColorMaterial(BELLA_PALETTE.leafDark);
  const leafMid = flatColorMaterial(BELLA_PALETTE.leafMid);
  const leafLight = flatColorMaterial(BELLA_PALETTE.leafLight);

  const trunk = outlinedPrimitive(new THREE.CylinderGeometry(0.82, 1.15, 10.4, 7), bark, 1.035);
  trunk.position.set(-1.9, 5.2, -0.9);
  trunk.rotation.z = -0.05;
  tree.add(trunk);

  const branch = outlinedPrimitive(new THREE.CylinderGeometry(0.48, 0.7, 6.4, 7), bark, 1.035);
  branch.position.set(0.45, 7.65, -0.22);
  branch.rotation.z = Math.PI / 2 - 0.12;
  tree.add(branch);

  const rearBranch = outlinedPrimitive(new THREE.CylinderGeometry(0.38, 0.58, 4.2, 7), bark, 1.035);
  rearBranch.position.set(-2.95, 8.35, -1.05);
  rearBranch.rotation.z = -0.62;
  tree.add(rearBranch);

  const leafGeometry = new THREE.DodecahedronGeometry(1, 0);
  const leafClusters = [
    [-2.75, 10.75, -1.2, 2.65, leafDark],
    [-4.45, 9.8, -0.95, 2.1, leafLight],
    [-1.25, 12.35, -1.45, 2.05, leafMid],
    [4.15, 10.75, -1.15, 2.15, leafDark],
    [1.15, 9.7, 1.3, 1.65, leafMid],
    [3.15, 9.35, 1.2, 1.45, leafLight]
  ];
  for (const [x, y, z, scale, fill] of leafClusters) {
    const crown = outlinedPrimitive(leafGeometry, fill, 1.035);
    crown.position.set(x, y, z);
    crown.scale.set(scale, scale * 0.9, scale);
    tree.add(crown);
  }

  return tree;
}

async function createBellaModel() {
  const root = new THREE.Group();
  const cat = new THREE.Group();
  try {
    const gltf = await loadKenneyCat();
    cat.add(normalizeCat(gltf.scene));
  } catch (error) {
    console.warn('TURN: Kenney Cube Pets cat could not load; using Bella fallback.', error);
    cat.add(createFallbackCat());
  }

  cat.updateMatrixWorld(true);
  addBellaEyes(cat, new THREE.Box3().setFromObject(cat));
  cat.scale.setScalar(BELLA_SCALE);
  cat.position.set(1.35, BELLA_PERCH_HEIGHT, 0.22);
  cat.name = 'Bella perched on rescue branch';

  root.add(createRescueTree(), cat);
  root.name = 'Countryside Bella rescue · Kenney Cube Pets cat';
  root.userData.turnEasterEgg = 'save-bella';
  root.userData.turnBellaRequiredVehicle = REQUIRED_VEHICLE_ID;
  root.userData.turnBellaFocus = cat;
  return root;
}

function sampleAt(samples, index) {
  return samples[((Math.round(index) % samples.length) + samples.length) % samples.length];
}

function placeBella(model, samples, trackWidth) {
  const sample = sampleAt(samples, BELLA_SAMPLE_INDEX);
  model.position.copy(sample.point)
    .addScaledVector(sample.normal, BELLA_SIDE * (trackWidth / 2 + BELLA_DISTANCE_FROM_ROAD))
    .addScaledVector(sample.tangent, BELLA_TANGENT_OFFSET);
  model.position.y = 0;
  const inward = sample.normal.clone().multiplyScalar(-BELLA_SIDE);
  model.rotation.y = Math.atan2(inward.x, inward.z);
  model.userData.turnBellaPlacement =
    'perched visibly on a dedicated branch at the south-west Countryside forest edge near sample 500';
  return model;
}

function armBellaDiscovery(model, runtime) {
  const renderAnchor = model.getObjectByProperty('isMesh', true)
    || model.getObjectByProperty('isSkinnedMesh', true);
  if (!renderAnchor) return false;

  const bellaFocus = model.userData.turnBellaFocus || model;
  const bellaPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const cameraToBella = new THREE.Vector3();
  const previousOnBeforeRender = renderAnchor.onBeforeRender;
  let discoveryStartedAt = null;

  renderAnchor.onBeforeRender = function discoverBella(...args) {
    previousOnBeforeRender?.call(this, ...args);
    if (model.userData.turnSecretAchievementFound) return;

    const state = runtime?.state;
    const camera = args[2];
    const countrysideActive = state?.running === true
      && (state.trackId || globalThis.__turnGetTrackId?.()) === 'countryside';
    if (!countrysideActive || state.vehicleId !== REQUIRED_VEHICLE_ID || !camera?.isCamera) {
      discoveryStartedAt = null;
      return;
    }

    bellaFocus.getWorldPosition(bellaPosition);
    camera.getWorldPosition(cameraPosition);
    if (cameraPosition.distanceToSquared(bellaPosition) > DISCOVERY_DISTANCE_SQUARED) {
      discoveryStartedAt = null;
      return;
    }

    camera.getWorldDirection(cameraForward);
    cameraToBella.copy(bellaPosition).sub(cameraPosition).normalize();
    if (cameraForward.dot(cameraToBella) < DISCOVERY_VIEW_DOT) {
      discoveryStartedAt = null;
      return;
    }

    const now = globalThis.performance?.now?.() ?? Date.now();
    if (discoveryStartedAt == null) {
      discoveryStartedAt = now;
      return;
    }
    if (now - discoveryStartedAt < DISCOVERY_HOLD_MS) return;

    model.userData.turnSecretAchievementFound = true;
    renderAnchor.onBeforeRender = previousOnBeforeRender;
    signalSecretAchievement('save-bella', {
      trackId: 'countryside',
      vehicleId: REQUIRED_VEHICLE_ID
    });
  };
  return true;
}

export async function installCountrysideBella({ world, samples, trackWidth, runtime } = {}) {
  if (!world || !Array.isArray(samples) || !samples.length || !Number.isFinite(trackWidth)) return null;
  const existing = world.children.find((child) => child?.userData?.turnEasterEgg === 'save-bella');
  if (existing) return existing;

  const bella = placeBella(await createBellaModel(), samples, trackWidth);
  world.add(bella);
  armBellaDiscovery(bella, runtime || globalThis.__turnRuntime);
  world.userData.turnBellaDiscovery = Object.freeze({
    model: 'Kenney Cube Pets animal-cat',
    palette: 'Bella cream, seal brown and white paws; exact #D2C9AF / #382C1F coat; #74A7FF gradient eyes',
    rescueScene: 'Bella perched clearly above a dedicated branch with visibly green leaves',
    requiredVehicle: 'Fire Truck',
    sampleIndex: BELLA_SAMPLE_INDEX,
    discoveryHoldMs: DISCOVERY_HOLD_MS
  });
  return bella;
}
