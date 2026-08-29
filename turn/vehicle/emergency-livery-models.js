import * as THREE from 'three';
import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js';

const EMERGENCY_IDS = new Set(['police', 'ambulance', 'firetruck']);
const TRAINING_CAR_ID = 'classic';
const DARK_TIRE_COLOR = 0x060708;
const TRAINING_SIGN_COLOR = 0x2f9e44;
const SIGN_OUTLINE_COLOR = 0x08090a;
const SIGN_OUTLINE_SCALE = 1.065;

export { preloadCarModels, recolorCarVisual };

/**
 * Legacy import-map bridge. Emergency paint, glass, lamps, wheel details and the
 * shared front-wheel steering pivots all come from the authored-model car factory.
 * TURN still installs its functional Boost light rig there, but no livery panels
 * or other presentation geometry are generated here; steering is visual-only and
 * never changes vehicle physics.
 *
 * Training Car is the one deliberate exception: its Kenney Taxi source lost part
 * of the roof when the Taxi sign was surgically removed. A fixed green training
 * sign now occupies that mount and matching green door plaques distinguish it from
 * a yellow taxi without becoming part of PAINTJOB's body/trim material lists.
 */
export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  const emergency = EMERGENCY_IDS.has(root?.userData?.turnCarId);

  if (root?.userData?.turnCarId === TRAINING_CAR_ID) installTrainingCarSignage(root);

  // Fixed-livery emergency wheels use one authored palette texture for tyre and rim.
  // They intentionally skip semantic repaint, so tinting the whole wheel would also
  // blacken the authored rim cells. Preserve the native wheel atlas for those cars.
  if (!emergency) darkenVisibleWheels(root);
  if (emergency) {
    root.userData.turnEmergencyLivery = 'native-kenney-palette';
  }
  return root;
}

function installTrainingCarSignage(root) {
  if (!root?.isObject3D || root.userData?.turnTrainingCarSignage) return;

  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (![size.x, size.y, size.z].every((value) => Number.isFinite(value) && value > 0)) return;

  const signage = new THREE.Group();
  signage.name = 'turn-training-car-signage';

  // Let the roof block overlap the roof skin slightly. Besides looking mounted rather
  // than floating, this deliberately seals the rectangular opening left by the old
  // sign-removal edit from every camera/outline angle.
  const roofWidth = size.x * 0.42;
  const roofHeight = size.y * 0.13;
  const roofDepth = size.z * 0.085;
  const roofSign = makeOutlinedSignBox(roofWidth, roofHeight, roofDepth, 'roof-sign');
  roofSign.position.set(
    center.x,
    bounds.max.y + roofHeight * 0.34,
    center.z - size.z * 0.015
  );
  signage.add(roofSign);

  // The Taxi artwork also carries a door identifier. Give Training Car its own clear,
  // fixed green identifier on both sides; it stays green even when body paint changes.
  const doorThickness = Math.max(0.025, size.x * 0.012);
  const doorHeight = size.y * 0.14;
  const doorLength = size.z * 0.22;
  for (const side of [-1, 1]) {
    const doorSign = makeOutlinedSignBox(doorThickness, doorHeight, doorLength, `door-sign-${side < 0 ? 'left' : 'right'}`);
    doorSign.position.set(
      center.x + side * (size.x * 0.502),
      bounds.min.y + size.y * 0.48,
      center.z - size.z * 0.03
    );
    signage.add(doorSign);
  }

  root.add(signage);
  root.userData.turnTrainingCarSignage = signage;
  root.userData.turnTrainingCarSignColor = '#2f9e44';
}

function makeOutlinedSignBox(width, height, depth, name) {
  const group = new THREE.Group();
  group.name = `turn-training-${name}`;

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: SIGN_OUTLINE_COLOR,
      side: THREE.BackSide,
      depthWrite: false
    })
  );
  outline.name = `${group.name}-outline`;
  outline.scale.setScalar(SIGN_OUTLINE_SCALE);
  outline.renderOrder = 1;

  const sign = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      color: TRAINING_SIGN_COLOR,
      roughness: 0.78,
      metalness: 0
    })
  );
  sign.name = `${group.name}-green`;
  sign.castShadow = true;
  sign.receiveShadow = true;
  sign.renderOrder = 2;

  group.add(outline, sign);
  return group;
}

function darkenVisibleWheels(root) {
  root?.traverse?.((node) => {
    if (!node?.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      const label = `${node.name || ''} ${material?.name || ''}`.toLowerCase();
      if (!/wheel|tire|tyre|rubber/.test(label) || !material?.color) continue;

      // Repaintable Kenney wheel meshes use palette textures. Their semantic rim
      // shader runs after this material tint, leaving painted rim cells legible while
      // the tyre/rubber reads almost black.
      material.color.setHex(DARK_TIRE_COLOR);
      if ('roughness' in material) {
        material.roughness = Math.max(Number(material.roughness) || 0, 0.9);
      }
    }
  });
}
