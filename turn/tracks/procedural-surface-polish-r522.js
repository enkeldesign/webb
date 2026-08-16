import * as THREE from 'three';

const REVISION = 'r522-procedural-surfaces';
const ROAD_TRACKS = new Set(['airport', 'cliffside', 'harbor']);
const GROUND_TRACKS = new Set(['airport', 'harbor']);

export const PROCEDURAL_SURFACE_PLAN = Object.freeze({
  airport: Object.freeze({ ground: true, road: true }),
  cliffside: Object.freeze({ ground: false, road: true }),
  harbor: Object.freeze({ ground: true, road: true })
});

const GROUND_TARGETS = Object.freeze({
  airport: Object.freeze([
    Object.freeze({ width: 900, height: 700, color: 0xb9ef8e, texture: 'airport-grass' }),
    Object.freeze({ width: 620, height: 390, color: 0xd9d7c8, texture: 'airport-concrete' }),
    Object.freeze({ width: 390, height: 150, color: 0x89929b, texture: 'airport-concrete' })
  ]),
  harbor: Object.freeze([
    Object.freeze({ width: 720, height: 500, color: 0xb7c99a, texture: 'harbor-land' }),
    Object.freeze({ width: 620, height: 385, color: 0x9da4a5, texture: 'harbor-concrete' })
  ])
});

const textureCache = new Map();

function pseudo(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function currentTrackId(runtime, fallback = '') {
  return globalThis.__turnGetTrackId?.() || runtime?.trackId || fallback;
}

function activeWorld(runtime, trackId) {
  return runtime?.activeWorld || (trackId === 'countryside' ? runtime?.world : null);
}

function makeCanvas(size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function finishTexture(canvas, repeatX, repeatY) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return texture;
}

function broadFields(ctx, {
  seed,
  palette,
  count = 48,
  minAlpha = 0.035,
  maxAlpha = 0.11,
  minRadius = 34,
  maxRadius = 128
}) {
  for (let index = 0; index < count; index += 1) {
    const x = pseudo(seed + index * 7.1) * ctx.canvas.width;
    const y = pseudo(seed + 1000 + index * 5.3) * ctx.canvas.height;
    const radiusX = minRadius + pseudo(seed + 2000 + index * 3.7) * (maxRadius - minRadius);
    const radiusY = minRadius * 0.65 + pseudo(seed + 3000 + index * 4.9) * (maxRadius * 0.72);
    ctx.globalAlpha = minAlpha + pseudo(seed + 4000 + index * 6.1) * (maxAlpha - minAlpha);
    ctx.fillStyle = palette[index % palette.length];
    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, pseudo(seed + 5000 + index) * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function broadSlabs(ctx, {
  seed,
  palette,
  count = 15,
  minAlpha = 0.025,
  maxAlpha = 0.075
}) {
  for (let index = 0; index < count; index += 1) {
    const width = 70 + pseudo(seed + index * 3.3) * 210;
    const height = 28 + pseudo(seed + 900 + index * 4.1) * 92;
    const x = pseudo(seed + 1800 + index * 2.7) * (ctx.canvas.width - width);
    const y = pseudo(seed + 2700 + index * 5.7) * (ctx.canvas.height - height);
    ctx.save();
    ctx.translate(x + width / 2, y + height / 2);
    ctx.rotate((pseudo(seed + 3600 + index) - 0.5) * 0.12);
    ctx.globalAlpha = minAlpha + pseudo(seed + 4500 + index * 4.3) * (maxAlpha - minAlpha);
    ctx.fillStyle = palette[index % palette.length];
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function makeAirportGrassTexture() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f7ee';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  broadFields(ctx, {
    seed: 11000,
    palette: ['#dce8d5', '#ffffff', '#e7efdc', '#d6e1d1'],
    count: 64,
    minAlpha: 0.04,
    maxAlpha: 0.12,
    minRadius: 38,
    maxRadius: 145
  });

  ctx.lineCap = 'round';
  for (let index = 0; index < 90; index += 1) {
    const x = pseudo(12000 + index) * canvas.width;
    const y = pseudo(13000 + index) * canvas.height;
    const length = 8 + pseudo(14000 + index) * 24;
    const angle = (pseudo(15000 + index) - 0.5) * 0.9;
    ctx.globalAlpha = 0.025 + pseudo(16000 + index) * 0.045;
    ctx.strokeStyle = index % 2 ? '#d8e3d3' : '#ffffff';
    ctx.lineWidth = 2 + pseudo(17000 + index) * 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finishTexture(canvas, 3.0, 2.35);
}

function makeAirportConcreteTexture() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f4ef';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  broadFields(ctx, {
    seed: 21000,
    palette: ['#e5e4df', '#ffffff', '#ece9df', '#dfe4e2'],
    count: 44,
    minAlpha: 0.035,
    maxAlpha: 0.095,
    minRadius: 42,
    maxRadius: 155
  });
  broadSlabs(ctx, {
    seed: 22000,
    palette: ['#d7d9d6', '#ffffff', '#e5e0d6'],
    count: 11,
    minAlpha: 0.025,
    maxAlpha: 0.065
  });
  return finishTexture(canvas, 2.45, 1.85);
}

