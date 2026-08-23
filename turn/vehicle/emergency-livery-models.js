import * as THREE from 'three';
import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js?build=20260823-r176-rally-reward';
import {
  getVehicleDefaultColorSpec
} from './catalog.js?build=20260804-r157-factory-colors';
import {
  makeWideGamutSpec,
  setThreeColor,
  threeColorFromSpec
} from './wide-gamut.js?revision=r157-display-p3';

const LOT_TARGET_LENGTH = 5.15;
const LOT_UNSELECTED_HEX = 0x313131;
const LOT_TINT_MIX = 0.23;
const LOT_TINT_PATCHED_COLORS = new WeakSet();

const EMERGENCY_LIVERY_BY_ID = Object.freeze({
  police: Object.freeze({
    primary: makeWideGamutSpec('#0b0d10', [0.035, 0.045, 0.06]),
    secondary: makeWideGamutSpec('#f8f9fa', [0.95, 0.97, 0.98]),
    accent: 'door-panels'
  }),
  ambulance: Object.freeze({
    primary: makeWideGamutSpec('#f8f9fa', [0.95, 0.97, 0.98]),
    secondary: makeWideGamutSpec('#d92d20', [0.82, 0.08, 0.04]),
    accent: 'rear-side-stripe'
  }),
  firetruck: Object.freeze({
    primary: makeWideGamutSpec('#d92d20', [0.82, 0.08, 0.04]),
    secondary: makeWideGamutSpec('#ffcc00', [1, 0.76, 0]),
    accent: 'side-stripe'
  })
});

export { preloadCarModels, recolorCarVisual };

export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  const livery = EMERGENCY_LIVERY_BY_ID[root?.userData?.turnCarId];
  if (livery) applyFixedEmergencyLivery(root, livery, Boolean(options.ghost));
  if (Math.abs(Number(options.targetLength) - LOT_TARGET_LENGTH) < 0.001) {
    installLotUnselectedTint(root);
  }
  return root;
}

function applyFixedEmergencyLivery(root, livery, ghost) {
  const model = root.children[0];
  if (!model) return;

  const primary = ghost ? makeGhostHex(livery.primary.fallback) : livery.primary;
  const secondary = ghost ? makeGhostHex(livery.secondary.fallback) : livery.secondary;
  const candidates = [];
  let explicitCount = 0;

  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material?.color || isProtectedPart(node, material)) continue;
      const explicit = isExplicitBodyPart(node, material);
      if (explicit) explicitCount += 1;
      candidates.push({ node, material, explicit });
    }
  });

  const paintable = candidates.filter(({ material, explicit }) => (
    explicit || (explicitCount === 0 && isLikelyBodyMaterial(material))
  ));
  const records = paintable.length ? paintable : candidates;

  for (const { material } of records) {
    setThreeColor(material.color, primary);
    if ('roughness' in material) material.roughness = Math.max(Number(material.roughness) || 0, 0.72);
    material.needsUpdate = true;
  }

  const bodyBounds = boundsForLiverySurface(records);
  installSecondaryAccent(root, model, secondary, livery.accent, bodyBounds);
  root.userData.turnEmergencyLivery = Object.freeze({
    primary: livery.primary.fallback,
    secondary: livery.secondary.fallback,
    accent: livery.accent
  });
}

function boundsForLiverySurface(records) {
  const bounds = new THREE.Box3();
  const nodes = new Set();
  for (const { node } of records) {
    if (!node || nodes.has(node)) continue;
    nodes.add(node);
    bounds.expandByObject(node);
  }
  return bounds.isEmpty() ? null : bounds;
}

