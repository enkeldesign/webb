const STORAGE_KEY = 'turn-low-graphics-v1';

export function loadLowGraphicsEnabled() {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === '1' || value === 'true' || value === 'on';
  } catch (_) {
    return false;
  }
}

export function saveLowGraphicsEnabled(enabled) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? '1' : '0');
    return true;
  } catch (_) {
    return false;
  }
}

const lowGraphics = loadLowGraphicsEnabled();

export const graphicsProfile = Object.freeze({
  lowGraphics,
  dprCap: lowGraphics ? 1 : Infinity,
  antialias: true,
  // Contours are an authored context choice, not a LOW-vs-default quality knob.
  // Racing explicitly requests contour-free visuals; The Lot keeps its outlines.
  outlines: true,
  pointLights: !lowGraphics,
  optionalScenery: true
});

export function graphicsPixelRatio(requested = Infinity, devicePixelRatio = globalThis.devicePixelRatio || 1) {
  const requestedRatio = Math.max(0.5, Number(requested) || 1);
  const deviceRatio = Math.max(0.5, Number(devicePixelRatio) || 1);
  return Math.min(requestedRatio, deviceRatio, graphicsProfile.dprCap);
}

globalThis.__turnGraphicsProfile = graphicsProfile;
