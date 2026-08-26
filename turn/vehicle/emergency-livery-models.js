import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js?build=20260826-r184-native-car-surfaces&revision=r211-steering-wheels';

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
  darkenVisibleWheels(root);
  if (EMERGENCY_IDS.has(root?.userData?.turnCarId)) {
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

      // Kenney wheel meshes use palette textures. Their semantic rim shader runs
      // after the material tint, so this makes the tyre/rubber nearly black while
      // keeping paintable rim cells legible in their authored/selected colour.
      material.color.setHex(DARK_TIRE_COLOR);
      if ('roughness' in material) {
        material.roughness = Math.max(Number(material.roughness) || 0, 0.9);
      }
    }
  });
}
