const TELEMETRY_API_VERSION = 3;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_EVENTS_PER_REQUEST = 8;
const STATS_KEY_SHA256 = '18379b62d01eb7c33cf5bc56a9076268425a43eb17797a9bb4129306044c9803';
const TELEMETRY_EVENTS = new Set([
  'play_session',
  'race_start',
  'lap_complete',
  'lap_invalid',
  'drift_score',
  'flow_score'
]);
const SCORE_EVENTS = new Set(['drift_score', 'flow_score']);
const SCORE_BAND_SIZE = 500;
const STATS_AUDIENCES = new Set(['players', 'all', 'developer']);
const ALLOWED_ORIGINS = new Set([
  'https://enkel.design',
  'https://www.enkel.design'
]);
const initializedDatabases = new WeakSet();

class TelemetryError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'TelemetryError';
    this.status = status;
    this.code = code;
  }
}

export function isTelemetryRoute(path) {
  return path === '/v1/telemetry' || path === '/v1/stats';
}

export async function handleTelemetryRoute(request, env = {}, ctx = null) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  try {
    if (request.method === 'OPTIONS' && isTelemetryRoute(path)) {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    if (path === '/v1/telemetry' && request.method === 'POST') {
      requireAllowedOrigin(request);
      const body = await readJsonBody(request);
      const sourceEvents = Array.isArray(body?.events) ? body.events : [];
      if (!sourceEvents.length || sourceEvents.length > MAX_EVENTS_PER_REQUEST) {
        throw new TelemetryError(400, 'invalid_events', `Send between 1 and ${MAX_EVENTS_PER_REQUEST} telemetry events.`);
      }
      const events = sourceEvents.map(normalizeTelemetryEvent);
      const work = recordTelemetryEvents(env, events);
      if (ctx?.waitUntil) ctx.waitUntil(work);
      else await work;
      return jsonResponse({ ok: true, accepted: events.length }, 202, request);
    }

    if (path === '/v1/stats' && request.method === 'GET') {
      requireAllowedOrigin(request, { allowMissing: true });
      await requireStatsKey(request);
      const days = normalizeDays(url.searchParams.get('days'));
      const audience = normalizeAudience(url.searchParams.get('audience'));
      const stats = await loadStats(env.DB, days, audience);
      return jsonResponse(stats, 200, request);
    }

    if (isTelemetryRoute(path)) {
      throw new TelemetryError(405, 'method_not_allowed', 'This analytics endpoint does not support that method.');
    }
    return null;
  } catch (error) {
    if (error instanceof TelemetryError) {
      return jsonResponse({ error: error.code, message: error.message }, error.status, request);
    }
    console.error('TURN telemetry Worker error', error);
    return jsonResponse({
      error: 'telemetry_unavailable',
      message: 'TURN usage statistics are temporarily unavailable.'
    }, 500, request);
  }
}

async function recordTelemetryEvents(env, events) {
  await ensureTelemetrySchema(env.DB);
  for (const event of events) {
    const sessionHash = await sha256Hex(event.session);
    try {
      env.ANALYTICS?.writeDataPoint?.({
        indexes: [sessionHash],
        blobs: [
          event.event,
          event.surface,
          event.trackId,
          event.carId,
          event.steering,
          event.build,
          event.reason
        ],
        doubles: [
          event.value,
          event.installed ? 1 : 0,
          event.driveByEar ? 1 : 0,
          event.blank ? 1 : 0,
          event.developer ? 1 : 0
        ]
      });
    } catch (error) {
      console.warn('TURN telemetry Analytics Engine write failed', error);
    }
    await upsertAggregate(env.DB, event);
    if (SCORE_EVENTS.has(event.event)) await upsertScoreAggregate(env.DB, event);
  }
}

async function upsertAggregate(db, event) {
  const day = new Date(event.occurredAt).toISOString().slice(0, 10);
  await db.prepare(`
    INSERT INTO turn_telemetry_daily_v2 (
      day, event, surface, track_id, car_id, steering,
      installed, drive_by_ear, blank_screen, developer,
      count, value_sum, last_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, ?11, ?12)
    ON CONFLICT (
      day, event, surface, track_id, car_id, steering,
      installed, drive_by_ear, blank_screen, developer
    ) DO UPDATE SET
      count = count + 1,
      value_sum = value_sum + excluded.value_sum,
      last_at = MAX(last_at, excluded.last_at)
  `).bind(
    day,
    event.event,
    event.surface,
    event.trackId,
    event.carId,
    event.steering,
    event.installed ? 1 : 0,
    event.driveByEar ? 1 : 0,
    event.blank ? 1 : 0,
    event.developer ? 1 : 0,
    event.value,
    event.occurredAt
  ).run();
}

