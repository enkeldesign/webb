import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js?revision=r224-learner-car-base';
import { installLearnerCarLivery } from './learner-car-livery.js';

const EMERGENCY_IDS = new Set(['police', 'ambulance', 'firetruck']);
const LEARNER_CAR_ID = 'classic';
const DARK_TIRE_COLOR = 0x060708;

export { preloadCarModels, recolorCarVisual };

/**
 * Shared presentation bridge. Emergency paint, glass, lamps, wheel details and the
 * front-wheel steering pivots come from the canonical authored-model car factory.
 * The Learner Car additionally restores the Taxi's exact original Kenney roof-sign
 * triangles and applies its fixed yellow/black L identifiers by colour treatment.
 * No replacement sign shape or door geometry is generated here.
 */
export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  const carId = root?.userData?.turnCarId;
  const emergency = EMERGENCY_IDS.has(carId);

  if (carId === LEARNER_CAR_ID) {
    const authoredModel = root?.children?.[0] || null;
    installLearnerCarLivery(authoredModel, { id: LEARNER_CAR_ID }, {
      ghost: Boolean(root?.userData?.turnGhost)
    });
  }

  // Fixed-livery emergency wheels use one authored palette texture for tyre and rim.
  // They intentionally skip semantic repaint, so tinting the whole wheel would also
  // blacken the authored rim cells. Preserve the native wheel atlas for those cars.
  if (!emergency) darkenVisibleWheels(root);
  if (emergency) {
    root.userData.turnEmergencyLivery = 'native-kenney-palette';
  }
  return root;
}

function darkenVisibleWheels(root) {
  root?.traverse?.((node) => {
    if (!node?.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      const label = `${node.name || ''} ${material?.name || ''}`.toLowerCase();
      if (!/wheel|tire|tyre|rubber/.test(label) || !material?.color) continue;

      // Repaintable Kenney wheel meshes use palette textures. Their semantic rim
      // shader runs after this material tint, leaving painted rim cells legible while
      // the tyre/rubber reads almost black.
      material.color.setHex(DARK_TIRE_COLOR);
      if ('roughness' in material) {
        material.roughness = Math.max(Number(material.roughness) || 0, 0.9);
      }
    }
  });
}
