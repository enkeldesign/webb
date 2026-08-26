import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  DEFAULT_VEHICLE_SECONDARY_COLOR,
  getCarDefinition,
  getVehicleDefaultColorSpec,
  getVehicleDefaultSecondaryColorSpec,
  makeGhostColor,
  normalizeVehicleColor,
  normalizeVehicleSecondaryColor
} from './catalog.js';
import {
  makeWideGamutSpec,
  setThreeColor
} from './wide-gamut.js?revision=r157-display-p3';
import {
  getKenneyPaletteAsset,
  installSemanticCarFinish,
  recolorSemanticCarFinish
} from './semantic-car-finish.js';

const loadersByPack = new Map();
const sourceCache = new Map();
const buildKey = globalThis.__TURN_BUILD__?.cacheKey || '';
const TIRE_COLOR = 0x17191c;
const FEATURED_SURFACE_TARGET_LENGTHS = new Set([5.15, 5.5]);
const REVERSED_FRONT_WHEEL_LABEL_IDS = new Set(['vintage-racer']);

export async function preloadCarModels(carIds) {
  await Promise.all(carIds.map((carId) => loadCarSource(carId).catch(() => null)));
}

function primaryColorSpec(car, color) {
  return color === car.defaultColor
    ? getVehicleDefaultColorSpec(car.id)
    : makeWideGamutSpec(color);
}

function secondaryColorSpec(car, color) {
  return color === car.defaultSecondaryColor
    ? getVehicleDefaultSecondaryColorSpec(car.id)
    : makeWideGamutSpec(color);
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
  model.rotation.y = Math.PI + car.modelYawQuarterTurns * Math.PI / 2;
  root.add(model);

  const requestedColor = normalizeVehicleColor(color, car.defaultColor);
  const requestedSecondaryColor = normalizeVehicleSecondaryColor(
    secondaryColor,
    car.defaultSecondaryColor
  );
  const requestedColorSpec = primaryColorSpec(car, requestedColor);
  const requestedSecondaryColorSpec = secondaryColorSpec(car, requestedSecondaryColor);
  const ghostColor = makeGhostColor(requestedColor);
  const ghostSecondaryColor = makeGhostColor(requestedSecondaryColor);
  const meshRecords = [];
  const primaryPaintMaterials = [];
  const secondaryPaintMaterials = [];
  const semanticPaintRecords = [];
  let explicitPaintCount = 0;

  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const cloned = materials.map((material) => material.clone());
    node.material = Array.isArray(node.material) ? cloned : cloned[0];

    cloned.forEach((material) => {
      const semantic = installSemanticCarFinish({
        node,
        material,
        car,
        primaryColor: ghost ? ghostColor : requestedColorSpec,
        secondaryColor: ghost ? ghostSecondaryColor : requestedSecondaryColorSpec,
        primaryPaintMaterials,
        secondaryPaintMaterials,
        semanticPaintRecords
      });
      const record = {
        node,
        material,
        semantic,
        protected: isProtectedPart(node, material),
        wheel: isWheelPart(node, material),
        secondaryPaint: isSecondaryPaint(node, car),
        explicitPaint: isExplicitPaint(node, material)
      };
      if (!semantic && record.explicitPaint && !record.protected) explicitPaintCount += 1;
      meshRecords.push(record);
    });
  });

  for (const record of meshRecords) {
    const {
      material,
      semantic,
      protected: protectedPart,
      wheel: wheelPart,
      secondaryPaint,
      explicitPaint
    } = record;
    const paintable = !semantic && !car.fixedLivery && !protectedPart && !secondaryPaint && (
      explicitPaint
      || (explicitPaintCount === 0 && isFallbackPaintCandidate(material))
      || (car.pack !== 'car' && isFallbackPaintCandidate(material))
    );

    if (!semantic && wheelPart && material.color) {
      material.color.setHex(TIRE_COLOR);
      if ('roughness' in material) material.roughness = Math.max(Number(material.roughness) || 0, 0.82);
    } else if (!semantic && secondaryPaint && !protectedPart && material.color) {
      setThreeColor(material.color, ghost ? ghostSecondaryColor : requestedSecondaryColorSpec);
      secondaryPaintMaterials.push(material);
    } else if (paintable && material.color) {
      setThreeColor(material.color, ghost ? ghostColor : requestedColorSpec);
      primaryPaintMaterials.push(material);
    }

    if (ghost) {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.needsUpdate = true;
    }

    record.node.castShadow = !ghost;
    record.node.receiveShadow = true;
  }

  if (outline) addOutlines(model);
  const frontWheelPivots = installFrontWheelSteeringRig(model, car);
  const featuredSurface = FEATURED_SURFACE_TARGET_LENGTHS.has(targetLength);
  const featuredVisualSizeMultiplier = featuredSurface ? car.featuredVisualSizeMultiplier : 1;
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
  root.userData.turnSemanticPaintRecords = semanticPaintRecords;
  root.userData.frontWheelPivots = frontWheelPivots;
  root.userData.wheelSpinners = [];
  installWheelAnimationHostBridge(root);
  return root;
}