async function upsertScoreAggregate(db, event) {
  const day = new Date(event.occurredAt).toISOString().slice(0, 10);
  const scoreBand = Math.floor(event.value / SCORE_BAND_SIZE) * SCORE_BAND_SIZE;
  await db.prepare(`
    INSERT INTO turn_score_daily_v1 (
      day, event, track_id, developer, score_band,
      count, value_sum, value_min, value_max, last_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?6, ?6, ?7)
    ON CONFLICT (day, event, track_id, developer, score_band)
    DO UPDATE SET
      count = count + 1,
      value_sum = value_sum + excluded.value_sum,
      value_min = MIN(value_min, excluded.value_min),
      value_max = MAX(value_max, excluded.value_max),
      last_at = MAX(last_at, excluded.last_at)
  `).bind(
    day,
    event.event,
    event.trackId,
    event.developer ? 1 : 0,
    scoreBand,
    event.value,
    event.occurredAt
  ).run();
}

async function loadStats(db, days, audience) {
  await ensureTelemetrySchema(db);
  const sinceDay = utcDay(Date.now() - (days - 1) * 86_400_000);
  const source = statsSource(audience);
  const [
    totalsRows,
    trackRows,
    carRows,
    surfaceRows,
    steeringRows,
    installedRows,
    driveByEarRows,
    blankRows,
    lapTimeRows,
    scoreRows,
    lastRow
  ] = await Promise.all([
    allRows(db.prepare(`
      SELECT event, SUM(count) AS count, SUM(value_sum) AS value_sum
      FROM ${source}
      WHERE day >= ?1
      GROUP BY event
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT track_id AS id, SUM(count) AS count
      FROM ${source}
      WHERE day >= ?1 AND event = 'race_start' AND track_id <> ''
      GROUP BY track_id ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT car_id AS id, SUM(count) AS count
      FROM ${source}
      WHERE day >= ?1 AND event = 'race_start' AND car_id <> ''
      GROUP BY car_id ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT surface AS id, SUM(count) AS count
      FROM ${source}
      WHERE day >= ?1 AND event = 'play_session'
      GROUP BY surface ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT steering AS id, SUM(count) AS count
      FROM ${source}
      WHERE day >= ?1 AND event = 'race_start' AND steering <> ''
      GROUP BY steering ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT installed AS id, SUM(count) AS count
      FROM ${source}
      WHERE day >= ?1 AND event = 'race_start'
      GROUP BY installed ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT drive_by_ear AS id, SUM(count) AS count
      FROM ${source}
      WHERE day >= ?1 AND event = 'race_start'
      GROUP BY drive_by_ear ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT blank_screen AS id, SUM(count) AS count
      FROM ${source}
      WHERE day >= ?1 AND event = 'lap_complete'
      GROUP BY blank_screen ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT track_id AS id, SUM(count) AS count, SUM(value_sum) AS value_sum
      FROM ${source}
      WHERE day >= ?1 AND event = 'lap_complete' AND track_id <> ''
      GROUP BY track_id ORDER BY count DESC
    `).bind(sinceDay)),
    allRows(db.prepare(`
      SELECT event, track_id AS id, score_band,
        SUM(count) AS count, SUM(value_sum) AS value_sum,
        MIN(value_min) AS value_min, MAX(value_max) AS value_max
      FROM ${scoreStatsSource(audience)}
      WHERE day >= ?1 AND track_id <> ''
      GROUP BY event, track_id, score_band
      ORDER BY event, track_id, score_band
    `).bind(sinceDay)),
    db.prepare(`SELECT MAX(last_at) AS last_at FROM ${source} WHERE day >= ?1`).bind(sinceDay).first()
  ]);

  const totals = Object.fromEntries(totalsRows.map((row) => [
    String(row.event || ''),
    Number(row.count) || 0
  ]));
  return {
    version: TELEMETRY_API_VERSION,
    rangeDays: days,
    audience,
    includesLegacyUnseparatedStats: audience === 'all',
    sinceDay,
    generatedAt: Date.now(),
    lastActivityAt: Number(lastRow?.last_at) || 0,
    totals: {
      playSessions: totals.play_session || 0,
      races: totals.race_start || 0,
      laps: totals.lap_complete || 0,
      voidLaps: totals.lap_invalid || 0
    },
    tracks: normalizeCountRows(trackRows),
    cars: normalizeCountRows(carRows),
    surfaces: normalizeCountRows(surfaceRows),
    steering: normalizeCountRows(steeringRows),
    installed: normalizeCountRows(installedRows),
    driveByEar: normalizeCountRows(driveByEarRows),
    blankScreen: normalizeCountRows(blankRows),
    lapTimes: lapTimeRows.map((row) => ({
      id: String(row.id || ''),
      count: Number(row.count) || 0,
      average: Number(row.count) > 0 ? (Number(row.value_sum) || 0) / Number(row.count) : 0
    })),
    scoreDistributions: normalizeScoreDistributions(scoreRows)
  };
}

