import {
  createCarVisual as createBaseCarVisual,
  preloadCarModels,
  recolorCarVisual
} from './car-models.js?build=20260823-r183-native-car-surfaces&revision=r211-steering-wheels';

const EMERGENCY_IDS = new Set(['police', 'ambulance', 'firetruck']);

export { preloadCarModels, recolorCarVisual };

/**
 * Legacy import-map bridge. Emergency paint, glass, lamps, wheel details and the
 * shared front-wheel steering pivots come from the authored-model car factory.
 * TURN still installs its functional Boost light rig there, but no livery panels
 * or other presentation geometry are generated here; steering remains visual-only.
 */
export async function createCarVisual(options = {}) {
  const root = await createBaseCarVisual(options);
  if (EMERGENCY_IDS.has(root?.userData?.turnCarId)) {
    root.userData.turnEmergencyLivery = 'native-kenney-palette';
  }
  return root;
}