function makeHarborLandTexture() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f4ed';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  broadFields(ctx, {
    seed: 31000,
    palette: ['#dfe5d9', '#ffffff', '#e5e2d5', '#d8dfd5'],
    count: 58,
    minAlpha: 0.04,
    maxAlpha: 0.105,
    minRadius: 38,
    maxRadius: 148
  });
  return finishTexture(canvas, 2.8, 2.1);
}

function makeHarborConcreteTexture() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f2f3f1';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  broadFields(ctx, {
    seed: 41000,
    palette: ['#dfe2e0', '#ffffff', '#e9e5dc', '#d8dddd'],
    count: 50,
    minAlpha: 0.045,
    maxAlpha: 0.11,
    minRadius: 44,
    maxRadius: 158
  });
  broadSlabs(ctx, {
    seed: 42000,
    palette: ['#d4d8d7', '#ffffff', '#e4e0d7'],
    count: 13,
    minAlpha: 0.03,
    maxAlpha: 0.075
  });

  ctx.fillStyle = '#d4d8d6';
  for (let index = 0; index < 6; index += 1) {
    const x = 30 + pseudo(43000 + index) * 380;
    const width = 22 + pseudo(44000 + index) * 46;
    ctx.globalAlpha = 0.02 + pseudo(45000 + index) * 0.025;
    ctx.fillRect(x, 0, width, canvas.height);
  }
  ctx.globalAlpha = 1;
  return finishTexture(canvas, 2.6, 1.95);
}

