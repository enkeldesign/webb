const COLOR_EPSILON = 1e-4;
const TURN_SIGNATURE_YELLOW = 0xffbd12;
const DISPLAY_MATCHED_EDGE_TRACKS = new Set(['airport', 'harbor']);

export const ROAD_EDGE_COLORS = Object.freeze({
  countryside: '#ffffff',
  airport: '#ffbd12',
  cliffside: '#ffffff',
  harbor: '#ffbd12'
});


const EDGE_STYLES = Object.freeze({
  countryside: Object.freeze({
    source: Object.freeze([0xe63946, 0xfff8e8]),
    target: 0xffffff
  }),
  airport: Object.freeze({
    source: Object.freeze([0xff5f67, 0xfff8e8]),
    target: TURN_SIGNATURE_YELLOW
  }),
  cliffside: Object.freeze({
    source: Object.freeze([0xff5f67, 0xfff8e8]),
    target: 0xffffff
  }),
  harbor: Object.freeze({
    source: Object.freeze([0xf5c542, 0x08090a]),
    target: TURN_SIGNATURE_YELLOW
  })
});

const styledWorlds = new WeakMap();

export function applyContextualRoadEdges(world, trackId) {
  const style = EDGE_STYLES[trackId];
  if (!world?.traverse || !style) return 0;

  let changed = 0;
  const matchingEdges = [];
  if (styledWorlds.get(world) !== trackId) {
    const source = style.source.map(hexToLinearRgb);
    const target = hexToLinearRgb(style.target);

    world.traverse((node) => {
      const colors = node?.geometry?.getAttribute?.('color');
      if (!colors || colors.itemSize < 3 || colors.count < 2) return;
      if (!matchesAlternatingPalette(colors, source)) return;

      matchingEdges.push(node);
      for (let index = 0; index < colors.count; index += 1) {
        colors.setXYZ(index, target.r, target.g, target.b);
      }
      colors.needsUpdate = true;
      node.userData ||= {};
      node.userData.turnContextualRoadEdge = trackId;
      changed += 1;
    });

    styledWorlds.set(world, trackId);
  }

  // The Home header is a flat CSS #ffbd12. Airport and Harbor used the same
  // numeric color already, but MeshStandardMaterial lighting could push that
  // yellow toward a much brighter/neon result. These painted road edges are UI-like
  // wayfinding marks, so render them as an unlit display color.
  if (DISPLAY_MATCHED_EDGE_TRACKS.has(trackId)) {
    for (const edge of matchingEdges) {
      lockMaterialToDisplayColor(edge.material, style.target);
    }
  }

  return changed;
}


function lockMaterialToDisplayColor(material, hex) {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) {
    if (!entry?.color?.setHex || !entry?.emissive?.setHex) continue;
    entry.color.setHex(0x000000);
    entry.emissive.setHex(hex);
    entry.emissiveIntensity = 1;
    entry.vertexColors = false;
    entry.toneMapped = false;
    entry.needsUpdate = true;
  }
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
