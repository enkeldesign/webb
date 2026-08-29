import * as THREE from 'three';

const TRAINING_SIGN_COLOR = 0x2f9e44;
const SIGN_OUTLINE_COLOR = 0x08090a;
const SIGN_OUTLINE_SCALE = 1.065;

export function installTrainingCarSignage(root) {
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
  for (const [side, name] of [[-1, 'door-sign-left'], [1, 'door-sign-right']]) {
    const doorSign = makeOutlinedSignBox(doorThickness, doorHeight, doorLength, name);
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
