import assert from 'node:assert/strict';
import test from 'node:test';
import { handleTelemetryRoute } from '../src/telemetry.js';

const ORIGIN = 'https://enkel.design';

class FakeAnalytics {
  constructor() {
    this.points = [];
  }

  writeDataPoint(point) {
    this.points.push(structuredClone(point));
  }
}

class FakeD1 {
  constructor() {
    this.rows = new Map();
  }

  prepare(sql) {
    return new FakeStatement(this, sql);
  }
}

class FakeStatement {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, ' ').trim();
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async run() {
    if (this.sql.startsWith('CREATE TABLE IF NOT EXISTS turn_telemetry_daily')) {
      return { success: true, meta: { changes: 0 } };
    }
    if (this.sql.startsWith('INSERT INTO turn_telemetry_daily_v2')) {
      const [day, event, surface, trackId, carId, steering, installed, driveByEar, blank, developer, value, lastAt] = this.values;
      const key = [day, event, surface, trackId, carId, steering, installed, driveByEar, blank, developer].join('|');
      const existing = this.db.rows.get(key) || { count: 0, value_sum: 0, last_at: 0 };
      this.db.rows.set(key, {
        day,
        event,
        surface,
        track_id: trackId,
        car_id: carId,
        steering,
        installed,
        drive_by_ear: driveByEar,
        blank_screen: blank,
        developer,
        count: existing.count + 1,
        value_sum: existing.value_sum + value,
        last_at: Math.max(existing.last_at, lastAt)
      });
      return { success: true, meta: { changes: 1 } };
    }
    throw new Error(`Unexpected D1 run query: ${this.sql}`);
  }
}

function event(overrides = {}) {
  return {
    event: 'race_start',
    session: 'pX1qLd4t3sVfG8jK2mN7rQ',
    surface: 'turn',
    build: '2026.08.08-r162',
    trackId: 'countryside',
    carId: 'classic',
    steering: 'motion',
    installed: true,
    driveByEar: true,
    blank: false,
    developer: false,
    occurredAt: Date.now(),
    value: 0,
    reason: '',
    ...overrides
  };
}

function post(events, origin = ORIGIN) {
  return new Request('https://turn-challenges.example/v1/telemetry', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'text/plain;charset=UTF-8'
    },
    body: JSON.stringify({ events })
  });
}

await test('accepts a small gameplay batch and writes cohort aggregate plus Analytics Engine point', async () => {
  const DB = new FakeD1();
  const ANALYTICS = new FakeAnalytics();
  const response = await handleTelemetryRoute(post([
    event({ event: 'play_session' }),
    event({ event: 'race_start' }),
    event({ event: 'lap_complete', value: 16.388 })
  ]), { DB, ANALYTICS });

  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, accepted: 3 });
  assert.equal(DB.rows.size, 3);
  assert.equal(ANALYTICS.points.length, 3);

  const point = ANALYTICS.points[1];
  assert.equal(point.blobs[0], 'race_start');
  assert.equal(point.blobs[1], 'turn');
  assert.equal(point.blobs[2], 'countryside');
  assert.equal(point.blobs[3], 'classic');
  assert.equal(point.blobs[4], 'motion');
  assert.equal(point.doubles[4], 0);
  assert.match(point.indexes[0], /^[a-f0-9]{64}$/);
  assert.notEqual(point.indexes[0], event().session, 'The ephemeral page-session ID must be hashed before Analytics Engine');
  assert.equal(JSON.stringify(point).includes('ERIK'), false);
  assert.equal(JSON.stringify(point).includes('challenge'), false);
});

await test('aggregates repeated player events without keeping page-session identifiers in D1', async () => {
  const DB = new FakeD1();
  const ANALYTICS = new FakeAnalytics();
  const first = event({ event: 'race_start' });
  const second = event({ event: 'race_start', session: 'zT8mQ2pR6vN4cK7sL1xF5B' });
  await handleTelemetryRoute(post([first, second]), { DB, ANALYTICS });

  assert.equal(DB.rows.size, 1);
  const [row] = DB.rows.values();
  assert.equal(row.count, 2);
  assert.equal(row.developer, 0);
  assert.equal(Object.hasOwn(row, 'session'), false);
  assert.equal(Object.hasOwn(row, 'session_hash'), false);
});

await test('keeps developer and player activity in separate daily aggregates', async () => {
  const DB = new FakeD1();
  const ANALYTICS = new FakeAnalytics();
  await handleTelemetryRoute(post([
    event({ event: 'race_start', developer: false }),
    event({ event: 'race_start', session: 'zT8mQ2pR6vN4cK7sL1xF5B', developer: true })
  ]), { DB, ANALYTICS });

  assert.equal(DB.rows.size, 2);
  const cohorts = [...DB.rows.values()].map((row) => row.developer).sort();
  assert.deepEqual(cohorts, [0, 1]);
  assert.equal(ANALYTICS.points[0].doubles[4], 0);
  assert.equal(ANALYTICS.points[1].doubles[4], 1);
});

await test('rejects telemetry writes outside enkel.design', async () => {
  const response = await handleTelemetryRoute(post([event()], 'https://example.com'), {
    DB: new FakeD1(),
    ANALYTICS: new FakeAnalytics()
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'origin_not_allowed');
});

await test('keeps the private stats endpoint closed without a dashboard key', async () => {
  const response = await handleTelemetryRoute(new Request(
    'https://turn-challenges.example/v1/stats?days=30&audience=players',
    { headers: { Origin: ORIGIN } }
  ), { DB: new FakeD1() });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).error, 'stats_unauthorized');
});

await test('rejects unsupported telemetry dimensions and event types rather than storing arbitrary data', async () => {
  const response = await handleTelemetryRoute(post([
    event({ event: 'player_name', name: 'ERIK', challengeId: 'secret' })
  ]), { DB: new FakeD1(), ANALYTICS: new FakeAnalytics() });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_event');
});