function scoreStatsSource(audience) {
  const source = 'turn_score_daily_v1';
  if (audience === 'developer') return `(SELECT * FROM ${source} WHERE developer = 1)`;
  if (audience === 'players') return `(SELECT * FROM ${source} WHERE developer = 0)`;
  return source;
}

function normalizeScoreDistributions(rows) {
  const channels = { drift: new Map(), flow: new Map() };
  for (const row of rows) {
    const channel = row.event === 'flow_score' ? 'flow' : row.event === 'drift_score' ? 'drift' : '';
    const trackId = String(row.id || '');
    if (!channel || !trackId) continue;
    let entry = channels[channel].get(trackId);
    if (!entry) {
      entry = { id: trackId, count: 0, valueSum: 0, minimum: Infinity, maximum: 0, buckets: [] };
      channels[channel].set(trackId, entry);
    }
    const count = Number(row.count) || 0;
    entry.count += count;
    entry.valueSum += Number(row.value_sum) || 0;
    entry.minimum = Math.min(entry.minimum, Number(row.value_min) || 0);
    entry.maximum = Math.max(entry.maximum, Number(row.value_max) || 0);
    entry.buckets.push({ floor: Number(row.score_band) || 0, count });
  }
  return Object.fromEntries(Object.entries(channels).map(([channel, entries]) => [
    channel,
    [...entries.values()].map((entry) => ({
      id: entry.id,
      count: entry.count,
      average: entry.count ? entry.valueSum / entry.count : 0,
      minimum: Number.isFinite(entry.minimum) ? entry.minimum : 0,
      maximum: entry.maximum,
      buckets: entry.buckets
    }))
  ]));
}

function statsSource(audience) {
  const columns = [
    'day', 'event', 'surface', 'track_id', 'car_id', 'steering',
    'installed', 'drive_by_ear', 'blank_screen', 'count', 'value_sum', 'last_at'
  ].join(', ');
  if (audience === 'developer') {
    return `(SELECT ${columns} FROM turn_telemetry_daily_v2 WHERE developer = 1)`;
  }
  if (audience === 'players') {
    return `(SELECT ${columns} FROM turn_telemetry_daily_v2 WHERE developer = 0)`;
  }
  return `(
    SELECT ${columns} FROM turn_telemetry_daily
    UNION ALL
    SELECT ${columns} FROM turn_telemetry_daily_v2
  )`;
}

function normalizeTelemetryEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TelemetryError(400, 'invalid_event', 'Telemetry events must be objects.');
  }
  const event = String(value.event || '').trim();
  if (!TELEMETRY_EVENTS.has(event)) {
    throw new TelemetryError(400, 'invalid_event', 'Telemetry event type is not supported.');
  }
  const session = String(value.session || '').trim();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(session)) {
    throw new TelemetryError(400, 'invalid_session', 'Telemetry session identifier is invalid.');
  }
  const surface = value.surface === 'yourturn' ? 'yourturn' : 'turn';
  return Object.freeze({
    event,
    session,
    surface,
    build: safeToken(value.build, 48),
    trackId: safeToken(value.trackId, 48),
    carId: safeToken(value.carId, 48),
    steering: ['motion', 'manual', 'unknown'].includes(value.steering) ? value.steering : 'unknown',
    reason: safeToken(value.reason, 48),
    installed: Boolean(value.installed),
    driveByEar: Boolean(value.driveByEar),
    blank: Boolean(value.blank),
    developer: Boolean(value.developer),
    value: finiteNumber(value.value, 0, SCORE_EVENTS.has(event) ? 10_000_000 : 600),
    occurredAt: finiteInteger(value.occurredAt, Date.now() - 86_400_000, Date.now() + 300_000, Date.now())
  });
}