function installWheelAnimationHostBridge(visual) {
  visual.addEventListener('added', () => {
    const host = visual.parent;
    if (!host?.userData) return;
    host.userData.frontWheelPivots = visual.userData.frontWheelPivots || [];
    host.userData.wheelSpinners = visual.userData.wheelSpinners || [];
  });
}

function installEmergencyLightRig(root, model, service) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const barWidth = Math.max(0.46, size.x * 0.36);
  const lampWidth = barWidth * 0.46;
  const lampHeight = Math.max(0.1, size.y * 0.055);
  const lampDepth = Math.max(0.14, size.z * 0.065);
  const roofY = bounds.max.y + lampHeight * 0.7;
  const roofZ = center.z - size.z * (service === 'firetruck' ? 0.08 : 0.04);
  const lightDistance = Math.max(8, size.z * 3.1);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  const periodMs = reducedMotion ? 1400 : (service === 'police' ? 720 : 840);
  const colors = service === 'police'
    ? [makeWideGamutSpec('#ff3158'), makeWideGamutSpec('#2ab7ff')]
    : [makeWideGamutSpec('#2ab7ff'), makeWideGamutSpec('#2ab7ff')];
  const lamps = [];

  colors.forEach((colorSpec, index) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    });
    setThreeColor(material.color, colorSpec);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(lampWidth, lampHeight, lampDepth), material);
    lamp.position.set((index === 0 ? -1 : 1) * barWidth * 0.27, roofY, roofZ);
    lamp.visible = true;
    lamp.renderOrder = 42;

    const haloMaterial = material.clone();
    haloMaterial.opacity = 0;
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), haloMaterial);
    halo.position.copy(lamp.position);
    halo.scale.set(lampWidth * 2.3, lampHeight * 5.4, lampDepth * 2.3);
    halo.visible = false;
    halo.renderOrder = 41;

    const wideHaloMaterial = material.clone();
    wideHaloMaterial.opacity = 0;
    const wideHalo = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 10), wideHaloMaterial);
    wideHalo.position.copy(lamp.position);
    wideHalo.scale.set(lampWidth * 4.4, lampHeight * 8.2, lampDepth * 4.4);
    wideHalo.visible = false;
    wideHalo.renderOrder = 40;

    const pointLight = new THREE.PointLight(0xffffff, 0, lightDistance, 2);
    setThreeColor(pointLight.color, colorSpec);
    pointLight.position.copy(lamp.position);
    pointLight.position.y += lampHeight * 1.2;
    pointLight.castShadow = false;

    root.add(pointLight, wideHalo, halo, lamp);
    lamps.push({ lamp, material, halo, haloMaterial, wideHalo, wideHaloMaterial, pointLight, index });
  });

  const rig = { service, lamps, periodMs, reducedMotion, lastFrameAt: -Infinity };
  root.userData.turnEmergencyService = service;
  root.userData.turnEmergencyLightRig = rig;
  for (const record of lamps) record.lamp.onBeforeRender = () => updateEmergencyLightRig(rig);
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
    record.halo.visible = active && on;
    record.wideHalo.visible = active && !rig.reducedMotion && on;
    record.material.opacity = active ? (on ? 1 : 0.08) : 0;
    record.haloMaterial.opacity = active && on ? (rig.reducedMotion ? 0.42 : 0.68) : 0;
    record.wideHaloMaterial.opacity = active && on ? 0.26 : 0;
    record.pointLight.intensity = active && on ? (rig.reducedMotion ? 70 : 110) : 0;
  }
}

