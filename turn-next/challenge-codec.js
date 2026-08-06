const CHALLENGE_SCHEMA_VERSION = 1;
const HASH_KEY = 'challenge';
const MAX_NAME_LENGTH = 24;
const MAX_FRAMES = 900;
const MIN_FRAMES = 21;

export function formatChallengeTime(seconds) {
  if (!Number.isFinite(seconds)) return '--:--.---';
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
  return `${minutes}:${secs}.${ms}`;
}

export function normalizeChallengeName(value, fallback = 'A TURN PLAYER') {
  const clean = String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return clean || fallback;
}

export function challengeFromLap({
  challengerName,
  trackId,
  trackRevision,
  trackName,
  lap,
  replyTo = null
}) {
  const time = Number(lap?.time);
  const frames = downsampleFrames(lap?.frames);
  if (!Number.isFinite(time) || time <= 5 || frames.length < MIN_FRAMES) {
    throw new Error('TURN NEXT can only share a complete valid lap.');
  }

  return normalizeChallenge({
    v: CHALLENGE_SCHEMA_VERSION,
    challengerName,
    trackId,
    trackRevision,
    trackName,
    time,
    carId: lap.carId,
    carColor: lap.carColor,
    carSecondaryColor: lap.carSecondaryColor,
    frames,
    replyTo
  });
}

export function normalizeChallenge(value) {
  const source = value && typeof value === 'object' ? value : {};
  const time = Number(source.time);
  const frames = normalizeFrames(source.frames);
  const trackId = String(source.trackId || '').trim();
  const carId = String(source.carId || '').trim();

  if (Number(source.v) !== CHALLENGE_SCHEMA_VERSION) {
    throw new Error('This challenge uses an unsupported replay version.');
  }
  if (!trackId || !carId || !Number.isFinite(time) || time <= 5 || frames.length < MIN_FRAMES) {
    throw new Error('This challenge is incomplete or damaged.');
  }

  return Object.freeze({
    v: CHALLENGE_SCHEMA_VERSION,
    challengerName: normalizeChallengeName(source.challengerName),
    trackId,
    trackRevision: String(source.trackRevision || ''),
    trackName: String(source.trackName || '').trim(),
    time,
    carId,
    carColor: normalizeHex(source.carColor, '#ffcc00'),
    carSecondaryColor: normalizeHex(source.carSecondaryColor, '#f8f9fa'),
    frames,
    replyTo: normalizeReply(source.replyTo)
  });
}

export async function encodeChallenge(challenge) {
  const normalized = normalizeChallenge(challenge);
  const json = JSON.stringify(normalized);
  const bytes = new TextEncoder().encode(json);

  if (typeof CompressionStream === 'function') {
    try {
      const compressed = await streamBytes(bytes, new CompressionStream('gzip'));
      return `gz.${bytesToBase64Url(compressed)}`;
    } catch (_) {
      // The raw fallback keeps sharing functional in older WebKit builds.
    }
  }

  return `raw.${bytesToBase64Url(bytes)}`;
}

export async function decodeChallenge(encoded) {
  const value = String(encoded || '').trim();
  const separator = value.indexOf('.');
  if (separator <= 0) throw new Error('This challenge link is incomplete.');

  const encoding = value.slice(0, separator);
  let bytes = base64UrlToBytes(value.slice(separator + 1));

  if (encoding === 'gz') {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('This browser cannot open compressed TURN challenges.');
    }
    bytes = await streamBytes(bytes, new DecompressionStream('gzip'));
  } else if (encoding !== 'raw') {
    throw new Error('This challenge link uses an unknown encoding.');
  }

  return normalizeChallenge(JSON.parse(new TextDecoder().decode(bytes)));
}

export function challengeHash(encoded) {
  const params = new URLSearchParams();
  params.set(HASH_KEY, encoded);
  return params.toString();
}

export function encodedChallengeFromLocation(locationRef = globalThis.location) {
  const hash = String(locationRef?.hash || '').replace(/^#/, '');
  return new URLSearchParams(hash).get(HASH_KEY) || '';
}

export function makeChallengeUrl(encoded, {
  baseUrl = 'https://enkel.design/turn-next/',
  reply = '',
  responder = ''
} = {}) {
  const url = new URL(baseUrl);
  if (reply) url.searchParams.set('reply', reply);
  if (responder) url.searchParams.set('responder', normalizeChallengeName(responder));
  url.hash = challengeHash(encoded);
  return url.href;
}

export function makeBuiltInChallengeUrl(challengeId, {
  baseUrl = 'https://enkel.design/turn-next/',
  reply = '',
  responder = ''
} = {}) {
  const url = new URL(baseUrl);
  url.searchParams.set('challenge', String(challengeId || ''));
  if (reply) url.searchParams.set('reply', reply);
  if (responder) url.searchParams.set('responder', normalizeChallengeName(responder));
  return url.href;
}

function normalizeFrames(frames, { limit = MAX_FRAMES } = {}) {
  if (!Array.isArray(frames)) return [];
  const source = Number.isFinite(limit) ? frames.slice(0, limit) : frames;
  return source
    .map((frame) => ({
      t: finite(frame?.t),
      x: finite(frame?.x),
      z: finite(frame?.z),
      h: finite(frame?.h),
      s: finite(frame?.s),
      d: finite(frame?.d),
      p: Number.isFinite(Number(frame?.p)) ? Number(frame.p) : null
    }))
    .filter((frame) => Number.isFinite(frame.t)
      && Number.isFinite(frame.x)
      && Number.isFinite(frame.z)
      && Number.isFinite(frame.h))
    .sort((a, b) => a.t - b.t);
}

function downsampleFrames(frames) {
  const normalized = normalizeFrames(frames, { limit: Infinity });
  if (normalized.length <= MAX_FRAMES) return normalized;
  const stride = Math.ceil(normalized.length / MAX_FRAMES);
  const sampled = normalized.filter((_, index) => index % stride === 0);
  const last = normalized.at(-1);
  if (last && sampled.at(-1) !== last) {
    if (sampled.length >= MAX_FRAMES) sampled[MAX_FRAMES - 1] = last;
    else sampled.push(last);
  }
  return sampled;
}

function normalizeReply(reply) {
  if (!reply || typeof reply !== 'object') return null;
  const kind = reply.kind === 'win' ? 'win' : reply.kind === 'give-up' ? 'give-up' : '';
  if (!kind) return null;
  return Object.freeze({
    kind,
    opponent: normalizeChallengeName(reply.opponent, 'THE CHALLENGER'),
    previousTime: Number.isFinite(Number(reply.previousTime)) ? Number(reply.previousTime) : null
  });
}

function normalizeHex(value, fallback) {
  const clean = String(value || '').toLowerCase();
  return /^#[0-9a-f]{6}$/.test(clean) ? clean : fallback;
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function streamBytes(bytes, stream) {
  const writer = stream.writable.getWriter();
  await writer.write(bytes);
  await writer.close();
  const buffer = await new Response(stream.readable).arrayBuffer();
  return new Uint8Array(buffer);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
