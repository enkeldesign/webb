import * as THREE from 'three';

const RGSDEV_BUNDLE_PART_COUNT = 9;
const RGSDEV_BUNDLE_PART_PREFIX = 'rgsdev-vehicles.compact.gz.b64.';
const COMPACT_MAGIC = 'TRVC';
const POSITION_QUANTIZATION_MAX = 127;

export const RGSDEV_CAR_IDS = Object.freeze([
  'convertible',
  'classic',
  'vintage-racer',
  'monster-truck',
  'race',
  'sedan',
  'suv',
  'firetruck',
  'police',
  'ambulance',
  'truck',
  'van'
]);

const RGSDEV_CAR_ID_SET = new Set(RGSDEV_CAR_IDS);

const PRIMARY_PAINT_MATERIAL_BY_ID = Object.freeze({
  convertible: 'body blue',
  classic: 'body dark yellow',
  'vintage-racer': 'body light yellow',
  'monster-truck': 'body light blue',
  race: 'body red',
  sedan: 'body grey',
  suv: 'body dark purple',
  truck: 'body dark green',
  van: 'body dark blue'
});

let bundlePromise = null;

export function isRgsdevCar(carId) {
  return RGSDEV_CAR_ID_SET.has(String(carId || ''));
}

export function getRgsdevPrimaryPaintMaterial(carId) {
  return PRIMARY_PAINT_MATERIAL_BY_ID[String(carId || '')] || null;
}

export function getRgsdevModelYawQuarterTurns(carId, fallback = 0) {
  return isRgsdevCar(carId) ? 0 : fallback;
}

export async function loadRgsdevCarSource({ carId, buildKey = '' }) {
  if (!isRgsdevCar(carId)) throw new Error(`Unknown RGSDev TURN car: ${carId}`);
  if (typeof globalThis.DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is unavailable');
  }

  const bundle = await loadBundle(buildKey);
  const model = bundle.meta.models?.[carId];
  if (!model) throw new Error(`RGSDev bundle is missing ${carId}`);
  return createModelGroup(bundle.payload, model, carId);
}

async function loadBundle(buildKey) {
  if (!bundlePromise) {
    bundlePromise = fetchBundleParts(buildKey)
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

async function fetchBundleParts(buildKey) {
  const urls = Array.from({ length: RGSDEV_BUNDLE_PART_COUNT }, (_, index) => {
    const suffix = String(index).padStart(2, '0');
    const url = new URL(`../assets/cars/${RGSDEV_BUNDLE_PART_PREFIX}${suffix}`, import.meta.url);
    if (buildKey) url.searchParams.set('build', buildKey);
    return url;
  });

  const responses = await Promise.all(urls.map((url) => fetch(url)));
  for (const response of responses) {
    if (!response.ok) throw new Error(`RGSDev vehicle bundle request failed: ${response.status}`);
  }
  const chunks = await Promise.all(responses.map((response) => response.text()));
  return chunks.join('').replace(/\s+/g, '');
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
  if (bytes.length < 8) throw new Error('RGSDev vehicle bundle is truncated');
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== COMPACT_MAGIC) throw new Error('RGSDev vehicle bundle has invalid magic');
  const headerLength = new DataView(bytes.buffer, bytes.byteOffset + 4, 4).getUint32(0, true);
  const headerEnd = 8 + headerLength;
  if (headerEnd > bytes.length) throw new Error('RGSDev vehicle bundle header is truncated');
  const meta = JSON.parse(new TextDecoder().decode(bytes.subarray(8, headerEnd)));
  if (meta.version !== 2 || meta.bits !== 8) throw new Error('Unsupported RGSDev vehicle bundle version');
  return { meta, payload: bytes.subarray(headerEnd) };
}

function createModelGroup(payload, model, carId) {
  const group = new THREE.Group();
  group.name = `RGSDev ${carId}`;
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
    mesh.name = `${carId}-${record.name}`;
    group.add(mesh);
  }

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

  if (cursor !== end) throw new Error('RGSDev position stream length mismatch');
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
    if (previous < 0 || previous > 65535) throw new Error('RGSDev index is out of range');
    indices[index] = previous;
  }

  if (cursor !== end) throw new Error('RGSDev index stream length mismatch');
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

  throw new Error('Invalid RGSDev varint stream');
}
