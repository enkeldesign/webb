import * as THREE from 'three';

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
  airport: Object.freeze({ edgeWidth: 1.75, contourWidth: 0.62, heightOffset: 0.197 }),
  cliffside: Object.freeze({ edgeWidth: 1.65, contourWidth: 0.62, heightOffset: 0.162 }),
  harbor: Object.freeze({ edgeWidth: 1.8, contourWidth: 0.62, heightOffset: 0.207 })
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
  if (styledWorlds.get(world) !== trackId) {
    const source = style.source.map(hexToLinearRgb);
    const target = hexToLinearRgb(style.target);

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
  }

  const contour = ROAD_EDGE_CONTOURS[trackId];
  if (
    contour
    && !outlinedWorlds.has(world)
    && Array.isArray(samples)
    && samples.length > 2
    && typeof world.add === 'function'
  ) {
    installOuterContour(world, samples, Number(trackWidth) || 27, trackId, contour);
    outlinedWorlds.add(world);
  }

  return changed;
}

function installOuterContour(world, samples, trackWidth, trackId, contour) {
  const group = new THREE.Group();
  group.name = `TURN ${trackId} outer road contours`;
  group.userData.turnContextualRoadContour = trackId;

  for (const side of [-1, 1]) {
    const positions = [];
    const indices = [];
    const halfTrack = trackWidth / 2;
    const innerDistance = halfTrack + contour.edgeWidth - 0.04;
    const outerDistance = halfTrack + contour.edgeWidth + contour.contourWidth;

    for (let index = 0; index <= samples.length; index += 1) {
      const sample = samples[index % samples.length];
      if (!sample?.point || !sample?.normal) continue;

      const inner = sample.point.clone()
        .addScaledVector(sample.normal, side * innerDistance);
      const outer = sample.point.clone()
        .addScaledVector(sample.normal, side * outerDistance);
      inner.y = sample.point.y + contour.heightOffset;
      outer.y = sample.point.y + contour.heightOffset;
      positions.push(inner.x, inner.y, inner.z, outer.x, outer.y, outer.z);
    }

    const rowCount = positions.length / 6;
    for (let index = 0; index < rowCount - 1; index += 1) {
      const a = index * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }

    if (!indices.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: INK,
        roughness: 0.94,
        metalness: 0,
        side: THREE.DoubleSide
      })
    );
    mesh.name = `TURN ${trackId} outer road contour ${side}`;
    mesh.receiveShadow = true;
    mesh.userData.turnContextualRoadContour = trackId;
    group.add(mesh);
  }

  if (group.children.length) world.add(group);
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
