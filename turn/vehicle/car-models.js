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
// Existing production surfaces use stable target lengths: 5.15 for the standard
// Lot lineup and 5.5 for race cars. The expanded viewer and record thumbnails use
// 6.4 and intentionally keep the authored scale.
const FEATURED_SURFACE_TARGET_LENGTHS = new Set([5.15, 5.5]);

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
    const paintable = !car.fixedLivery && !protectedPart && !secondaryPaint && (
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
  const featuredSurface = FEATURED_SURFACE_TARGET_LENGTHS.has(targetLength);
  const featuredVisualSizeMultiplier = featuredSurface
    ? car.featuredVisualSizeMultiplier
    : 1;
  const effectiveVisualScale = car.visualScale
    * car.visualSizeMultiplier
    * featuredVisualSizeMultiplier;
  normalizeModelToGround(model, targetLength * effectiveVisualScale);
  if (car.emergencyService && !ghost) installEmergencyLightRig(root, model, car.emergencyService);

  root.userData.turnCarId = car.id;
  root.userData.turnCarColor = requestedColor;
  root.userData.turnCarSecondaryColor = requestedSecondaryColor;
  root.userData.turnGhost = ghost;
  root.userData.turnModelYawQuarterTurns = car.modelYawQuarterTurns;
  root.userData.turnVisualSizeMultiplier = car.visualSizeMultiplier;
  root.userData.turnFeaturedVisualSizeMultiplier = featuredVisualSizeMultiplier;
  root.userData.turnFeaturedVisualSurface = featuredSurface;
  root.userData.turnEffectiveVisualScale = effectiveVisualScale;
  root.userData.turnPrimaryPaintMaterials = primaryPaintMaterials;
  root.userData.turnSecondaryPaintMaterials = secondaryPaintMaterials;
  root.userData.turnPaintMaterials = [...primaryPaintMaterials, ...secondaryPaintMaterials];
  root.userData.frontWheelPivots = [];
  root.userData.wheelSpinners = [];
  return root;
}


function installEmergencyLightRig(root, model, service) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const barWidth = Math.max(0.42, size.x * 0.34);
  const lampWidth = barWidth * 0.42;
  const lampHeight = Math.max(0.08, size.y * 0.045);
  const lampDepth = Math.max(0.12, size.z * 0.055);
  const roofY = bounds.max.y + lampHeight * 0.6;
  const roofZ = center.z - size.z * (service === 'firetruck' ? 0.08 : 0.04);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const periodMs = reducedMotion ? 1400 : (service === 'police' ? 720 : 840);
  const colors = service === 'police' ? [0xff264d, 0x168bff] : [0x168bff, 0x168bff];
  const lamps = [];

  colors.forEach((color, index) => {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      toneMapped: false
    });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(lampWidth, lampHeight, lampDepth), material);
    lamp.position.set((index === 0 ? -1 : 1) * barWidth * 0.27, roofY, roofZ);
    lamp.visible = true;
    lamp.renderOrder = 40;

    const haloMaterial = material.clone();
    haloMaterial.opacity = 0;
    const halo = new THREE.Mesh(
      new THREE.BoxGeometry(lampWidth * 1.45, lampHeight * 1.7, lampDepth * 1.45),
      haloMaterial
    );
    halo.position.copy(lamp.position);
    halo.visible = false;
    halo.renderOrder = 39;

    root.add(halo, lamp);
    lamps.push({ lamp, material, halo, haloMaterial, index });
  });

  const rig = {
    service,
    lamps,
    periodMs,
    reducedMotion,
    lastFrameAt: -Infinity
  };
  root.userData.turnEmergencyService = service;
  root.userData.turnEmergencyLightRig = rig;
  for (const record of lamps) {
    record.lamp.onBeforeRender = () => updateEmergencyLightRig(rig);
  }
}

function updateEmergencyLightRig(rig) {
  const now = performance.now();
  if (now === rig.lastFrameAt) return;
  rig.lastFrameAt = now;
  const active = Boolean(globalThis.__turnBoostActive);
  const phase = (now % rig.periodMs) / rig.periodMs;
  const firstOn = phase < 0.5;

  for (const record of rig.lamps) {
    const on = record.index === 0 ? firstOn : !firstOn;
    record.lamp.visible = true;
    record.halo.visible = active && !rig.reducedMotion && on;
    record.material.opacity = active ? (on ? 1 : 0.16) : 0;
    record.haloMaterial.opacity = active && on ? 0.24 : 0;
  }
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
        opacity: 1,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
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
