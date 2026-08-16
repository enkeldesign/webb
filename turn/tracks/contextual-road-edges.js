const COLOR_EPSILON = 1e-4;
const INK = 0x08090a;
const TURN_PROFILE_YELLOW = 0xffbd12;

export const ROAD_EDGE_COLORS = Object.freeze({
  countryside: '#ffffff',
  airport: '#ffbd12',
  cliffside: '#ffffff',
  harbor: '#ffbd12'
});

export const ROAD_EDGE_CONTOURS = Object.freeze({
  airport: Object.freeze({ edgeWidth: 1.75, contourWidth: 0.62 }),
  cliffside: Object.freeze({ edgeWidth: 1.65, contourWidth: 0.62 }),
  harbor: Object.freeze({ edgeWidth: 1.8, contourWidth: 0.62 })
});

const EDGE_STYLES = Object.freeze({
  countryside: Object.freeze({
    source: Object.freeze([0xe63946, 0xfff8e8]),
    target: 0xffffff
  }),
  airport: Object.freeze({
    source: Object.freeze([0xff5f67, 0xfff8e8]),
    target: TURN_PROFILE_YELLOW
  }),
  cliffside: Object.freeze({
    source: Object.freeze([0xff5f67, 0xfff8e8]),
    target: 0xffffff
  }),
  harbor: Object.freeze({
    source: Object.freeze([0xf5c542, 0x08090a]),
    target: TURN_PROFILE_YELLOW
  })
});

const styledWorlds = new WeakMap();
const outlinedWorlds = new WeakSet();

export function applyContextualRoadEdges(world, trackId, {
  samples,
  trackWidth = 27
} = {}) {
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

  const contour = ROAD_EDGE_CONTOURS[trackId];
  if (
    contour
    && !outlinedWorlds.has(world)
    && matchingEdges.length
    && Array.isArray(samples)
    && samples.length > 2
  ) {
    for (const edge of matchingEdges) {
      installOuterContourFromEdge(edge, samples, Number(trackWidth) || 27, trackId, contour);
    }
    outlinedWorlds.add(world);
  }

  return changed;
}

function installOuterContourFromEdge(edge, samples, trackWidth, trackId, contour) {
  if (!edge?.clone || !edge.geometry?.clone) return false;
  const sourcePositions = edge.geometry.getAttribute?.('position');
  const sourceColors = edge.geometry.getAttribute?.('color');
  if (!sourcePositions || !sourceColors || sourcePositions.count < 6) return false;

  const mesh = edge.clone(false);
  mesh.geometry = edge.geometry.clone();
  mesh.material = cloneMaterial(edge.material);
  mesh.name = `TURN ${trackId} outer road contour`;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.userData = { ...(edge.userData || {}), turnContextualRoadContour: trackId };

  const positions = mesh.geometry.getAttribute('position');
  const colors = mesh.geometry.getAttribute('color');
  const firstSample = samples[0];
  const firstX = sourcePositions.getX(0) - Number(firstSample?.point?.x || 0);
  const firstZ = sourcePositions.getZ(0) - Number(firstSample?.point?.z || 0);
  const sideDot = firstX * Number(firstSample?.normal?.x || 0)
    + firstZ * Number(firstSample?.normal?.z || 0);
  const side = sideDot >= 0 ? 1 : -1;
  const halfTrack = trackWidth / 2;
  const innerDistance = halfTrack + contour.edgeWidth - 0.04;
  const outerDistance = halfTrack + contour.edgeWidth + contour.contourWidth;
  const segmentCount = Math.min(samples.length, Math.floor(positions.count / 6));

  for (let segment = 0; segment < segmentCount; segment += 1) {
    const current = samples[segment];
    const next = samples[(segment + 1) % samples.length];
    const base = segment * 6;
    setContourVertex(positions, sourcePositions, base, current, side, innerDistance);
    setContourVertex(positions, sourcePositions, base + 1, current, side, outerDistance);
    setContourVertex(positions, sourcePositions, base + 2, next, side, innerDistance);
    setContourVertex(positions, sourcePositions, base + 3, current, side, outerDistance);
    setContourVertex(positions, sourcePositions, base + 4, next, side, outerDistance);
    setContourVertex(positions, sourcePositions, base + 5, next, side, innerDistance);
  }
  positions.needsUpdate = true;

  const ink = hexToLinearRgb(INK);
  for (let index = 0; index < colors.count; index += 1) {
    colors.setXYZ(index, ink.r, ink.g, ink.b);
  }
  colors.needsUpdate = true;
  mesh.geometry.computeVertexNormals?.();

  const parent = edge.parent;
  parent?.add?.(mesh);
  return Boolean(parent);
}

function setContourVertex(attribute, sourceAttribute, index, sample, side, distance) {
  if (!sample?.point || !sample?.normal || index >= attribute.count) return;
  const x = Number(sample.point.x) + Number(sample.normal.x) * side * distance;
  const z = Number(sample.point.z) + Number(sample.normal.z) * side * distance;
  const y = sourceAttribute.getY(index) - 0.008;
  attribute.setXYZ(index, x, y, z);
}

function cloneMaterial(material) {
  if (Array.isArray(material)) return material.map((entry) => entry?.clone?.() || entry);
  return material?.clone?.() || material;
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
  applyContextualRoadEdges(world, trackId, {
    samples: runtime?.samples,
    trackWidth: runtime?.trackWidth
  });
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
