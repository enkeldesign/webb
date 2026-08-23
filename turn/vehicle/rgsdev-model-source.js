const RGSDEV_BUNDLE_PART_COUNT = 7;
const RGSDEV_BUNDLE_PART_PREFIX = 'rgsdev-vehicles.tar.gz.b64.';

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

let bundleEntriesPromise = null;

export function isRgsdevCar(carId) {
  return RGSDEV_CAR_ID_SET.has(String(carId || ''));
}

export function getRgsdevPrimaryPaintMaterial(carId) {
  return PRIMARY_PAINT_MATERIAL_BY_ID[String(carId || '')] || null;
}

export function getRgsdevModelYawQuarterTurns(carId, fallback = 0) {
  return isRgsdevCar(carId) ? 0 : fallback;
}

export async function loadRgsdevCarSource({ carId, loader, buildKey = '' }) {
  if (!isRgsdevCar(carId)) throw new Error(`Unknown RGSDev TURN car: ${carId}`);
  if (typeof globalThis.DecompressionStream !== 'function') {
    throw new Error('DecompressionStream is unavailable');
  }

  const entries = await loadBundleEntries(buildKey);
  const buffer = entries.get(`${carId}.glb`);
  if (!buffer) throw new Error(`RGSDev bundle is missing ${carId}.glb`);
  const gltf = await loader.parseAsync(buffer, '');
  return gltf.scene;
}

async function loadBundleEntries(buildKey) {
  if (!bundleEntriesPromise) {
    bundleEntriesPromise = fetchBundleParts(buildKey)
      .then(decodeBase64)
      .then(decompressGzip)
      .then(parseTarEntries)
      .catch((error) => {
        bundleEntriesPromise = null;
        throw error;
      });
  }
  return bundleEntriesPromise;
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

function parseTarEntries(bytes) {
  const entries = new Map();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;

    const name = readTarString(decoder, header.subarray(0, 100));
    const sizeText = readTarString(decoder, header.subarray(124, 136));
    const size = Number.parseInt(sizeText || '0', 8);
    if (!name || !Number.isFinite(size) || size < 0) throw new Error('Invalid RGSDev vehicle tar header');

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) throw new Error(`Truncated RGSDev vehicle tar entry: ${name}`);
    entries.set(name, bytes.slice(dataStart, dataEnd).buffer);
    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  return entries;
}

function readTarString(decoder, bytes) {
  const zero = bytes.indexOf(0);
  const end = zero >= 0 ? zero : bytes.length;
  return decoder.decode(bytes.subarray(0, end)).trim();
}
