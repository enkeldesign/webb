import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js?build=20260823-r181-native-car-surfaces';

const EMERGENCY_IDS = new Set(['police', 'ambulance', 'firetruck']);

export { preloadCarModels, recolorCarVisual };

/**
 * Legacy import-map bridge. Emergency paint, glass, lamps and wheel details now
 * come directly from the authored Kenney palette atlas. TURN still installs its
 * functional Boost light rig in the shared car factory, but no livery panels or
 * other presentation geometry are generated here.
 */
export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  if (EMERGENCY_IDS.has(root?.userData?.turnCarId)) {
    root.userData.turnEmergencyLivery = 'native-kenney-palette';
  }
  return root;
}
