const API_VERSION = 1;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_ENCODED_BYTES = 48 * 1024;
const MAX_DECODED_BYTES = 256 * 1024;
const MAX_RACERS = 4;
const MIN_FRAMES = 21;
const MAX_FRAMES = 120;
const ID_LENGTH = 12;
const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';
const ID_PATTERN = /^[0123456789abcdefghjkmnpqrstvwxyz]{12}$/;
const ALLOWED_WRITE_ORIGINS = new Set([
  'https://enkel.design',
  'https://www.enkel.design'
]);

const initializedDatabases = new WeakSet();

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};

export async function handleRequest(request, env = {}) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request)
      });
    }

    if (path === '/' && request.method === 'GET') {
      return jsonResponse({
        service: 'turn-challenges',
        version: API_VERSION,
        purpose: 'Immutable YOUR TURN challenge snapshots'
      }, 200, request);
    }

    if (path === '/health' && request.method === 'GET') {
      return jsonResponse({
        ok: true,
        service: 'turn-challenges',
        version: API_VERSION,
        databaseBound: Boolean(env.DB)
      }, 200, request, { 'Cache-Control': 'no-store' });
    }

    if (path === '/v1/challenges' && request.method === 'POST') {
      requireAllowedWriteOrigin(request);
      requireJsonRequest(request);
      const bodyText = await readTextWithLimit(request, MAX_REQUEST_BYTES);
      let body;
      try {
        body = JSON.parse(bodyText);
      } catch (_) {
        throw new ApiError(400, 'invalid_json', 'Request body must be valid JSON.');
      }

      const payload = typeof body?.payload === 'string' ? body.payload.trim() : '';
      await validateEncodedChallenge(payload);
      const saved = await saveSnapshot(env.DB, payload);
      return jsonResponse({
        id: saved.id,
        created: saved.created,
        createdAt: saved.createdAt
      }, saved.created ? 201 : 200, request, {
        'Cache-Control': 'no-store'
      });
    }

    const challengeMatch = path.match(/^\/v1\/challenges\/([0123456789abcdefghjkmnpqrstvwxyz]{12})$/);
    if (challengeMatch && request.method === 'GET') {
      const snapshot = await loadSnapshot(env.DB, challengeMatch[1]);
      if (!snapshot) {
        throw new ApiError(404, 'challenge_not_found', 'Challenge not found.');
      }
      return jsonResponse({
        id: challengeMatch[1],
        payload: snapshot.payload,
        createdAt: snapshot.createdAt
      }, 200, request, {
        'Cache-Control': 'public, max-age=31536000, immutable'
      });
    }

    if (path === '/v1/challenges' || path.startsWith('/v1/challenges/')) {
      throw new ApiError(405, 'method_not_allowed', 'This challenge endpoint does not support that method.');
    }

    throw new ApiError(404, 'not_found', 'Endpoint not found.');
  } catch (error) {
    if (error instanceof ApiError) {
      return jsonResponse({ error: error.code, message: error.message }, error.status, request, {
        'Cache-Control': 'no-store'
      });
    }
    console.error('TURN challenge Worker error', error);
    return jsonResponse({
      error: 'internal_error',
      message: 'The challenge service could not complete the request.'
    }, 500, request, { 'Cache-Control': 'no-store' });
  }
}

export async function validateEncodedChallenge(payload) {
  if (!payload) {
    throw new ApiError(422, 'invalid_challenge', 'A challenge payload is required.');
  }
  if (byteLength(payload) > MAX_ENCODED_BYTES) {
    throw new ApiError(413, 'challenge_too_large', 'Challenge payload is too large.');
  }

  const separator = payload.indexOf('.');
  if (separator <= 0) {
    throw new ApiError(422, 'invalid_challenge', 'Challenge payload has no supported encoding.');
  }

  const encoding = payload.slice(0, separator);
  if (encoding !== 'gz' && encoding !== 'raw') {
    throw new ApiError(422, 'invalid_challenge', 'Challenge payload uses an unsupported encoding.');
  }

  let bytes;
  try {
    bytes = base64UrlToBytes(payload.slice(separator + 1));
  } catch (_) {
    throw new ApiError(422, 'invalid_challenge', 'Challenge payload is not valid base64url data.');
  }

  if (encoding === 'gz') {
    try {
      bytes = await decompressGzipWithLimit(bytes, MAX_DECODED_BYTES);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(422, 'invalid_challenge', 'Challenge payload could not be decompressed.');
    }
  } else if (bytes.byteLength > MAX_DECODED_BYTES) {
    throw new ApiError(413, 'challenge_too_large', 'Decoded challenge payload is too large.');
  }

  let wire;
  try {
    wire = JSON.parse(new TextDecoder().decode(bytes));
  } catch (_) {
    throw new ApiError(422, 'invalid_challenge', 'Challenge payload does not contain valid JSON.');
  }

  if (!isValidWireV2(wire)) {
    throw new ApiError(422, 'invalid_challenge', 'Challenge payload is not a valid YOUR TURN v2 challenge.');
  }
  return true;
}

