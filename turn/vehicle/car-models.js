import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  getCarDefinition,
  makeGhostColor,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor
} from './catalog.js?build=20260720-r19';

const loader = new GLTFLoader();
const sourceCache = new Map();
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const TIRE_COLOR = 0x17191c;

export async function preloadCarModels(carIds) {
  await Promise.all(carIds.map((carId) => loadCarSource(carId).catch(() => null)));
}

export async function createCarVisual({
  carId,
  color,
  secondaryColor = DEFAULT_VEHICLE_SECONDARY_COLOR,
  ghost = false,
  targetLength = 5.4,
  outline = true
}) {
  const car = getCarDefinition(carId);
  const source = await loadCarSource(car.id);
  const root = new THREE.Group();
  const model = source.clone(true);
  // TURN's visual roots point down local -Z. The per-asset quarter turns first
  // normalize the GLB's authored nose direction, then the shared half-turn aligns it.
  model.rotation.y = Math.PI + car.modelYawQuarterTurns * Math.PI / 2;
  root.add(model);

  const requestedColor = normalizeVehicleColor(color);
  const requestedSecondaryColor = normalizeVehicleSecondaryColor(secondaryColor);
  const ghostColor = makeGhostColor(requestedColor);
  const ghostSecondaryColor = makeGhostColor(requestedSecondaryColor);
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
        wheel: isWheelPart(node, material),
        secondaryPaint: isSecondaryPaint(node, car),
        explicitPaint: isExplicitPaint(node, material)
      };
      if (record.explicitPaint && !record.protected) explicitPaintCount += 1;
      meshRecords.push(record);
    });
  });

  const primaryPaintMaterials = [];
  const secondaryPaintMaterials = [];
  for (const record of meshRecords) {
    const {
      material,
      protected: protectedPart,
      wheel: wheelPart,
      secondaryPaint,
      explicitPaint
    } = record;
    const paintable = !protectedPart && !secondaryPaint && (
      explicitPaint ||
      (explicitPaintCount === 0 && isFallbackPaintCandidate(material)) ||
      (car.pack !== 'car' && isFallbackPaintCandidate(material))
    );

    if (wheelPart && material.color) {
      // Several Kenney models ship with very bright wheel materials. Tires/wheels should
      // remain visually grounded instead of inheriting white or body paint.
      material.color.setHex(TIRE_COLOR);
      if ('roughness' in material) material.roughness = Math.max(Number(material.roughness) || 0, 0.82);
    } else if (secondaryPaint && !protectedPart && material.color) {
      material.color.set(ghost ? ghostSecondaryColor : requestedSecondaryColor);
      secondaryPaintMaterials.push(material);
    } else if (paintable && material.color) {
      material.color.set(ghost ? ghostColor : requestedColor);
      primaryPaintMaterials.push(material);
    }

    // Personal rivals are solid cars. Their identity comes from the lighter body colour,
    // not transparency, so they remain readable at speed and in Spectate mode.
    if (ghost) {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.needsUpdate = true;
    }

    // Rivals remain fully shaded but do not trigger another shadow-map draw for every
    // GLB mesh. The player's car keeps its grounding shadow.
    record.node.castShadow = !ghost;
    record.node.receiveShadow = true;
  }

  if (outline) addOutlines(model);
  normalizeModelToGround(model, targetLength * car.visualScale);

  root.userData.turnCarId = car.id;
  root.userData.turnCarColor = requestedColor;
  root.userData.turnCarSecondaryColor = requestedSecondaryColor;
  root.userData.turnGhost = ghost;
  root.userData.turnModelYawQuarterTurns = car.modelYawQuarterTurns;
  root.userData.turnPrimaryPaintMaterials = primaryPaintMaterials;
  root.userData.turnSecondaryPaintMaterials = secondaryPaintMaterials;
  root.userData.turnPaintMaterials = [...primaryPaintMaterials, ...secondaryPaintMaterials];
  root.userData.frontWheelPivots = [];
  root.userData.wheelSpinners = [];
  return root;
}

export function recolorCarVisual(root, color, secondaryColor = root?.userData?.turnCarSecondaryColor) {
  const normalized = normalizeVehicleColor(color);
  const normalizedSecondary = normalizeVehicleSecondaryColor(secondaryColor);
  const ghost = Boolean(root?.userData?.turnGhost);
  const displayColor = ghost ? makeGhostColor(normalized) : normalized;
  const displaySecondary = ghost ? makeGhostColor(normalizedSecondary) : normalizedSecondary;
  for (const material of root?.userData?.turnPrimaryPaintMaterials || []) {
    material.color?.set(displayColor);
  }
  for (const material of root?.userData?.turnSecondaryPaintMaterials || []) {
    material.color?.set(displaySecondary);
  }
  if (root?.userData) {
    root.userData.turnCarColor = normalized;
    root.userData.turnCarSecondaryColor = normalizedSecondary;
  }
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

function addOutlines(model) {
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
        transparent: false,
        opacity: 0.82,
        depthWrite: true
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

function isWheelPart(node, material) {
  const label = `${node.name || ''} ${material.name || ''}`.toLowerCase();
  return /wheel|tire|tyre|rubber/.test(label);
}

function isSecondaryPaint(node, car) {
  const name = String(node?.name || '').toLowerCase();
  return (car.secondaryPaint?.meshNames || []).includes(name);
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
