import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { setThreeColor } from './wide-gamut.js?revision=r157-display-p3';

const OUTLINE_COLOR = 0x08090a;
const RALLY_COMPETITION_KIT = 'rally-competition';
const installers = Object.freeze({
  [RALLY_COMPETITION_KIT]: installRallyCompetitionKit
});

/**
 * Installs a catalog-selected visual upgrade after the source GLB has been
 * normalized. Upgrade geometry is generated from the painted body and wheel
 * bounds, so one kit stays correctly proportioned in the race, The Lot,
 * Trophy Road cards, thumbnails and ghosts.
 */
export function installVehicleVisualUpgrade({
  root,
  model,
  car,
  secondaryColor,
  ghost = false,
  outline = true,
  secondaryPaintMaterials = []
}) {
  const installer = installers[car?.visualUpgrade];
  if (!installer || !root || !model) return null;

  const group = installer({
    model,
    secondaryColor,
    ghost,
    outline,
    secondaryPaintMaterials
  });
  if (!group) return null;

  root.add(group);
  root.userData.turnVisualUpgrade = car.visualUpgrade;
  return group;
}

function installRallyCompetitionKit({
  model,
  secondaryColor,
  ghost,
  outline,
  secondaryPaintMaterials
}) {
  model.updateMatrixWorld(true);
  const bodyBounds = boundsForBody(model);
  if (!bodyBounds) return null;

  const size = bodyBounds.getSize(new THREE.Vector3());
  const center = bodyBounds.getCenter(new THREE.Vector3());
  if (!validSize(size)) return null;

  const accentMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.38,
    metalness: ghost ? 0 : 0.18
  });
  setThreeColor(accentMaterial.color, secondaryColor);
  secondaryPaintMaterials.push(accentMaterial);

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: ghost ? accentMaterial.color : new THREE.Color(0x11151a),
    roughness: 0.76,
    metalness: ghost ? 0 : 0.12
  });
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: ghost ? accentMaterial.color : new THREE.Color(0xfff4c2),
    emissive: ghost ? accentMaterial.color : new THREE.Color(0xffd56a),
    emissiveIntensity: ghost ? 0 : 0.52,
    roughness: 0.3,
    metalness: 0
  });

  const accentGeometry = [];
  const darkGeometry = [];
  const lampGeometry = [];

  addRallyLampBank({ bodyBounds, size, center, accentGeometry, lampGeometry });
  addBonnetStripes({ bodyBounds, size, center, accentGeometry });
  addCompetitionWing({ bodyBounds, size, center, accentGeometry, darkGeometry });
  addRollHoop({ bodyBounds, size, center, darkGeometry });
  addRockerSteps({ bodyBounds, size, center, accentGeometry });
  addWheelRimAccents({ model, bodyBounds, accentGeometry });

  const group = new THREE.Group();
  group.name = 'turn-rally-competition-kit';
  group.userData.turnVehicleVisualUpgrade = RALLY_COMPETITION_KIT;
  addMergedFeature(group, accentGeometry, accentMaterial, 'rally-accent', outline);
  addMergedFeature(group, darkGeometry, darkMaterial, 'rally-structure', outline);
  addMergedFeature(group, lampGeometry, lampMaterial, 'rally-lamps', outline);
  return group;
}

function addBonnetStripes({ bodyBounds, size, center, accentGeometry }) {
  const stripeSize = new THREE.Vector3(size.x * 0.065, size.y * 0.025, size.z * 0.31);
  const y = bodyBounds.min.y + size.y * 0.575;
  const z = bodyBounds.min.z + size.z * 0.18;
  for (const direction of [-1, 1]) {
    accentGeometry.push(boxGeometry(
      stripeSize,
      new THREE.Vector3(center.x + direction * size.x * 0.11, y, z)
    ));
  }
}

function addRallyLampBank({ bodyBounds, size, center, accentGeometry, lampGeometry }) {
  const radius = Math.min(size.x * 0.075, size.y * 0.115);
  const housingDepth = Math.max(size.z * 0.048, radius * 0.52);
  const lampY = bodyBounds.min.y + size.y * 0.35;
  const housingZ = bodyBounds.min.z - housingDepth * 0.2;
  const lensZ = bodyBounds.min.z - housingDepth * 0.76;

  for (const factor of [-0.3, -0.1, 0.1, 0.3]) {
    const x = center.x + size.x * factor;
    accentGeometry.push(transformedGeometry(
      new THREE.CylinderGeometry(radius * 1.16, radius * 1.16, housingDepth, 16),
      new THREE.Vector3(x, lampY, housingZ),
      new THREE.Euler(Math.PI / 2, 0, 0)
    ));
    lampGeometry.push(transformedGeometry(
      new THREE.CylinderGeometry(radius, radius, housingDepth * 0.18, 16),
      new THREE.Vector3(x, lampY, lensZ),
      new THREE.Euler(Math.PI / 2, 0, 0)
    ));
  }

  accentGeometry.push(boxGeometry(
    new THREE.Vector3(size.x * 0.82, size.y * 0.065, size.z * 0.045),
    new THREE.Vector3(center.x, bodyBounds.min.y + size.y * 0.14, bodyBounds.min.z - size.z * 0.012)
  ));
}

