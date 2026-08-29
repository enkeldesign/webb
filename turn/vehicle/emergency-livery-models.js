import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js';
import { installTrainingCarSignage } from './training-car-signage-r224.js';

const EMERGENCY_IDS = new Set(['police', 'ambulance', 'firetruck']);
const TRAINING_CAR_ID = 'classic';
const DARK_TIRE_COLOR = 0x060708;

export { preloadCarModels, recolorCarVisual };

/**
 * Legacy import-map bridge. Emergency paint, glass, lamps, wheel details and the
 * shared front-wheel steering pivots all come from the authored-model car factory.
 * TURN still installs its functional Boost light rig there, but no emergency livery
 * panels or other service-vehicle presentation geometry are generated here;
 * steering is visual-only and never changes vehicle physics.
 *
 * Training Car is the one deliberate non-emergency presentation exception: its
 * Kenney Taxi source lost part of the roof when the Taxi sign was surgically
 * removed. A fixed green training sign now occupies that mount and matching green
 * door plaques distinguish it from a yellow taxi without becoming part of
 * PAINTJOB's body/trim material lists.
 */
export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  const emergency = EMERGENCY_IDS.has(root?.userData?.turnCarId);

  if (root?.userData?.turnCarId === TRAINING_CAR_ID) installTrainingCarSignage(root);

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
