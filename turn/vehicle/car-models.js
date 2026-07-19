import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getCarDefinition, makeGhostColor, normalizeVehicleColor } from './catalog.js';

const loader = new GLTFLoader();
const sourceCache = new Map();
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';

export async function preloadCarModels(carIds) {
  await Promise.all(carIds.map((carId) => loadCarSource(carId).catch(() => null)));
}

export async function createCarVisual({
  carId,
  color,
  ghost = false,
  targetLength = 5.4,
  outline = true
}) {
  const car = getCarDefinition(carId);
  const source = await loadCarSource(car.id);
  const root = new THREE.Group();
  const model = source.clone(true);
  model.rotation.y = Math.PI;
  root.add(model);

  const requestedColor = normalizeVehicleColor(color);
  const ghostColor = makeGhostColor(requestedColor);
  const meshRecords = [];
  let explicitPaintCount = 0;

  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const cloned = materials.map((material) => material.clone());
    node.material = Array.isArray(node.material) ? cloned : cloned[0];

    cloned.forEach((material) => {
      const record = {
        node,
        material,
        protected: isProtectedPart(node, material),
        explicitPaint: isExplicitPaint(node, material)
      };
      if (record.explicitPaint && !record.protected) explicitPaintCount += 1;
      meshRecords.push(record);
    });
  });

  const paintMaterials = [];
  for (const record of meshRecords) {
    const { node, material, protected: protectedPart, explicitPaint } = record;
    const paintable = !protectedPart && (
      explicitPaint ||
      (explicitPaintCount === 0 && isFallbackPaintCandidate(material)) ||
      (car.pack !== 'car' && isFallbackPaintCandidate(material))
    );

    if (paintable && material.color) {
      material.color.set(ghost ? ghostColor : requestedColor);
      paintMaterials.push(material);
    } else if (ghost && material.color) {
      material.color.lerp(new THREE.Color(ghostColor), protectedPart ? 0.46 : 0.72);
    }

    if (ghost) {
      material.transparent = true;
      material.opacity = protectedPart ? 0.22 : 0.34;
      material.depthWrite = false;
    }

    node.castShadow = !ghost;
    node.receiveShadow = !ghost;
  }

  if (outline) addOutlines(model, ghost);
  normalizeModelToGround(model, targetLength * car.visualScale);

  root.userData.turnCarId = car.id;
  root.userData.turnCarColor = requestedColor;
  root.userData.turnGhost = ghost;
  root.userData.turnPaintMaterials = paintMaterials;
  root.userData.frontWheelPivots = [];
  root.userData.wheelSpinners = [];
  return root;
}

export function recolorCarVisual(root, color) {
  const normalized = normalizeVehicleColor(color);
  const ghost = Boolean(root?.userData?.turnGhost);
  const displayColor = ghost ? makeGhostColor(normalized) : normalized;
  for (const material of root?.userData?.turnPaintMaterials || []) {
    material.color?.set(displayColor);
  }
  if (root?.userData) root.userData.turnCarColor = normalized;
}

async function loadCarSource(carId) {
  const car = getCarDefinition(carId);
  if (!sourceCache.has(car.id)) {
    sourceCache.set(car.id, loader.loadAsync(assetUrl(car.asset)).then((gltf) => gltf.scene));
  }
  return sourceCache.get(car.id);
}

function assetUrl(relativePath) {
  const url = new URL(`../${relativePath.replace(/^\.\//, '')}`, import.meta.url);
  if (buildKey) url.searchParams.set('build', buildKey);
  return url.href;
}

function addOutlines(model, ghost) {
  const originals = [];
  model.traverse((node) => {
    if (node.isMesh) originals.push(node);
  });

  for (const node of originals) {
    const outline = new THREE.Mesh(
      node.geometry,
      new THREE.MeshBasicMaterial({
        color: 0x08090a,
        side: THREE.BackSide,
        transparent: ghost,
        opacity: ghost ? 0.12 : 0.82,
        depthWrite: !ghost
      })
    );
    outline.scale.setScalar(1.035);
    outline.castShadow = false;
    outline.receiveShadow = false;
    outline.userData.turnOutline = true;
    node.add(outline);
  }
}

function normalizeModelToGround(model, targetLength) {
  model.updateMatrixWorld(true);
  const initialBounds = new THREE.Box3().setFromObject(model);
  const size = initialBounds.getSize(new THREE.Vector3());
  const footprintLength = Math.max(0.001, size.x, size.z);
  model.scale.multiplyScalar(targetLength / footprintLength);
  model.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= bounds.min.y;
}

function isProtectedPart(node, material) {
  const label = `${node.name || ''} ${material.name || ''}`.toLowerCase();
  return /wheel|tire|tyre|rubber|glass|window|windscreen|light|lamp|chrome|axle/.test(label);
}

function isExplicitPaint(node, material) {
  const label = `${node.name || ''} ${material.name || ''}`.toLowerCase();
  return /paint|body|primary|vehiclecolor|carcolor/.test(label);
}

function isFallbackPaintCandidate(material) {
  if (!material?.color) return false;
  if (material.transparent && material.opacity < 0.8) return false;
  const luminance = material.color.r * 0.2126 + material.color.g * 0.7152 + material.color.b * 0.0722;
  return luminance > 0.17;
}