function addCompetitionWing({ bodyBounds, size, center, accentGeometry, darkGeometry }) {
  const wingSize = new THREE.Vector3(size.x * 0.96, size.y * 0.075, size.z * 0.115);
  const wingY = bodyBounds.max.y + wingSize.y * 0.5 + size.y * 0.035;
  const wingZ = bodyBounds.max.z + wingSize.z * 0.1;
  accentGeometry.push(boxGeometry(wingSize, new THREE.Vector3(center.x, wingY, wingZ)));

  const supportSize = new THREE.Vector3(size.x * 0.055, size.y * 0.34, size.z * 0.05);
  const supportY = wingY - wingSize.y * 0.5 - supportSize.y * 0.5;
  for (const direction of [-1, 1]) {
    darkGeometry.push(boxGeometry(
      supportSize,
      new THREE.Vector3(center.x + direction * size.x * 0.27, supportY, wingZ)
    ));
  }
}

function addRollHoop({ bodyBounds, size, center, darkGeometry }) {
  const z = center.z - size.z * 0.045;
  const lowerY = bodyBounds.min.y + size.y * 0.59;
  const topY = bodyBounds.max.y + size.y * 0.025;
  const lowerSpread = size.x * 0.29;
  const topSpread = size.x * 0.255;
  const radius = Math.max(size.x * 0.017, 0.03);
  const lowerLeft = new THREE.Vector3(center.x - lowerSpread, lowerY, z);
  const lowerRight = new THREE.Vector3(center.x + lowerSpread, lowerY, z);
  const topLeft = new THREE.Vector3(center.x - topSpread, topY, z);
  const topRight = new THREE.Vector3(center.x + topSpread, topY, z);
  darkGeometry.push(cylinderBetween(lowerLeft, topLeft, radius));
  darkGeometry.push(cylinderBetween(topLeft, topRight, radius));
  darkGeometry.push(cylinderBetween(topRight, lowerRight, radius));
}

function addRockerSteps({ bodyBounds, size, center, accentGeometry }) {
  const stepSize = new THREE.Vector3(
    Math.max(size.x * 0.025, 0.035),
    size.y * 0.07,
    size.z * 0.29
  );
  const y = bodyBounds.min.y + size.y * 0.16;
  for (const direction of [-1, 1]) {
    accentGeometry.push(boxGeometry(
      stepSize,
      new THREE.Vector3(
        direction < 0
          ? bodyBounds.min.x - stepSize.x * 0.25
          : bodyBounds.max.x + stepSize.x * 0.25,
        y,
        center.z
      )
    ));
  }
}

function addWheelRimAccents({ model, bodyBounds, accentGeometry }) {
  const wheelBounds = [];
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline || !/wheel|tire|tyre/i.test(node.name || '')) return;
    const bounds = new THREE.Box3().setFromObject(node);
    if (!bounds.isEmpty()) wheelBounds.push(bounds);
  });

  const bodyCenterX = (bodyBounds.min.x + bodyBounds.max.x) * 0.5;
  for (const bounds of wheelBounds) {
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(0.035, Math.min(size.y, size.z) * 0.285);
    const tube = Math.max(0.018, radius * 0.18);
    const outside = center.x < bodyCenterX ? bounds.min.x - tube * 0.2 : bounds.max.x + tube * 0.2;
    accentGeometry.push(transformedGeometry(
      new THREE.TorusGeometry(radius, tube, 7, 16),
      new THREE.Vector3(outside, center.y, center.z),
      new THREE.Euler(0, Math.PI / 2, 0)
    ));
  }
}

function boundsForBody(model) {
  const bounds = new THREE.Box3();
  let found = false;
  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline) return;
    const label = `${node.name || ''} ${node.material?.name || ''}`;
    if (/wheel|tire|tyre/i.test(label)) return;
    bounds.expandByObject(node);
    found = true;
  });
  return found && !bounds.isEmpty() ? bounds : null;
}

function addMergedFeature(group, geometries, material, name, outline) {
  if (!geometries.length) {
    material.dispose();
    return;
  }
  const geometry = mergeGeometries(geometries, false);
  for (const source of geometries) source.dispose();
  if (!geometry) {
    material.dispose();
    return;
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  if (outline) {
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geometry, 32),
      new THREE.LineBasicMaterial({ color: OUTLINE_COLOR, toneMapped: false })
    );
    edges.name = `${name}-outline`;
    edges.userData.turnOutline = true;
    edges.renderOrder = 3;
    group.add(edges);
  }
}

function boxGeometry(size, position) {
  return transformedGeometry(new THREE.BoxGeometry(size.x, size.y, size.z), position);
}

function cylinderBetween(start, end, radius) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= 0.0001) return new THREE.BufferGeometry();
  const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  const matrix = new THREE.Matrix4().compose(
    start.clone().add(end).multiplyScalar(0.5),
    quaternion,
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function transformedGeometry(geometry, position, rotation = new THREE.Euler()) {
  const matrix = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function validSize(size) {
  return Number.isFinite(size.x) && size.x > 0
    && Number.isFinite(size.y) && size.y > 0
    && Number.isFinite(size.z) && size.z > 0;
}
