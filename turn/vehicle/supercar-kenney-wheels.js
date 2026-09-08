import * as THREE from 'three';

const KENNEY_RIM_CELLS = new Set(['3,4', '3,5']);
const SUPERCAR_TIRE_COLOR = 0x070809;
const WHEEL_ROLES = Object.freeze([
  Object.freeze({
    role: 'wheel-front-left',
    rim: 'supercar-rim-front-left',
    tire: 'supercar-dark-foot-front-left'
  }),
  Object.freeze({
    role: 'wheel-front-right',
    rim: 'supercar-rim-front-right',
    tire: 'supercar-dark-foot-front-right'
  }),
  Object.freeze({
    role: 'wheel-back-left',
    rim: 'supercar-rim-back-left',
    tire: 'supercar-dark-foot-back-left'
  }),
  Object.freeze({
    role: 'wheel-back-right',
    rim: 'supercar-rim-back-right',
    tire: 'supercar-dark-foot-back-right'
  })
]);

export function installSupercarKenneyWheels(model, trainingCarSource) {
  if (!model || !trainingCarSource) return false;
  let replacements = 0;

  for (const spec of WHEEL_ROLES) {
    const target = model.getObjectByName(spec.role);
    const donor = trainingCarSource.getObjectByName(spec.role);
    if (!target || !donor?.isMesh || !donor.geometry) continue;

    const targetBox = localBounds(target);
    const donorBox = localBounds(donor);
    if (targetBox.isEmpty() || donorBox.isEmpty()) continue;

    const targetSize = targetBox.getSize(new THREE.Vector3());
    const donorSize = donorBox.getSize(new THREE.Vector3());
    const targetDiameter = Math.max(targetSize.y, targetSize.z);
    const donorDiameter = Math.max(donorSize.y, donorSize.z);
    if (!(targetDiameter > 0) || !(donorDiameter > 0)) continue;

    const { tireGeometry, rimGeometry } = splitKenneyWheelGeometry(donor.geometry);
    if (!tireGeometry || !rimGeometry) continue;

    const scale = targetDiameter / donorDiameter;
    const targetCenter = targetBox.getCenter(new THREE.Vector3());
    const donorCenter = donorBox.getCenter(new THREE.Vector3());
    const replacement = new THREE.Group();
    replacement.name = `kenney-${spec.role}-assembly`;
    replacement.position.copy(targetCenter).addScaledVector(donorCenter, -scale);
    replacement.scale.setScalar(scale);
    replacement.userData.turnWheelSource = 'Kenney Car Kit 3.1';

    const tireMaterial = new THREE.MeshStandardMaterial({
      color: SUPERCAR_TIRE_COLOR,
      roughness: 0.96,
      metalness: 0
    });
    tireMaterial.name = 'supercar-dark-foot';
    const tire = new THREE.Mesh(tireGeometry, tireMaterial);
    tire.name = spec.tire;

    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.74,
      metalness: 0.04
    });
    rimMaterial.name = 'secondary-paint supercar-rim';
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.name = spec.rim;

    replacement.add(tire, rim);
    target.clear();
    if (target.isMesh) target.geometry = new THREE.BufferGeometry();
    target.add(replacement);
    replacements += 1;
  }

  return replacements === WHEEL_ROLES.length;
}

function splitKenneyWheelGeometry(sourceGeometry) {
  const index = sourceGeometry?.index;
  const uv = sourceGeometry?.getAttribute?.('uv');
  if (!index || !uv || index.count < 3) return { tireGeometry: null, rimGeometry: null };

  const tireIndices = [];
  const rimIndices = [];
  for (let offset = 0; offset + 2 < index.count; offset += 3) {
    const a = index.getX(offset);
    const b = index.getX(offset + 1);
    const c = index.getX(offset + 2);
    const u = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
    const v = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
    const cell = `${paletteCell(u)},${paletteCell(v)}`;
    const destination = KENNEY_RIM_CELLS.has(cell) ? rimIndices : tireIndices;
    destination.push(a, b, c);
  }

  if (!tireIndices.length || !rimIndices.length) return { tireGeometry: null, rimGeometry: null };
  return {
    tireGeometry: geometryRegion(sourceGeometry, tireIndices),
    rimGeometry: geometryRegion(sourceGeometry, rimIndices)
  };
}

function geometryRegion(sourceGeometry, indices) {
  const geometry = sourceGeometry.clone();
  geometry.clearGroups();
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function paletteCell(value) {
  return Math.max(0, Math.min(7, Math.floor(value * 8)));
}

function localBounds(object) {
  const probe = object.clone(true);
  probe.position.set(0, 0, 0);
  probe.quaternion.identity();
  probe.scale.set(1, 1, 1);
  probe.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(probe);
}
