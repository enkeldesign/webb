# TURN challenge snapshot Worker

This is the deliberately small server component for short YOUR TURN links.

It does one thing: store an immutable encoded YOUR TURN challenge snapshot behind a short opaque ID and return that same snapshot later.

TURN and YOUR TURN are **not connected to this Worker yet**. Until the frontend integration lands, production sharing keeps using the existing self-contained challenge links.

## API

- `GET /health` — deployment/binding health check.
- `POST /v1/challenges` — accepts `{ "payload": "gz.…" }` from `https://enkel.design`, validates the YOUR TURN v2 wire payload, stores it, and returns a 12-character ID.
- `GET /v1/challenges/:id` — returns the immutable encoded challenge snapshot.

There is intentionally no update, delete, account, session, leaderboard, or synchronization API. Two people who grow the same seed still create two independent challenge branches.

## Storage and safety boundaries

- D1 binding: `DB`.
- The table is created lazily with `CREATE TABLE IF NOT EXISTS` so first deployment does not require a separate migration step.
- Exact duplicate payloads reuse the same snapshot ID; different challenge generations get different immutable snapshots.
- Browser writes are accepted only with an `Origin` of `https://enkel.design` (or `https://www.enkel.design`). This is a browser-origin guard, not an authentication system.
- Request and decompressed-payload limits protect the tiny store from accidental oversized writes.
- The Worker decompresses and structurally validates the current YOUR TURN v2 wire format before storing anything.

## Cloudflare dashboard setup

Cloudflare Workers Builds can deploy this project directly from the existing `enkeldesign/webb` repository.

1. Open **Workers & Pages** → **Create application** → **Import a repository**.
2. Connect the GitHub account and choose `enkeldesign/webb`.
3. Worker/project name: **`turn-challenges`**. This must match `wrangler.jsonc`.
4. Production branch: **`main`**.
5. Root directory: **`workers/turn-challenges`**.
6. Leave the optional build command empty.
7. Leave the deploy command at its default: **`npx wrangler deploy`**.
8. Save and deploy.

The Wrangler config declares a draft D1 binding with only `"binding": "DB"`. Wrangler 4.45+ supports automatic resource provisioning for D1 and should create/link the database during deployment.

If Cloudflare's automatic D1 provisioning does not complete, do not improvise another architecture. Create one D1 database in the dashboard and bind it to the Worker as variable **`DB`**, then redeploy. No schema SQL needs to be entered manually because the Worker initializes its one table lazily.

After deployment, open the generated `*.workers.dev/health` endpoint. A ready deployment returns JSON containing:

```json
{
  "ok": true,
  "service": "turn-challenges",
  "version": 1,
  "databaseBound": true
}
```

Give the resulting public Worker base URL to the TURN frontend integration, for example:

```text
https://turn-challenges.<account-subdomain>.workers.dev
```

The Worker URL is public configuration, not a secret.

## Local checks

Requires Node 24+ for the same web-platform primitives used by the Worker tests.

```sh
npm test
```

Wrangler is only required for local Cloudflare development/deployment:

```sh
npm install
npm run dev
```
