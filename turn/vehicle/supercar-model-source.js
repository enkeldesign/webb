import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const SUPERCAR_ID = 'toy-racer';
const BUNDLE_PART_COUNT = 5;
const BUNDLE_PART_PREFIX = 'supercar-fbx.tar.gz.b64.';
const BODY_ENTRY = 'body.fbx';
const COMPONENT_ENTRIES = Object.freeze(['rims-r.fbx', 'rims-l.fbx', 'spoiler.fbx']);
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
      .then(buildSupercarSource)
      .catch((error) => {
        sourcePromise = null;
        throw error;
      });
  }
  return sourcePromise;
}

async function loadBundle(buildKey) {
  if (!bundlePromise) {
    bundlePromise = fetchBundleParts(buildKey)
      .then(decodeBase64)
      .then(decompressGzip)
      .then(parseTarEntries)
      .catch((error) => {
        bundlePromise = null;
        throw error;
      });
  }
  return bundlePromise;
}

async function fetchBundleParts(buildKey) {
  const urls = Array.from({ length: BUNDLE_PART_COUNT }, (_, index) => {
    const suffix = String(index).padStart(2, '0');
    const url = new URL(`../assets/cars/${BUNDLE_PART_PREFIX}${suffix}`, import.meta.url);
    if (buildKey) url.searchParams.set('build', buildKey);
    return url;
  });

  const responses = await Promise.all(urls.map((url) => fetch(url)));
  for (const response of responses) {
    if (!response.ok) throw new Error(`Supercar source request failed: ${response.status}`);
  }
  return (await Promise.all(responses.map((response) => response.text())))
    .join('')
    .replace(/\s+/g, '');
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
    if (!name || !Number.isFinite(size) || size < 0) throw new Error('Invalid Supercar tar header');

    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > bytes.length) throw new Error(`Truncated Supercar tar entry: ${name}`);
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

function buildSupercarSource(entries) {
  const loader = new FBXLoader();
  const bodyBuffer = requireEntry(entries, BODY_ENTRY);
  const body = loader.parse(bodyBuffer, '');
  body.name = 'TURN Supercar body';

  for (const entryName of COMPONENT_ENTRIES) {
    const component = loader.parse(requireEntry(entries, entryName), '');
    component.name = `TURN Supercar ${entryName.replace('.fbx', '')}`;
    body.add(component);
  }

  body.userData.turnSource = 'A_R7 CC0';
  body.userData.turnPrimaryPaintMaterial = PRIMARY_PAINT_MATERIAL;
  return body;
}

function requireEntry(entries, name) {
  const value = entries.get(name);
  if (!value) throw new Error(`Supercar bundle is missing ${name}`);
  return value;
}
