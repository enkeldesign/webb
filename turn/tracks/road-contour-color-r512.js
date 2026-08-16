const TURN_ROAD = 0x44494f;
const road = hexToLinearRgb(TURN_ROAD);

function applyRoadContourColor(world) {
  if (!world?.traverse) return 0;
  let changed = 0;

  world.traverse((node) => {
    if (!node?.userData?.turnContextualRoadContour) return;
    const colors = node.geometry?.getAttribute?.('color');
    if (!colors || colors.itemSize < 3) return;

    for (let index = 0; index < colors.count; index += 1) {
      colors.setXYZ(index, road.r, road.g, road.b);
    }
    colors.needsUpdate = true;
    changed += 1;
  });

  return changed;
}

function styleActiveTrack() {
  const runtime = globalThis.__turnRuntime;
  applyRoadContourColor(runtime?.activeWorld);
}

function bootstrap() {
  if (globalThis.__turnRuntime?.activeWorld) {
    applyRoadContourColor(globalThis.__turnRuntime.activeWorld);
  }
  window.addEventListener('turn:track-changed', styleActiveTrack);
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
