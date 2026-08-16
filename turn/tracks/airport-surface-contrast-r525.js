const REVISION = 'r525-airport-ground-contrast';
const AIRPORT_TEXTURE_KEYS = new Set(['airport-grass', 'airport-concrete']);
const processedTextures = new WeakSet();

export const AIRPORT_SURFACE_CONTRAST = Object.freeze({
  contrast: 1.6,
  pivot: 0.92,
  darken: 0.055
});

function currentTrackId(runtime, fallback = '') {
  return globalThis.__turnGetTrackId?.() || runtime?.trackId || fallback;
}

function activeWorld(runtime, trackId) {
  return runtime?.activeWorld || (trackId === 'countryside' ? runtime?.world : null);
}

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function clampByte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function retoneAirportTexture(texture) {
  if (!texture || processedTextures.has(texture)) return false;
  const canvas = texture.image;
  if (!canvas || typeof canvas.getContext !== 'function') return false;
  const context = canvas.getContext('2d');
  if (!context || typeof context.getImageData !== 'function') return false;

  const width = Number(canvas.width) || 0;
  const height = Number(canvas.height) || 0;
  if (!width || !height) return false;

  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const pivot = AIRPORT_SURFACE_CONTRAST.pivot * 255;
  const darken = AIRPORT_SURFACE_CONTRAST.darken * 255;
  const contrast = AIRPORT_SURFACE_CONTRAST.contrast;

  for (let index = 0; index < data.length; index += 4) {
    data[index] = clampByte((data[index] - pivot) * contrast + pivot - darken);
    data[index + 1] = clampByte((data[index + 1] - pivot) * contrast + pivot - darken);
    data[index + 2] = clampByte((data[index + 2] - pivot) * contrast + pivot - darken);
  }

  context.putImageData(image, 0, 0);
  texture.needsUpdate = true;
  processedTextures.add(texture);
  return true;
}

export function applyAirportSurfaceContrast(world) {
  if (!world?.traverse) return 0;
  let changed = 0;

  world.traverse((node) => {
    const textureKey = node?.userData?.turnProceduralGroundTexture;
    if (!AIRPORT_TEXTURE_KEYS.has(textureKey)) return;

    let nodeChanged = false;
    for (const material of materialList(node.material)) {
      if (retoneAirportTexture(material?.map)) nodeChanged = true;
    }

    if (!nodeChanged) return;
    node.userData.turnAirportSurfaceContrast = REVISION;
    changed += 1;
  });

  if (changed > 0) {
    world.userData.turnAirportSurfaceContrast = REVISION;
  }
  return changed;
}

function polishRuntime(runtime, fallbackTrackId = '') {
  if (!runtime) return;
  const trackId = currentTrackId(runtime, fallbackTrackId);
  if (trackId !== 'airport') return;
  applyAirportSurfaceContrast(activeWorld(runtime, trackId));
}

function bootstrap() {
  if (globalThis.__turnRuntime) polishRuntime(globalThis.__turnRuntime);
  else {
    window.addEventListener('turn:runtime-ready', (event) => {
      polishRuntime(event.detail || globalThis.__turnRuntime);
    }, { once: true });
  }

  window.addEventListener('turn:track-changed', (event) => {
    polishRuntime(globalThis.__turnRuntime, event?.detail?.trackId || '');
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') bootstrap();