async function ensureTelemetrySchema(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new TelemetryError(503, 'database_unavailable', 'TURN statistics storage is not connected.');
  }
  if (initializedDatabases.has(db)) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS turn_telemetry_daily (
      day TEXT NOT NULL,
      event TEXT NOT NULL,
      surface TEXT NOT NULL,
      track_id TEXT NOT NULL,
      car_id TEXT NOT NULL,
      steering TEXT NOT NULL,
      installed INTEGER NOT NULL,
      drive_by_ear INTEGER NOT NULL,
      blank_screen INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      value_sum REAL NOT NULL DEFAULT 0,
      last_at INTEGER NOT NULL,
      PRIMARY KEY (
        day, event, surface, track_id, car_id, steering,
        installed, drive_by_ear, blank_screen
      )
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS turn_telemetry_daily_v2 (
      day TEXT NOT NULL,
      event TEXT NOT NULL,
      surface TEXT NOT NULL,
      track_id TEXT NOT NULL,
      car_id TEXT NOT NULL,
      steering TEXT NOT NULL,
      installed INTEGER NOT NULL,
      drive_by_ear INTEGER NOT NULL,
      blank_screen INTEGER NOT NULL,
      developer INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      value_sum REAL NOT NULL DEFAULT 0,
      last_at INTEGER NOT NULL,
      PRIMARY KEY (
        day, event, surface, track_id, car_id, steering,
        installed, drive_by_ear, blank_screen, developer
      )
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS turn_score_daily_v1 (
      day TEXT NOT NULL,
      event TEXT NOT NULL,
      track_id TEXT NOT NULL,
      developer INTEGER NOT NULL,
      score_band INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      value_sum REAL NOT NULL DEFAULT 0,
      value_min REAL NOT NULL DEFAULT 0,
      value_max REAL NOT NULL DEFAULT 0,
      last_at INTEGER NOT NULL,
      PRIMARY KEY (day, event, track_id, developer, score_band)
    )
  `).run();
  initializedDatabases.add(db);
}

async function requireStatsKey(request) {
  const authorization = request.headers.get('Authorization') || '';
  const key = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!key || key.length > 160) {
    throw new TelemetryError(401, 'stats_unauthorized', 'A private TURN stats key is required.');
  }
  const provided = await sha256Hex(key);
  if (!constantTimeEqual(provided, STATS_KEY_SHA256)) {
    throw new TelemetryError(401, 'stats_unauthorized', 'The TURN stats key is not valid.');
  }
}

function requireAllowedOrigin(request, { allowMissing = false } = {}) {
  const origin = request.headers.get('Origin') || '';
  if (!origin && allowMissing) return;
  if (!ALLOWED_ORIGINS.has(origin)) {
    throw new TelemetryError(403, 'origin_not_allowed', 'TURN analytics are only accepted from enkel.design.');
  }
}

async function readJsonBody(request) {
  const text = await readTextWithLimit(request, MAX_BODY_BYTES);
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new TelemetryError(400, 'invalid_json', 'Analytics payload must be valid JSON.');
  }
}

async function readTextWithLimit(request, limit) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > limit) {
    throw new TelemetryError(413, 'payload_too_large', 'Analytics payload is too large.');
  }
  if (!request.body?.getReader) {
    const text = await request.text();
    if (byteLength(text) > limit) throw new TelemetryError(413, 'payload_too_large', 'Analytics payload is too large.');
    return text;
  }
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      try { await reader.cancel(); } catch (_) {}
      throw new TelemetryError(413, 'payload_too_large', 'Analytics payload is too large.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function allRows(statement) {
  const result = await statement.all();
  return Array.isArray(result?.results) ? result.results : [];
}

function normalizeCountRows(rows) {
  return rows.map((row) => ({ id: String(row.id ?? ''), count: Number(row.count) || 0 }));
}

function normalizeDays(value) {
  const days = Math.round(Number(value) || 30);
  if ([1, 7, 30, 90, 3650].includes(days)) return days;
  return 30;
}

function normalizeAudience(value) {
  const audience = String(value || 'all').trim().toLowerCase();
  return STATS_AUDIENCES.has(audience) ? audience : 'all';
}

function utcDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function safeToken(value, maxLength) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, maxLength);
}

function finiteNumber(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 0;
}

function finiteInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return mismatch === 0;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(String(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function byteLength(value) {
  return new TextEncoder().encode(String(value)).byteLength;
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin) ? origin : 'https://enkel.design';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