function makeRoadTexture() {
  const canvas = makeCanvas();
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  broadFields(ctx, {
    seed: 51000,
    palette: ['#dedfdd', '#ffffff', '#e8e7e2', '#d8dcdb'],
    count: 46,
    minAlpha: 0.035,
    maxAlpha: 0.095,
    minRadius: 34,
    maxRadius: 120
  });
  broadSlabs(ctx, {
    seed: 52000,
    palette: ['#d3d5d4', '#ffffff', '#e4e1db'],
    count: 10,
    minAlpha: 0.025,
    maxAlpha: 0.065
  });

  const wheelBands = [0.27, 0.36, 0.64, 0.73];
  for (let index = 0; index < wheelBands.length; index += 1) {
    const x = wheelBands[index] * canvas.width;
    const width = 8 + (index % 2) * 6;
    ctx.globalAlpha = index % 2 ? 0.025 : 0.018;
    ctx.fillStyle = '#cbd0cf';
    ctx.fillRect(x - width / 2, 0, width, canvas.height);
  }

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#d1d4d2';
  for (let index = 0; index < 28; index += 1) {
    const x = pseudo(53000 + index) * canvas.width;
    const y = pseudo(54000 + index) * canvas.height;
    const length = 18 + pseudo(55000 + index) * 58;
    ctx.globalAlpha = 0.018 + pseudo(56000 + index) * 0.028;
    ctx.lineWidth = 1 + pseudo(57000 + index) * 1.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (pseudo(58000 + index) - 0.5) * 12, y + length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return finishTexture(canvas, 1, 5.4);
}

function textureFor(key) {
  if (textureCache.has(key)) return textureCache.get(key);
  const factories = {
    'airport-grass': makeAirportGrassTexture,
    'airport-concrete': makeAirportConcreteTexture,
    'harbor-land': makeHarborLandTexture,
    'harbor-concrete': makeHarborConcreteTexture,
    road: makeRoadTexture
  };
  const factory = factories[key];
  if (!factory) return null;
  const texture = factory();
  textureCache.set(key, texture);
  return texture;
}

function materialList(material) {
  return Array.isArray(material) ? material : [material];
}

function materialHex(material) {
  const first = materialList(material).find((entry) => entry?.color);
  return first?.color?.getHex?.() ?? null;
}

function nearly(value, expected, epsilon = 0.5) {
  return Math.abs(Number(value) - expected) <= epsilon;
}

function groundTargetFor(mesh, trackId) {
  const parameters = mesh?.geometry?.parameters;
  if (!mesh?.isMesh || mesh.isInstancedMesh || mesh.geometry?.type !== 'PlaneGeometry' || !parameters) return null;
  const color = materialHex(mesh.material);
  return (GROUND_TARGETS[trackId] || []).find((target) => (
    nearly(parameters.width, target.width)
    && nearly(parameters.height, target.height)
    && color === target.color
  )) || null;
}

function applyGroundTextures(world, trackId) {
  if (!GROUND_TRACKS.has(trackId)) return 0;
  let count = 0;
  world.traverse((node) => {
    const target = groundTargetFor(node, trackId);
    if (!target || node.userData?.turnProceduralGround === REVISION) return;
    const texture = textureFor(target.texture);
    if (!texture) return;

    const materials = materialList(node.material).map((source) => {
      const styled = source.clone();
      styled.map = texture;
      styled.roughness = 1;
      styled.metalness = 0;
      styled.needsUpdate = true;
      return styled;
    });
    node.material = Array.isArray(node.material) ? materials : materials[0];
    node.userData.turnProceduralGround = REVISION;
    node.userData.turnProceduralGroundTexture = target.texture;
    count += 1;
  });
  return count;
}

function roadMesh(world, sampleCount) {
  const expectedVertices = (sampleCount + 1) * 2;
  let match = null;
  world.traverse((node) => {
    if (match || !node?.isMesh || node.isInstancedMesh) return;
    const position = node.geometry?.getAttribute?.('position');
    const color = node.geometry?.getAttribute?.('color');
    if (!position || !color || position.count !== expectedVertices || color.count !== expectedVertices) return;
    const materials = materialList(node.material);
    if (!materials.some((entry) => entry?.vertexColors)) return;
    match = node;
  });
  return match;
}

export function createRoadUvArray(sampleCount) {
  const rowCount = Math.max(0, Number(sampleCount) || 0) + 1;
  const values = new Float32Array(rowCount * 4);
  const denominator = Math.max(1, rowCount - 1);
  for (let row = 0; row < rowCount; row += 1) {
    const offset = row * 4;
    const v = row / denominator;
    values[offset] = 0;
    values[offset + 1] = v;
    values[offset + 2] = 1;
    values[offset + 3] = v;
  }
  return values;
}

function applyRoadTexture(world, trackId, samples) {
  if (!ROAD_TRACKS.has(trackId) || !Array.isArray(samples) || samples.length < 2) return false;
  const road = roadMesh(world, samples.length);
  if (!road || road.userData?.turnProceduralRoad === REVISION) return Boolean(road);

  if (!road.geometry.getAttribute('uv')) {
    road.geometry.setAttribute('uv', new THREE.Float32BufferAttribute(createRoadUvArray(samples.length), 2));
  }

  const texture = textureFor('road');
  const materials = materialList(road.material).map((source) => {
    const styled = source.clone();
    styled.map = texture;
    styled.roughness = Math.max(styled.roughness ?? 0.98, 0.96);
    styled.metalness = 0;
    styled.needsUpdate = true;
    return styled;
  });
  road.material = Array.isArray(road.material) ? materials : materials[0];
  road.userData.turnProceduralRoad = REVISION;
  road.userData.turnProceduralRoadTexture = 'broad-fields-wheel-wear';
  return true;
}

export function applyProceduralSurfacePolish(world, trackId, {
  samples = []
} = {}) {
  if (!world || !PROCEDURAL_SURFACE_PLAN[trackId]) return false;
  const groundMeshes = applyGroundTextures(world, trackId);
  const road = applyRoadTexture(world, trackId, samples);
  world.userData.turnProceduralSurfacePolish = REVISION;
  world.userData.turnProceduralSurfaceGroundMeshes = groundMeshes;
  world.userData.turnProceduralSurfaceRoad = road;
  return groundMeshes > 0 || road;
}

function polishRuntime(runtime, fallbackTrackId = '') {
  if (!runtime) return;
  const trackId = currentTrackId(runtime, fallbackTrackId);
  const world = activeWorld(runtime, trackId);
  applyProceduralSurfacePolish(world, trackId, {
    samples: runtime.samples || []
  });
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
