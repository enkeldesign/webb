import * as THREE from 'three';

const SUPERCAR_ID = 'toy-racer';
const BUNDLE_FILE = 'supercar.compact.gz.b64';
const COMPACT_MAGIC = 'TRVC';
const POSITION_QUANTIZATION_MAX = 127;
const PRIMARY_PAINT_MATERIAL = 'car';

let bundlePromise = null;
let sourcePromise = null;

export function isSupercar(carId) {
  return String(carId || '') === SUPERCAR_ID;
}

export function getSupercarPrimaryPaintMaterial(carId) {
  return isSupercar(carId) ? PRIMARY_PAINT_MATERIAL : null;
}

export function getSupercarModelYawQuarterTurns(carId, fallback = 0) {
  return isSupercar(carId) ? 0 : fallback;
}

export async function loadSupercarSource({ carId, buildKey = '' } = {}) {
  if (!isSupercar(carId)) throw new Error(`Unknown TURN Supercar id: ${carId}`);
  if (typeof globalThis.DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is unavailable');
  }

  if (!sourcePromise) {
    sourcePromise = loadBundle(buildKey)
      .then((bundle) => createModelGroup(bundle.payload, bundle.meta.models?.[SUPERCAR_ID]))
      .catch((error) => {
        sourcePromise = null;
        throw error;
      });
  }
  return sourcePromise;
}

async function loadBundle(buildKey) {
  if (!bundlePromise) {
    bundlePromise = fetchBundle(buildKey)
      .then(decodeBase64)
      .then(decompressGzip)
      .then(parseCompactBundle)
      .catch((error) => {
        bundlePromise = null;
        throw error;
      });
  }
  return bundlePromise;
}

async function fetchBundle(buildKey) {
  const url = new URL(`../assets/cars/${BUNDLE_FILE}`, import.meta.url);
  if (buildKey) url.searchParams.set('build', buildKey);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Supercar source request failed: ${response.status}`);
  return (await response.text()).replace(/\s+/g, '');
}

function decodeBase64(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function decompressGzip(compressed) {
  const stream = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseCompactBundle(bytes) {
  if (bytes.length < 8) throw new Error('Supercar bundle is truncated');
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== COMPACT_MAGIC) throw new Error('Supercar bundle has invalid magic');
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0, true);
  const headerEnd = 8 + headerLength;
  if (headerEnd > bytes.length) throw new Error('Supercar bundle header is truncated');
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(8, headerEnd)));
  if (meta.version !== 2 || meta.bits !== 8) throw new Error('Unsupported Supercar bundle version');
  return { meta, payload: bytes.subarray(headerEnd) };
}

function createModelGroup(payload, model) {
  if (!model) throw new Error('Supercar bundle is missing toy-racer');
  const group = new THREE.Group();
  group.name = 'TURN Supercar';
  const positions = decodePositions(payload, model);

  for (const record of model.materials || []) {
    const indices = decodeIndices(payload, record);
    if (!indices.length) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(...record.color),
      roughness: 0.82,
      metalness: 0,
      flatShading: true
    });
    material.name = record.name;

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `Supercar-${record.name}`;
    group.add(mesh);
  }

  group.userData.turnSource = 'A_R7 CC0';
  group.userData.turnPrimaryPaintMaterial = PRIMARY_PAINT_MATERIAL;
  return group;
}

function decodePositions(payload, model) {
  const positions = new Float32Array(model.positionCount * 3);
  const end = model.positionOffset + model.positionLength;
  let cursor = model.positionOffset;
  const previous = [0, 0, 0];

  for (let vertex = 0; vertex < model.positionCount; vertex += 1) {
    for (let axis = 0; axis < 3; axis += 1) {
      const decoded = readSignedVarint(payload, cursor, end);
      cursor = decoded.cursor;
      previous[axis] += decoded.value;
      positions[vertex * 3 + axis] = model.center[axis]
        + (previous[axis] / POSITION_QUANTIZATION_MAX) * model.half[axis];
    }
  }

  if (cursor !== end) throw new Error('Supercar position stream length mismatch');
  return positions;
}

function decodeIndices(payload, record) {
  const indices = new Uint16Array(record.indexCount);
  const end = record.indexOffset + record.indexLength;
  let cursor = record.indexOffset;
  let previous = 0;

  for (let index = 0; index < record.indexCount; index += 1) {
    const decoded = readSignedVarint(payload, cursor, end);
    cursor = decoded.cursor;
    previous += decoded.value;
    if (previous < 0 || previous > 65535) throw new Error('Supercar index is out of range');
    indices[index] = previous;
  }

  if (cursor !== end) throw new Error('Supercar index stream length mismatch');
  return indices;
}

function readSignedVarint(bytes, start, end) {
  let cursor = start;
  let value = 0;
  let shift = 0;

  while (cursor < end && shift <= 28) {
    const byte = bytes[cursor++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value: (value >>> 1) ^ -(value & 1), cursor };
    }
    shift += 7;
  }

  throw new Error('Invalid Supercar varint stream');
}