export function recolorCarVisual(root, color, secondaryColor = root?.userData?.turnCarSecondaryColor) {
  const car = getCarDefinition(root?.userData?.turnCarId);
  const normalized = normalizeVehicleColor(color, car.defaultColor);
  const normalizedSecondary = normalizeVehicleSecondaryColor(secondaryColor, car.defaultSecondaryColor);
  const ghost = Boolean(root?.userData?.turnGhost);
  const displayColor = ghost ? makeGhostColor(normalized) : primaryColorSpec(car, normalized);
  const displaySecondary = ghost
    ? makeGhostColor(normalizedSecondary)
    : secondaryColorSpec(car, normalizedSecondary);
  recolorSemanticCarFinish(root, displayColor, displaySecondary);
  for (const material of root?.userData?.turnPrimaryPaintMaterials || []) {
    if (material.userData?.turnSemanticPaint) continue;
    setThreeColor(material.color, displayColor);
  }
  for (const material of root?.userData?.turnSecondaryPaintMaterials || []) {
    if (material.userData?.turnSemanticPaint) continue;
    setThreeColor(material.color, displaySecondary);
  }
  if (root?.userData) {
    root.userData.turnCarColor = normalized;
    root.userData.turnCarSecondaryColor = normalizedSecondary;
  }
}

async function loadCarSource(carId) {
  const car = getCarDefinition(carId);
  if (!sourceCache.has(car.id)) {
    sourceCache.set(car.id, loaderForPack(car.pack).loadAsync(assetUrl(car.asset)).then((gltf) => gltf.scene));
  }
  return sourceCache.get(car.id);
}

function loaderForPack(pack) {
  const key = String(pack || 'default');
  if (loadersByPack.has(key)) return loadersByPack.get(key);
  const paletteAsset = getKenneyPaletteAsset(key);
  if (!paletteAsset) {
    const loader = new GLTFLoader();
    loadersByPack.set(key, loader);
    return loader;
  }
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => (
    /(?:^|\/)Textures\/colormap\.png(?:[?#]|$)/i.test(url)
      ? assetUrl(paletteAsset)
      : url
  ));
  const loader = new GLTFLoader(manager);
  loadersByPack.set(key, loader);
  return loader;
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

function installFrontWheelSteeringRig(model, car) {
  const actualFrontRole = REVERSED_FRONT_WHEEL_LABEL_IDS.has(car.id) ? 'back' : 'front';
  const frontWheels = [];
  model.traverse((node) => {
    if (!node?.parent || wheelRole(node.name) !== actualFrontRole) return;
    frontWheels.push(node);
  });

  const pivots = [];
  for (const wheel of frontWheels) {
    const parent = wheel.parent;
    const localPosition = wheel.position.clone();
    parent.remove(wheel);

    const pivot = new THREE.Group();
    pivot.name = `${wheel.name || 'wheel'}-steer-pivot`;
    pivot.position.copy(localPosition);
    parent.add(pivot);

    wheel.position.set(0, 0, 0);
    pivot.add(wheel);
    pivots.push(pivot);
  }
  return pivots;
}

function wheelRole(name = '') {
  const label = String(name).toLowerCase();
  if (/^wheel-(?:front|f[lr])(?:-|$)/.test(label)) return 'front';
  if (/^wheel-(?:back|b[lr])(?:-|$)/.test(label)) return 'back';
  return null;
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
