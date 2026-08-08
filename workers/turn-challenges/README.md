# TURN Cloudflare Worker

This is TURN's deliberately small server component. It currently has two jobs:

1. store immutable YOUR TURN challenge snapshots behind short opaque IDs; and
2. receive privacy-minimal gameplay events for Erik's private usage dashboard.

TURN's racing runtime remains local in the browser. The Worker does not simulate races, synchronize players or understand driving physics.

## Challenge API

- `GET /health` — deployment/D1 binding health check.
- `POST /v1/challenges` — accepts `{ "payload": "gz.…" }` from `https://enkel.design`, validates the YOUR TURN v2 wire payload, stores it, and returns a 12-character ID.
- `GET /v1/challenges/:id` — returns the immutable encoded challenge snapshot.

There is intentionally no update or delete API for challenge snapshots. Two people who grow the same seed create independent immutable branches.

## Private usage statistics

- `POST /v1/telemetry` — accepts a small batch of allow-listed gameplay events from TURN/YOUR TURN.
- `GET /v1/stats?days=30` — returns anonymous aggregate statistics to the private dashboard after bearer-key authentication.
- Analytics Engine binding: `ANALYTICS`, dataset `turn_gameplay`.
- D1 stores daily aggregate counts only. It does not store player IDs or page-session IDs.

TURN does not create an analytics cookie or persistent analytics identifier. A random page-session identifier exists only in browser memory, is hashed by the Worker before the Analytics Engine write, and is never written to D1. Telemetry starts only after a race actually starts and is event-driven rather than frame-driven.

Current event types are deliberately small:

- `play_session`
- `race_start`
- `lap_complete`
- `lap_invalid`

Dimensions are limited to product surface, build, track, car, steering mode, browser/installed web app, Drive By Ear state, blank-screen state, lap time and invalid-lap reason. Names, challenge IDs/links, replay data, driving paths, control streams and precise location are not part of the analytics payload.

The private dashboard is a static page under `/turn/stats/`. It is `noindex`, unlinked from TURN and protected at the API layer by a bearer key whose plaintext is not committed to the repository.

## Storage and safety boundaries

- D1 binding: `DB`.
- Tables are created lazily with `CREATE TABLE IF NOT EXISTS`; deployment does not require a separate migration step.
- Exact duplicate challenge payloads reuse the same snapshot ID; different challenge generations get different immutable snapshots.
- Browser writes are accepted only with an `Origin` of `https://enkel.design` (or `https://www.enkel.design`). This is an origin guard, not user authentication.
- Request and decompressed-payload limits protect the challenge store from accidental oversized writes.
- The Worker decompresses and structurally validates the current YOUR TURN v2 wire format before storing challenges.
- The telemetry endpoint accepts only its fixed event schema rather than arbitrary event names or arbitrary user data.

## Cloudflare deployment

Cloudflare Workers Builds deploys this project directly from `enkeldesign/webb`.

- Worker/project name: `turn-challenges`
- Production branch: `main`
- Root directory: `workers/turn-challenges`
- Build command: empty
- Deploy command: `npx wrangler deploy`

The Wrangler config declares D1 as binding `DB` and Analytics Engine as binding `ANALYTICS`. The `turn_gameplay` Analytics Engine dataset is created by Cloudflare when data is first written.

After deployment, the public Worker base URL is:

```text
https://turn-challenges.erik-jansson-ux.workers.dev
```

A ready `/health` response contains:

```json
{
  "ok": true,
  "service": "turn-challenges",
  "version": 1,
  "databaseBound": true
}
```

## Local checks

Requires Node 24+ for the same web-platform primitives used by the Worker tests.

```sh
npm install
npm run check
```

For local Cloudflare development:

```sh
npm run dev
```
