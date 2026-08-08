import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRequest, validateEncodedChallenge } from '../src/index.js';

const ORIGIN = 'https://enkel.design';

class FakeD1 {
  constructor() {
    this.rows = new Map();
    this.byHash = new Map();
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
    if (this.sql.startsWith('CREATE TABLE IF NOT EXISTS challenges')) {
      return { success: true, meta: { changes: 0 } };
    }
    if (this.sql.startsWith('INSERT INTO challenges')) {
      const [id, payload, hash, createdAt] = this.values;
      if (this.db.rows.has(id) || this.db.byHash.has(hash)) {
        throw new Error('UNIQUE constraint failed');
      }
      const row = { id, payload, payload_sha256: hash, created_at: createdAt };
      this.db.rows.set(id, row);
      this.db.byHash.set(hash, row);
      return { success: true, meta: { changes: 1 } };
    }
    throw new Error(`Unexpected D1 run query: ${this.sql}`);
  }

  async first() {
    if (this.sql.includes('WHERE payload_sha256 = ?1')) {
      return this.db.byHash.get(this.values[0]) || null;
    }
    if (this.sql.includes('WHERE id = ?1')) {
      return this.db.rows.get(this.values[0]) || null;
    }
    throw new Error(`Unexpected D1 first query: ${this.sql}`);
  }
}

function wireChallenge() {
  const frames = Array.from({ length: 21 }, (_, index) => [
    index === 0 ? 0 : 800,
    index === 0 ? 0 : 8,
    index === 0 ? 0 : 4,
    index * 10,
    0,
    0,
    index === 0 ? 0 : 50_000
  ]);
  return {
    w: 2,
    v: 2,
    id: 'yt-family-chain',
    s: 'r-erik',
    o: 2,
    ti: 'countryside',
    tr: 'countryside',
    tn: 'Countryside',
    c: 'training-car',
    pc: '#ffcc00',
    sc: '#f8f9fa',
    rs: [['r-erik', 'ERIK', 16_388, frames, 1]],
    r: null
  };
}

function rawPayload(wire = wireChallenge()) {
  return `raw.${Buffer.from(JSON.stringify(wire)).toString('base64url')}`;
}

async function gzipPayload(wire = wireChallenge()) {
  const bytes = new TextEncoder().encode(JSON.stringify(wire));
  const compressed = await new Response(
    new Response(bytes).body.pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer();
  return `gz.${Buffer.from(compressed).toString('base64url')}`;
}

function postRequest(payload, { origin = ORIGIN } = {}) {
  return new Request('https://turn-challenges.example/v1/challenges', {
    method: 'POST',
    headers: {
      Origin: origin,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ payload })
  });
}

const db = new FakeD1();

await test('accepts current raw and gzip YOUR TURN v2 payloads', async () => {
  await assert.doesNotReject(() => validateEncodedChallenge(rawPayload()));
  await assert.doesNotReject(async () => validateEncodedChallenge(await gzipPayload()));
});

await test('stores an immutable snapshot and returns a short opaque ID', async () => {
  const payload = rawPayload();
  const response = await handleRequest(postRequest(payload), { DB: db });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.match(body.id, /^[0123456789abcdefghjkmnpqrstvwxyz]{12}$/);
  assert.equal(body.created, true);

  const read = await handleRequest(
    new Request(`https://turn-challenges.example/v1/challenges/${body.id}`, {
      headers: { Origin: ORIGIN }
    }),
    { DB: db }
  );
  assert.equal(read.status, 200);
  assert.match(read.headers.get('cache-control'), /immutable/);
  const snapshot = await read.json();
  assert.equal(snapshot.payload, payload);
});

await test('deduplicates the exact same immutable snapshot', async () => {
  const payload = await gzipPayload();
  const first = await handleRequest(postRequest(payload), { DB: db });
  assert.equal(first.status, 201);
  const firstBody = await first.json();

  const second = await handleRequest(postRequest(payload), { DB: db });
  assert.equal(second.status, 200);
  const secondBody = await second.json();
  assert.equal(secondBody.id, firstBody.id);
  assert.equal(secondBody.created, false);
});

await test('rejects browser writes from outside enkel.design', async () => {
  const response = await handleRequest(postRequest(rawPayload(), { origin: 'https://example.com' }), { DB: db });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error, 'origin_not_allowed');
});

await test('rejects damaged or structurally invalid challenges', async () => {
  const damaged = wireChallenge();
  damaged.rs[0][3] = damaged.rs[0][3].slice(0, 4);
  const response = await handleRequest(postRequest(rawPayload(damaged)), { DB: db });
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error, 'invalid_challenge');
});

await test('does not expose mutation endpoints for stored snapshots', async () => {
  const response = await handleRequest(new Request(
    'https://turn-challenges.example/v1/challenges/0123456789ab',
    { method: 'PUT', headers: { Origin: ORIGIN } }
  ), { DB: db });
  assert.equal(response.status, 405);
});

await test('health endpoint reports whether D1 is bound without mutating it', async () => {
  const response = await handleRequest(new Request('https://turn-challenges.example/health'), { DB: db });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'turn-challenges',
    version: 1,
    databaseBound: true
  });
});
