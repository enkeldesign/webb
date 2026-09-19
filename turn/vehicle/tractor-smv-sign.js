import * as THREE from 'three';

const TRACTOR_ID = 'tractor';
const INSTALL_FLAG = 'turnTractorSmvSignScheduled';
const SIGN_FLAG = 'turnTractorSmvSign';
const OUTER_RED = '#d71920';
const INNER_ORANGE = '#ff4b00';
const UP = new THREE.Vector3(0, 1, 0);

let signTemplate = null;

export function installTractorSmvSign(node, car) {
  if (car?.id !== TRACTOR_ID || !node?.isObject3D) return null;
  const model = visualModelRoot(node);
  if (!model || model.userData?.[INSTALL_FLAG]) return model?.userData?.[SIGN_FLAG] || null;

  const pose = measureSmvPose(model);
  if (!pose) return null;
  model.userData[INSTALL_FLAG] = true;

  const install = () => {
    if (!model.parent || model.userData?.[SIGN_FLAG]) return;
    const sign = createSmvSign();
    sign.position.copy(pose.position);
    sign.quaternion.copy(pose.quaternion);
    sign.scale.setScalar(pose.width);
    model.add(sign);
    model.userData[SIGN_FLAG] = sign;
  };

  if (typeof globalThis.queueMicrotask === 'function') globalThis.queueMicrotask(install);
  else Promise.resolve().then(install);
  return null;
}

function visualModelRoot(node) {
  let current = node;
  while (current?.parent?.parent) current = current.parent;
  return current?.parent ? current : null;
}

function measureSmvPose(model) {
  model.updateMatrixWorld(true);
  const wheels = { front: [], back: [] };

  model.traverse((part) => {
    const role = authoredWheelRole(part?.name);
    if (!role) return;
    const world = part.getWorldPosition(new THREE.Vector3());
    wheels[role].push(model.worldToLocal(world));
  });

  if (wheels.front.length < 2 || wheels.back.length < 2) return null;

  const frontCenter = average(wheels.front);
  const backCenter = average(wheels.back);
  const rearward = backCenter.clone().sub(frontCenter);
  rearward.y = 0;
  if (rearward.lengthSq() < 1e-8) return null;
  rearward.normalize();

  const rearSpan = farthestPairDistance(wheels.back);
  if (!(rearSpan > 0.01)) return null;
  const width = rearSpan * 0.34;
  const signCenterY = backCenter.y + width * 0.26;

  const target = backCenter.clone();
  target.y = signCenterY;
  const wheelbase = Math.max(0.5, backCenter.distanceTo(frontCenter));
  const startLocal = target.clone().addScaledVector(rearward, wheelbase * 2.2);
  const towardFrontLocal = startLocal.clone().addScaledVector(rearward, -1);
  const startWorld = model.localToWorld(startLocal.clone());
  const towardFrontWorld = model.localToWorld(towardFrontLocal);
  const directionWorld = towardFrontWorld.sub(startWorld).normalize();

  const raycaster = new THREE.Raycaster(startWorld, directionWorld, 0, wheelbase * 4.6);
  const hit = raycaster.intersectObject(model, true).find((intersection) => isBodySurface(intersection.object));
  const surface = hit
    ? model.worldToLocal(hit.point.clone())
    : target.clone().addScaledVector(rearward, width * 0.05);
  surface.y = signCenterY;

  // The rear face sits almost flush with the chassis. The tiny offset avoids
  // z-fighting without making the emblem float behind the vehicle.
  const position = surface.addScaledVector(rearward, width * 0.006);
  const lateral = new THREE.Vector3().crossVectors(UP, rearward).normalize();
  const basis = new THREE.Matrix4().makeBasis(lateral, UP, rearward);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);

  return { position, quaternion, width };
}

function createSmvSign() {
  if (!signTemplate) signTemplate = buildSmvTemplate();
  const clone = signTemplate.clone(true);
  clone.name = 'tractor-smv-sign';
  clone.userData.turnFixedSmvSign = true;
  clone.userData.turnSmvMount = 'rear-chassis-between-back-wheels';
  return clone;
}

function buildSmvTemplate() {
  // Reference shape: fluorescent orange triangle with a red retroreflective
  // surround. The clipped outer corners match the familiar physical SMV plaque.
  const outer = shapeFrom([
    [-0.31, 0.43],
    [0.31, 0.43],
    [0.50, -0.32],
    [0.40, -0.43],
    [-0.40, -0.43],
    [-0.50, -0.32]
  ]);
  const inner = shapeFrom([
    [0, 0.395],
    [0.355, -0.285],
    [-0.355, -0.285]
  ]);

  const redGeometry = new THREE.ExtrudeGeometry(outer, {
    depth: 0.045,
    bevelEnabled: false,
    curveSegments: 1,
    steps: 1
  });
  redGeometry.computeVertexNormals();

  const orangeGeometry = new THREE.ShapeGeometry(inner);
  const redMaterial = new THREE.MeshStandardMaterial({
    color: OUTER_RED,
    roughness: 0.48,
    metalness: 0,
    emissive: '#5a0407',
    emissiveIntensity: 0.16
  });
  const orangeMaterial = new THREE.MeshStandardMaterial({
    color: INNER_ORANGE,
    roughness: 0.58,
    metalness: 0,
    emissive: '#721600',
    emissiveIntensity: 0.14,
    side: THREE.DoubleSide
  });

  const group = new THREE.Group();
  const red = new THREE.Mesh(redGeometry, redMaterial);
  const orange = new THREE.Mesh(orangeGeometry, orangeMaterial);
  orange.position.z = 0.0465;
  orange.renderOrder = 2;
  group.add(red, orange);
  return group;
}

function shapeFrom(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

function authoredWheelRole(name = '') {
  const label = String(name).toLowerCase();
  if (/^wheel-(?:front-(?:left|right)|f[lr])(?:-|$)/.test(label)) return 'front';
  if (/^wheel-(?:back-(?:left|right)|b[lr])(?:-|$)/.test(label)) return 'back';
  return null;
}

function isBodySurface(object) {
  if (!object?.isMesh || object.userData?.turnOutline) return false;
  const materials = Array.isArray(object.material) ? object.material : [object.material];
  const label = `${object.name || ''} ${materials.map((material) => material?.name || '').join(' ')}`.toLowerCase();
  return !/wheel|tire|tyre|rubber|glass|window|windscreen|light|lamp/.test(label);
}

function average(points) {
  const result = new THREE.Vector3();
  for (const point of points) result.add(point);
  return result.multiplyScalar(1 / points.length);
}

function farthestPairDistance(points) {
  let distance = 0;
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) {
      distance = Math.max(distance, points[a].distanceTo(points[b]));
    }
  }
  return distance;
}
