import * as THREE from 'three';
import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js?build=20260803-r126-emergency-livery-base';

const EMERGENCY_LIVERY_BY_ID = Object.freeze({
  police: Object.freeze({
    primary: 0x0b0d10,
    secondary: 0xf8f9fa,
    accent: 'door-panels'
  }),
  ambulance: Object.freeze({
    primary: 0xf8f9fa,
    secondary: 0xd92d20,
    accent: 'side-stripe'
  }),
  firetruck: Object.freeze({
    primary: 0xd92d20,
    secondary: 0xffd43b,
    accent: 'side-stripe'
  })
});

export { preloadCarModels, recolorCarVisual };

export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  const livery = EMERGENCY_LIVERY_BY_ID[root?.userData?.turnCarId];
  if (!livery) return root;

  applyFixedEmergencyLivery(root, livery, Boolean(options.ghost));
  return root;
}

function applyFixedEmergencyLivery(root, livery, ghost) {
  const model = root.children[0];
  if (!model) return;

  const primary = ghost ? makeGhostHex(livery.primary) : livery.primary;
  const secondary = ghost ? makeGhostHex(livery.secondary) : livery.secondary;
  const candidates = [];
  let explicitCount = 0;

  model.traverse((node) => {
    if (!node.isMesh || node.userData?.turnOutline || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (!material?.color || isProtectedPart(node, material)) continue;
      const explicit = isExplicitBodyPart(node, material);
      if (explicit) explicitCount += 1;
      candidates.push({ material, explicit });
    }
  });

  const paintable = candidates.filter(({ material, explicit }) => (
    explicit || (explicitCount === 0 && isLikelyBodyMaterial(material))
  ));
  const records = paintable.length ? paintable : candidates;

  for (const { material } of records) {
    material.color.setHex(primary);
    if ('roughness' in material) material.roughness = Math.max(Number(material.roughness) || 0, 0.72);
    material.needsUpdate = true;
  }

  installSecondaryAccent(root, model, secondary, livery.accent);
  root.userData.turnEmergencyLivery = Object.freeze({
    primary,
    secondary,
    accent: livery.accent
  });
}

function installSecondaryAccent(root, model, color, accent) {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  if (!Number.isFinite(size.x) || size.x <= 0 || size.z <= 0) return;

  const group = new THREE.Group();
  group.userData.turnEmergencyLiveryAccent = true;
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.78,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2
  });

  const sideDepth = Math.max(0.022, size.x * 0.007);
  const sideX = size.x * 0.5 + sideDepth * 0.55;
  const addSidePair = ({ length, height, y, z }) => {
    for (const direction of [-1, 1]) {
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(sideDepth, height, length),
        material
      );
      panel.position.set(center.x + direction * sideX, y, z);
      panel.castShadow = false;
      panel.receiveShadow = true;
      group.add(panel);
    }
  };

  if (accent === 'door-panels') {
    addSidePair({
      length: size.z * 0.34,
      height: size.y * 0.29,
      y: bounds.min.y + size.y * 0.48,
      z: center.z + size.z * 0.03
    });
  } else {
    addSidePair({
      length: size.z * 0.72,
      height: Math.max(0.08, size.y * 0.09),
      y: bounds.min.y + size.y * 0.49,
      z: center.z
    });
  }

  root.add(group);
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
  const luminance = material.color.r * 0.2126
    + material.color.g * 0.7152
    + material.color.b * 0.0722;
  return luminance > 0.16;
}

function makeGhostHex(hex) {
  const color = new THREE.Color(hex);
  color.lerp(new THREE.Color(0xffffff), 0.48);
  return color.getHex();
}