function installSecondaryAccent(root, model, color, accent, bodyBounds = null) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.x) || size.x <= 0 || size.z <= 0) return;

  // The secondary livery is a real mesh, so its inner face must live outside the
  // painted body surface. The previous 0.405 * total-width placement put these
  // panels inside the vehicle volume; polygon offset cannot prevent another mesh
  // from occluding geometry that is physically behind it as the car rotates.
  // Derive the side surface from the paintable body meshes (not wheels/mirrors),
  // then leave a tiny physical air gap. This is stable at every viewing angle.
  const surfaceBounds = bodyBounds || bounds;
  const surfaceSize = surfaceBounds.getSize(new THREE.Vector3());
  const sideDepth = Math.max(0.012, surfaceSize.x * 0.004);
  const surfaceGap = Math.max(0.006, surfaceSize.x * 0.002);
  const sideX = Object.freeze({
    left: surfaceBounds.min.x - sideDepth * 0.5 - surfaceGap,
    right: surfaceBounds.max.x + sideDepth * 0.5 + surfaceGap
  });

  const group = new THREE.Group();
  group.userData.turnEmergencyLiveryAccent = true;
  group.userData.turnEmergencyLiverySurfaceGap = surfaceGap;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });
  setThreeColor(material.color, color);

  const addSidePair = ({ length, height, y, z }) => {
    for (const direction of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(sideDepth, height, length), material);
      panel.position.set(direction < 0 ? sideX.left : sideX.right, y, z);
      panel.castShadow = false;
      panel.receiveShadow = true;
      panel.userData.turnEmergencyLiverySide = direction < 0 ? 'left' : 'right';
      group.add(panel);
    }
  };

  if (accent === 'door-panels') {
    addSidePair({ length: size.z * 0.34, height: size.y * 0.29, y: bounds.min.y + size.y * 0.48, z: center.z + size.z * 0.03 });
  } else if (accent === 'rear-side-stripe') {
    addSidePair({ length: size.z * 0.52, height: Math.max(0.08, size.y * 0.09), y: bounds.min.y + size.y * 0.49, z: center.z + size.z * 0.22 });
  } else {
    addSidePair({ length: size.z * 0.72, height: Math.max(0.08, size.y * 0.09), y: bounds.min.y + size.y * 0.49, z: center.z });
  }

  root.add(group);
}

function installLotUnselectedTint(root) {
  const factoryColor = threeColorFromSpec(getVehicleDefaultColorSpec(root.userData.turnCarId));
  const hint = new THREE.Color(LOT_UNSELECTED_HEX).lerp(factoryColor, LOT_TINT_MIX);

  root.traverse((node) => {
    if (!node.isMesh || !node.material || node.userData?.turnOutline) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      const color = material?.color;
      if (!color || LOT_TINT_PATCHED_COLORS.has(color)) continue;
      const originalCopy = color.copy.bind(color);
      color.copy = (source) => {
        const sourceHex = source?.getHex?.(THREE.SRGBColorSpace) ?? source?.getHex?.();
        return originalCopy(sourceHex === LOT_UNSELECTED_HEX ? hint : source);
      };
      LOT_TINT_PATCHED_COLORS.add(color);
    }
  });
  root.userData.turnLotUnselectedTint = hint.getHexString(THREE.SRGBColorSpace);
}

function isProtectedPart(node, material) {
  const label = `${node.name || ''} ${material.name || ''}`.toLowerCase();
  return /wheel|tire|tyre|rubber|glass|window|windscreen|light|lamp|chrome|axle|seat|interior|steering|mirror|grill|grille|plate|bumper/.test(label);
}

function isExplicitBodyPart(node, material) {
  const label = `${node.name || ''} ${material.name || ''}`.toLowerCase();
  return /paint|body|primary|vehiclecolor|carcolor|chassis|cab|van|truck/.test(label);
}

function isLikelyBodyMaterial(material) {
  if (!material?.color) return false;
  if (material.transparent && material.opacity < 0.8) return false;
  const luminance = material.color.r * 0.2126 + material.color.g * 0.7152 + material.color.b * 0.0722;
  return luminance > 0.16;
}

function makeGhostHex(hex) {
  const color = new THREE.Color(hex);
  color.lerp(new THREE.Color(0xffffff), 0.48);
  return color.getHex();
}
