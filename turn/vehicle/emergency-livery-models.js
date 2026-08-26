import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js';

const EMERGENCY_IDS = new Set(['police', 'ambulance', 'firetruck']);
const DARK_TIRE_COLOR = 0x060708;

export { preloadCarModels, recolorCarVisual };

/**
 * Legacy import-map bridge. Emergency paint, glass, lamps, wheel details and the
 * shared front-wheel steering pivots all come from the authored-model car factory.
 * TURN still installs its functional Boost light rig there, but no livery panels
 * or other presentation geometry are generated here; steering is visual-only and
 * never changes vehicle physics.
 */
export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  const emergency = EMERGENCY_IDS.has(root?.userData?.turnCarId);

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
