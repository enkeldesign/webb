const TURN_INK = 0x08090a;
const TURN_ROAD = 0x44494f;
const COUNTRYSIDE_CONTOUR_Y = 0.158;
const COUNTRYSIDE_CONTOUR_TOLERANCE = 0.012;
const INITIAL_RETRY_DELAYS_MS = Object.freeze([0, 180, 520, 1200, 2400, 4200]);
const road = hexToLinearRgb(TURN_ROAD);

function applyRoadContourColor(world) {
  if (!world?.traverse) return 0;
  let changed = 0;

  world.traverse((node) => {
    if (node?.userData?.turnContextualRoadContour) {
      const colors = node.geometry?.getAttribute?.('color');
      if (!colors || colors.itemSize < 3) return;

      for (let index = 0; index < colors.count; index += 1) {
        colors.setXYZ(index, road.r, road.g, road.b);
      }
      colors.needsUpdate = true;
      changed += 1;
      return;
    }

    if (!isCountrysideRoadContour(node)) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    let recolored = false;
    for (const material of materials) {
      if (material?.color?.getHex?.() !== TURN_INK) continue;
      material.color.setHex(TURN_ROAD);
      material.needsUpdate = true;
      recolored = true;
    }
    if (!recolored) return;

    node.userData ||= {};
    node.userData.turnContextualRoadContour = 'countryside';
    changed += 1;
  });

  return changed;
}

function isCountrysideRoadContour(node) {
  if (!node?.isMesh || !node.userData?.turnNoAutoOutline) return false;
  const positions = node.geometry?.getAttribute?.('position');
  if (!positions || positions.itemSize < 3 || positions.count < 6) return false;

  node.geometry.computeBoundingBox?.();
  const bounds = node.geometry.boundingBox;
  if (!bounds) return false;
  return Math.abs(bounds.min.y - COUNTRYSIDE_CONTOUR_Y) <= COUNTRYSIDE_CONTOUR_TOLERANCE
    && Math.abs(bounds.max.y - COUNTRYSIDE_CONTOUR_Y) <= COUNTRYSIDE_CONTOUR_TOLERANCE;
}

function styleCurrentWorld() {
  const runtime = globalThis.__turnRuntime;
  applyRoadContourColor(runtime?.activeWorld || runtime?.world);
}

function scheduleInitialPasses() {
  for (const delay of INITIAL_RETRY_DELAYS_MS) {
    window.setTimeout(styleCurrentWorld, delay);
  }
}

function bootstrap() {
  styleCurrentWorld();
  scheduleInitialPasses();
  window.addEventListener('turn:runtime-ready', scheduleInitialPasses, { once: true });
  window.addEventListener('turn:home-ready', styleCurrentWorld);
  window.addEventListener('turn:track-changed', () => {
    styleCurrentWorld();
    window.setTimeout(styleCurrentWorld, 0);
  });
}

function hexToLinearRgb(hex) {
  return {
    r: srgbToLinear(((hex >> 16) & 0xff) / 255),
    g: srgbToLinear(((hex >> 8) & 0xff) / 255),
    b: srgbToLinear((hex & 0xff) / 255)
  };
}

function srgbToLinear(channel) {
  return channel < 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

if (typeof window !== 'undefined') bootstrap();