async function saveSnapshot(db, payload) {
  await ensureSchema(db);
  const hash = await sha256Hex(payload);
  const existing = await db
    .prepare('SELECT id, created_at FROM challenges WHERE payload_sha256 = ?1 LIMIT 1')
    .bind(hash)
    .first();
  if (existing?.id) {
    return {
      id: String(existing.id),
      createdAt: Number(existing.created_at) || 0,
      created: false
    };
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const id = createSnapshotId();
    const createdAt = Date.now();
    try {
      await db
        .prepare('INSERT INTO challenges (id, payload, payload_sha256, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(id, payload, hash, createdAt)
        .run();
      return { id, createdAt, created: true };
    } catch (_) {
      const duplicate = await db
        .prepare('SELECT id, created_at FROM challenges WHERE payload_sha256 = ?1 LIMIT 1')
        .bind(hash)
        .first();
      if (duplicate?.id) {
        return {
          id: String(duplicate.id),
          createdAt: Number(duplicate.created_at) || 0,
          created: false
        };
      }
    }
  }

  throw new ApiError(503, 'id_generation_failed', 'Could not allocate a challenge ID. Try sharing again.');
}

async function loadSnapshot(db, id) {
  if (!ID_PATTERN.test(id)) return null;
  await ensureSchema(db);
  const row = await db
    .prepare('SELECT payload, created_at FROM challenges WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first();
  if (!row?.payload) return null;
  return {
    payload: String(row.payload),
    createdAt: Number(row.created_at) || 0
  };
}

async function ensureSchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new ApiError(503, 'database_unavailable', 'Challenge storage is not connected yet.');
  }
  if (initializedDatabases.has(db)) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS challenges (
      id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      payload_sha256 TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    )
  `).run();
  initializedDatabases.add(db);
}

function requireAllowedWriteOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  if (!ALLOWED_WRITE_ORIGINS.has(origin)) {
    throw new ApiError(403, 'origin_not_allowed', 'Challenge creation is only accepted from TURN on enkel.design.');
  }
}

function requireJsonRequest(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Challenge creation requires application/json.');
  }
}

function isValidWireV2(wire) {
  if (!wire || typeof wire !== 'object' || Array.isArray(wire)) return false;
  if (wire.w !== 2 || wire.v !== 2) return false;
  if (!validIdentifier(wire.id, 64) || !validIdentifier(wire.s, 64)) return false;
  if (!validText(wire.ti, 64) || !validText(wire.c, 64)) return false;
  if (!Number.isInteger(wire.o) || wire.o < 2 || wire.o > 1000) return false;
  if (!Array.isArray(wire.rs) || wire.rs.length < 1 || wire.rs.length > MAX_RACERS) return false;
  if (!wire.rs.every(isValidRacerRow)) return false;
  const racerIds = new Set(wire.rs.map((row) => row[0]));
  if (!racerIds.has(wire.s)) return false;
  if (wire.pc != null && !validHex(wire.pc)) return false;
  if (wire.sc != null && !validHex(wire.sc)) return false;
  return true;
}

function isValidRacerRow(row) {
  if (!Array.isArray(row) || row.length < 5) return false;
  const [id, name, timeMs, frames, order] = row;
  if (!validIdentifier(id, 64)) return false;
  if (!validText(name, 24)) return false;
  if (!Number.isInteger(timeMs) || timeMs <= 5000 || timeMs > 3_600_000) return false;
  if (!Number.isInteger(order) || order < 1 || order > 999) return false;
  if (!Array.isArray(frames) || frames.length < MIN_FRAMES || frames.length > MAX_FRAMES) return false;
  return frames.every((frame) => (
    Array.isArray(frame)
    && frame.length >= 7
    && frame.slice(0, 7).every((value) => Number.isInteger(value) && Number.isSafeInteger(value))
  ));
}

function validIdentifier(value, maxLength) {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= maxLength
    && /^[a-z0-9_-]+$/.test(value);
}

function validText(value, maxLength) {
  return typeof value === 'string'
    && value.trim().length >= 1
    && value.length <= maxLength
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function validHex(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function createSnapshotId() {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  let id = '';
  for (const byte of bytes) id += ID_ALPHABET[byte & 31];
  return id;
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readTextWithLimit(request, limit) {
  const declaredLength = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw new ApiError(413, 'request_too_large', 'Request body is too large.');
  }
  if (!request.body) return '';
  const bytes = await readStreamWithLimit(request.body, limit, 'request_too_large', 'Request body is too large.');
  return new TextDecoder().decode(bytes);
}

async function decompressGzipWithLimit(bytes, limit) {
  const source = new Response(bytes).body;
  if (!source) throw new Error('No decompression source stream.');
  const decompressed = source.pipeThrough(new DecompressionStream('gzip'));
  return readStreamWithLimit(decompressed, limit, 'challenge_too_large', 'Decoded challenge payload is too large.');
}

async function readStreamWithLimit(stream, limit, code, message) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new ApiError(413, code, message);
    }
    chunks.push(value);
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function base64UrlToBytes(value) {
  if (!value || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid base64url.');
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function byteLength(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = ALLOWED_WRITE_ORIGINS.has(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(value, status, request, extraHeaders = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders
    }
  });
}
