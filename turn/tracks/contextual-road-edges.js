const COLOR_EPSILON = 1e-4;

export const ROAD_EDGE_COLORS = Object.freeze({
  countryside: '#ffffff',
  airport: '#ffd43b',
  cliffside: '#ffffff',
  harbor: '#f5c542'
});

const EDGE_STYLES = Object.freeze({
  countryside: Object.freeze({
    source: Object.freeze([0xe63946, 0xfff8e8]),
    target: 0xffffff
  }),
  airport: Object.freeze({
    source: Object.freeze([0xff5f67, 0xfff8e8]),
    target: 0xffd43b
  }),
  cliffside: Object.freeze({
    source: Object.freeze([0xff5f67, 0xfff8e8]),
    target: 0xffffff
  }),
  harbor: Object.freeze({
    source: Object.freeze([0xf5c542, 0x08090a]),
    target: 0xf5c542
  })
});

const styledWorlds = new WeakMap();

export function applyContextualRoadEdges(world, trackId) {
  const style = EDGE_STYLES[trackId];
  if (!world?.traverse || !style) return 0;
  if (styledWorlds.get(world) === trackId) return 0;

  const source = style.source.map(hexToLinearRgb);
  const target = hexToLinearRgb(style.target);
  let changed = 0;

  world.traverse((node) => {
    const colors = node?.geometry?.getAttribute?.('color');
    if (!colors || colors.itemSize < 3 || colors.count < 2) return;
    if (!matchesAlternatingPalette(colors, source)) return;

    for (let index = 0; index < colors.count; index += 1) {
      colors.setXYZ(index, target.r, target.g, target.b);
    }
    colors.needsUpdate = true;
    node.userData ||= {};
    node.userData.turnContextualRoadEdge = trackId;
    changed += 1;
  });

  styledWorlds.set(world, trackId);
  return changed;
}

function matchesAlternatingPalette(attribute, palette) {
  const seen = new Array(palette.length).fill(false);

  for (let index = 0; index < attribute.count; index += 1) {
    const r = attribute.getX(index);
    const g = attribute.getY(index);
    const b = attribute.getZ(index);
    let match = -1;

    for (let paletteIndex = 0; paletteIndex < palette.length; paletteIndex += 1) {
      const color = palette[paletteIndex];
      if (
        Math.abs(r - color.r) <= COLOR_EPSILON
        && Math.abs(g - color.g) <= COLOR_EPSILON
        && Math.abs(b - color.b) <= COLOR_EPSILON
      ) {
        match = paletteIndex;
        break;
      }
    }

    if (match < 0) return false;
    seen[match] = true;
  }

  return seen.every(Boolean);
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

function styleInitialCountryside(runtime) {
  applyContextualRoadEdges(runtime?.world, 'countryside');
}

function styleActiveTrack(event) {
  const trackId = event?.detail?.trackId;
  const runtime = globalThis.__turnRuntime;
  const world = runtime?.activeWorld || (trackId === 'countryside' ? runtime?.world : null);
  applyContextualRoadEdges(world, trackId);
}

function bootstrap() {
  if (globalThis.__turnRuntime) styleInitialCountryside(globalThis.__turnRuntime);
  else {
    window.addEventListener('turn:runtime-ready', (event) => {
      styleInitialCountryside(event.detail || globalThis.__turnRuntime);
    }, { once: true });
  }

  window.addEventListener('turn:track-changed', styleActiveTrack);
}

if (typeof window !== 'undefined') bootstrap();
